import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability, requireFeature } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard, enforceRateLimit } from '@/lib/api';
import { documentMetaSchema } from '@/lib/validation';
import { saveFile, isAllowedMime } from '@/lib/storage';
import { assertChildInHousehold } from '@/lib/scope';
import { RateLimits } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';

export function GET() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'documents:read');
    requireFeature(ctx, 'documents');
    const docs = await prisma.document.findMany({
      where: { householdId: ctx.householdId },
      // Never expose storageKey to the client.
      select: {
        id: true,
        title: true,
        category: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        childId: true,
        createdAt: true,
        child: { select: { firstName: true, preferredName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return json(docs);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'documents:write');
    requireFeature(ctx, 'documents');
    const info = mutationGuard('documents', ctx.userId, RateLimits.write);
    enforceRateLimit(`upload:${ctx.userId}:${info.ip}`, RateLimits.upload);

    // Reject oversized uploads BEFORE buffering the whole body into memory.
    // (Defence against memory-exhaustion DoS; the post-read check still applies.)
    const declaredLength = Number(req.headers.get('content-length') ?? '0');
    if (declaredLength && declaredLength > env.MAX_UPLOAD_BYTES + 4096) {
      throw Errors.badRequest('File is too large.');
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw Errors.badRequest('A file is required.');
    if (file.size === 0) throw Errors.badRequest('The file is empty.');
    if (file.size > env.MAX_UPLOAD_BYTES) throw Errors.badRequest('File is too large.');
    if (!isAllowedMime(file.type)) throw Errors.badRequest('File type is not allowed.');

    const meta = documentMetaSchema.parse({
      title: form.get('title'),
      category: form.get('category') ?? 'OTHER',
      childId: form.get('childId') || undefined,
    });
    if (meta.childId) await assertChildInHousehold(ctx, meta.childId);

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveFile(buffer, file.type);

    const doc = await prisma.document.create({
      data: {
        householdId: ctx.householdId,
        childId: meta.childId,
        category: meta.category,
        title: meta.title,
        storageKey: saved.storageKey,
        originalName: file.name.slice(0, 255),
        mimeType: file.type,
        sizeBytes: saved.sizeBytes,
        uploadedById: ctx.userId,
      },
      select: { id: true, title: true, category: true, originalName: true, createdAt: true },
    });

    await logAdmin({
      actorId: ctx.userId,
      action: 'DOCUMENT_UPLOAD',
      targetType: 'Document',
      targetId: doc.id,
      metadata: { household: ctx.householdId, category: meta.category },
    });

    return json(doc, 201);
  });
}
