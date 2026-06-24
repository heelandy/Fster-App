import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { adminAgencyDecisionSchema } from '@/lib/validation';
import { logAdmin } from '@/lib/audit';
import { runExternalVerification } from '@/lib/agency-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = { params: { id: string } };

/**
 * Approve or reject an agency's verification. Platform admins only. Approving
 * unlocks the agency's oversight features (requireVerifiedAgency); rejecting
 * records a note the agency sees so it can fix the issue and resubmit.
 */
export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const admin = await requireAdminPermission('agencies.verify');
    mutationGuard('admin-agency-verify', admin.id, RateLimits.write);

    const { action, note } = await readJson(req, adminAgencyDecisionSchema);

    const agency = await prisma.agency.findUnique({ where: { id: params.id } });
    if (!agency) throw Errors.notFound();

    if (action === 'approve') {
      if (agency.verificationStatus === 'VERIFIED') throw Errors.conflict('That agency is already verified.');
      // Optional automated cross-check (no-op unless a provider is configured).
      const external = await runExternalVerification(agency);
      await prisma.agency.update({
        where: { id: agency.id },
        data: {
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: admin.id,
          reviewNote: note ?? null,
        },
      });
      await logAdmin({
        actorId: admin.id,
        action: 'AGENCY_VERIFIED',
        targetType: 'Agency',
        targetId: agency.id,
        metadata: { name: agency.name, external: external ?? undefined },
      });
      return json({ ok: true, status: 'VERIFIED', external });
    }

    // Reject
    await prisma.agency.update({
      where: { id: agency.id },
      data: { verificationStatus: 'REJECTED', reviewNote: note ?? null, verifiedAt: null, verifiedById: null },
    });
    await logAdmin({
      actorId: admin.id,
      action: 'AGENCY_REJECTED',
      targetType: 'Agency',
      targetId: agency.id,
      metadata: { name: agency.name, note: note ?? null },
    });
    return json({ ok: true, status: 'REJECTED' });
  });
}
