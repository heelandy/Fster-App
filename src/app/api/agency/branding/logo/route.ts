import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard, enforceRateLimit } from '@/lib/api';
import { saveFile, deleteStoredFile } from '@/lib/storage';
import { scanUpload } from '@/lib/av-scan';
import { RateLimits } from '@/lib/rate-limit';
import { getClientInfo } from '@/lib/request';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

// Logos are small raster images. SVG is intentionally excluded (it can carry
// scripts); the bytes are magic-checked + AES-encrypted at rest by saveFile.
const LOGO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

/** Upload / replace the agency's branding logo. Agency admins only. */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'agency:manage');
    const info = mutationGuard('agency-logo', ctx.userId, RateLimits.write);
    enforceRateLimit(`upload:${ctx.userId}:${info.ip}`, RateLimits.upload);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw Errors.badRequest('A logo image is required.');
    if (file.size === 0) throw Errors.badRequest('The file is empty.');
    if (file.size > MAX_LOGO_BYTES) throw Errors.badRequest('Logo must be 2 MB or smaller.');
    if (!LOGO_MIME.has(file.type)) throw Errors.badRequest('Logo must be a PNG, JPEG or WebP image.');

    const buffer = Buffer.from(await file.arrayBuffer());
    const scan = await scanUpload(buffer, file.name, file.type);
    if (!scan.clean) throw Errors.badRequest(`Upload rejected: ${scan.reason ?? 'failed the malware scan'}.`);

    const saved = await saveFile(buffer, file.type);

    // Swap atomically-ish: record the new key, then delete the old object.
    const prev = await prisma.agency.findUnique({ where: { id: ctx.agencyId }, select: { logoStorageKey: true } });
    await prisma.agency.update({
      where: { id: ctx.agencyId },
      data: { logoStorageKey: saved.storageKey, logoMimeType: file.type },
    });
    if (prev?.logoStorageKey && prev.logoStorageKey !== saved.storageKey) {
      await deleteStoredFile(prev.logoStorageKey);
    }

    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_LOGO_UPDATED', metadata: { agencyId: ctx.agencyId } });
    return json({ ok: true }, 201);
  });
}

/** Remove the agency's logo. Agency admins only. */
export function DELETE() {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'agency:manage');
    mutationGuard('agency-logo', ctx.userId, RateLimits.write);

    const prev = await prisma.agency.findUnique({ where: { id: ctx.agencyId }, select: { logoStorageKey: true } });
    await prisma.agency.update({
      where: { id: ctx.agencyId },
      data: { logoStorageKey: null, logoMimeType: null },
    });
    if (prev?.logoStorageKey) await deleteStoredFile(prev.logoStorageKey);

    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_LOGO_REMOVED', metadata: { agencyId: ctx.agencyId } });
    return json({ ok: true });
  });
}
