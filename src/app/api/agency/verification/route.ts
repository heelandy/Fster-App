import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyVerificationSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';
import { notifyAdmins } from '@/lib/notify';
import { runFreeChecks, allFreeChecksPass } from '@/lib/agency-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Submit (or resubmit) the agency's legitimacy details for manual verification.
 * Agency admins only. Moves the agency to PENDING and notifies platform admins.
 * Already-VERIFIED agencies can't downgrade themselves by resubmitting.
 */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'agency:manage');
    mutationGuard('agency-verification', ctx.userId, RateLimits.write);

    if (ctx.verificationStatus === 'VERIFIED') {
      throw Errors.conflict('Your agency is already verified.');
    }
    if (ctx.verificationStatus === 'PENDING') {
      throw Errors.conflict('Your details are already under review.');
    }

    const data = await readJson(req, agencyVerificationSchema);
    const checks = runFreeChecks(data);

    await prisma.agency.update({
      where: { id: ctx.agencyId },
      data: {
        verificationStatus: 'PENDING',
        submittedAt: new Date(),
        reviewNote: null,
        legalName: data.legalName,
        ein: data.ein,
        npi: data.npi ?? null,
        usState: data.usState,
        licenseNumber: data.licenseNumber ?? null,
        phone: data.phone ?? null,
        addressLine: data.addressLine,
        city: data.city,
        postalCode: data.postalCode,
        website: data.website ?? null,
      },
    });

    await logSecurity({
      actorId: ctx.userId,
      event: 'AGENCY_VERIFICATION_SUBMITTED',
      metadata: { agencyId: ctx.agencyId, freeChecksPass: allFreeChecksPass(checks) },
    });
    await notifyAdmins({
      type: 'AGENCY_VERIFICATION',
      level: allFreeChecksPass(checks) ? 'info' : 'warning',
      message: `Agency resubmitted for verification: ${ctx.agencyName} (${data.usState})`,
      metadata: { agencyId: ctx.agencyId },
    });

    return json({ ok: true, status: 'PENDING' });
  });
}
