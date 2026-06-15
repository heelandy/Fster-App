import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability, requireFeature } from '@/lib/authz';
import { handle, Errors } from '@/lib/http';
import { enforceRateLimit } from '@/lib/api';
import { readStoredFile } from '@/lib/storage';
import { RateLimits } from '@/lib/rate-limit';
import { getClientInfo } from '@/lib/request';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Authenticated, access-controlled document download. The file is fetched by its
 * document id (not a public/guessable path) and is only returned if it belongs to
 * the caller's household and the caller has document-read permission + a plan with
 * documents enabled. The raw storageKey is never exposed.
 */
export function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'documents:read');
    requireFeature(ctx, 'documents');
    const info = getClientInfo();
    enforceRateLimit(`download:${ctx.userId}:${info.ip}`, RateLimits.upload);

    const doc = await prisma.document.findFirst({
      where: { id: params.id, householdId: ctx.householdId },
    });
    if (!doc) throw Errors.notFound();

    const data = await readStoredFile(doc.storageKey);

    await logSecurity({
      actorId: ctx.userId,
      event: 'FILE_DOWNLOAD',
      ip: info.ip,
      userAgent: info.userAgent,
      metadata: { documentId: doc.id },
    });

    // Force download, disable caching/sniffing of sensitive content.
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Length': String(doc.sizeBytes),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.originalName)}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
