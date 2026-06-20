import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability, requireAgencyHome } from '@/lib/agency';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyLicensingSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Submit a licensing / compliance item to one of the agency's homes for the
 * foster parent to complete — it appears (NOT_STARTED) on the foster parent's
 * Licensing page. Case worker / agency admin.
 */
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'licensing:manage');
    mutationGuard('agency-licensing', ctx.userId, RateLimits.write);
    const home = await requireAgencyHome(ctx, params.id);
    const { name, category, dueDate } = await readJson(req, agencyLicensingSchema);

    const item = await prisma.licensingRequirement.create({
      data: { householdId: home.id, name, category: category ?? null, dueDate: dueDate ?? null, status: 'NOT_STARTED' },
    });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_LICENSING_SUBMITTED', metadata: { agencyId: ctx.agencyId, householdId: home.id, requirementId: item.id } });
    return json({ id: item.id }, 201);
  });
}
