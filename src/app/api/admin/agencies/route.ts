import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { runFreeChecks, agencyVerifyApiConfigured, lookupNpi } from '@/lib/agency-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Agency verification queue for platform admins. Lists agencies with their
 * submitted legitimacy details and the deterministic free-check results so a
 * reviewer can approve/reject. Defaults to those awaiting review (PENDING).
 *
 * GOLDEN RULE note: this is platform-staff oversight of the agency's OWN
 * application data (legal name / EIN / address it submitted) — not any foster
 * family's private records, which admins never see.
 */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdminPermission('agencies.verify');

    const status = new URL(req.url).searchParams.get('status'); // PENDING | VERIFIED | REJECTED | UNVERIFIED | all
    const where =
      status && status !== 'all' && ['PENDING', 'VERIFIED', 'REJECTED', 'UNVERIFIED'].includes(status)
        ? { verificationStatus: status as 'PENDING' | 'VERIFIED' | 'REJECTED' | 'UNVERIFIED' }
        : {};

    const agencies = await prisma.agency.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { members: true, households: true } } },
    });

    // Auto NPI lookup against the free CMS NPPES registry for review (best-effort).
    const rows = await Promise.all(
      agencies.map(async (a) => ({
        id: a.id,
        name: a.name,
        displayName: a.displayName,
        status: a.verificationStatus,
        submittedAt: a.submittedAt,
        verifiedAt: a.verifiedAt,
        reviewNote: a.reviewNote,
        members: a._count.members,
        homes: a._count.households,
        details: {
          legalName: a.legalName,
          ein: a.ein,
          npi: a.npi,
          usState: a.usState,
          licenseNumber: a.licenseNumber,
          phone: a.phone,
          addressLine: a.addressLine,
          city: a.city,
          postalCode: a.postalCode,
          website: a.website,
        },
        checks: runFreeChecks(a),
        npiLookup: a.npi ? await lookupNpi(a.npi) : null,
      })),
    );

    return json({ externalProviderConfigured: agencyVerifyApiConfigured, agencies: rows });
  });
}
