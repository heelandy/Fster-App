import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability, requireAgencyHome, requireVerifiedAgency } from '@/lib/agency';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyAssignChildSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Assign a child to one of the agency's foster homes — a case worker (or agency
 * admin) places a child with a foster parent. The home always has a foster-parent
 * owner, so a child is never placed into a blank home. The placement lands as
 * PENDING on the foster parent's dashboard: they accept (→ TRIAL_HOME_VISIT, and
 * after the trial date passes it auto-becomes ACTIVE until reunified) or decline.
 * The planned trial end is stored now so the trial clock is ready on acceptance.
 * Not bound by the home's plan child-limit: a placement is an agency action.
 */
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'placements:manage');
    requireVerifiedAgency(ctx);
    mutationGuard('agency-assign-child', ctx.userId, RateLimits.write);
    const home = await requireAgencyHome(ctx, params.id);

    const { trialEndDate, ...childData } = await readJson(req, agencyAssignChildSchema);
    // Child lands PENDING until the foster parent responds (overrides the schema default).
    const child = await prisma.childProfile.create({ data: { householdId: home.id, ...childData, placementStatus: 'PENDING' } });
    const trialEnd = trialEndDate ?? new Date(Date.now() + 30 * 86_400_000); // default 30-day trial
    await prisma.placement.create({
      data: { childId: child.id, status: 'PENDING', placementDate: new Date(), endDate: trialEnd, agency: ctx.agencyName, parentResponse: 'PENDING', createdById: ctx.userId },
    });

    await logSecurity({
      actorId: ctx.userId,
      event: 'AGENCY_CHILD_ASSIGNED',
      metadata: { agencyId: ctx.agencyId, householdId: home.id, childId: child.id },
    });
    return json({ id: child.id }, 201);
  });
}
