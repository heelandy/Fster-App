import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyBrandingSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Update the agency's white-label branding (display name + accent colour). The
 * logo is uploaded separately (multipart) at /api/agency/branding/logo. Agency
 * admins only. Branding is visible to the agency's own staff and the foster homes
 * it oversees — never to other tenants.
 */
export function PATCH(req: Request) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'agency:manage');
    mutationGuard('agency-branding', ctx.userId, RateLimits.write);

    const { displayName, brandColor } = await readJson(req, agencyBrandingSchema);

    await prisma.agency.update({
      where: { id: ctx.agencyId },
      data: {
        displayName: displayName ?? null,
        brandColor: brandColor ?? null,
      },
    });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_BRANDING_UPDATED', metadata: { agencyId: ctx.agencyId } });

    return json({ ok: true, displayName: displayName ?? null, brandColor: brandColor ?? null });
  });
}
