import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, Errors } from '@/lib/http';
import { assertChildInHousehold } from '@/lib/scope';
import { buildChildReportPdf } from '@/lib/pdf';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Court / caseworker report for one child as a printable PDF, generated from the
 * child's logged data (placements, appointments, active meds, recent care logs).
 * Restricted to full caregivers (children:read) in the child's own household.
 */
export function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'children:read');
    await assertChildInHousehold(ctx, params.id);

    const child = await prisma.childProfile.findUnique({
      where: { id: params.id },
      select: {
        firstName: true, preferredName: true, lastName: true, dateOfBirth: true,
        caseNumber: true, caseworkerName: true, school: true, placementStatus: true,
      },
    });
    if (!child) throw Errors.notFound();

    const [placements, appointments, medications, careLogs] = await Promise.all([
      prisma.placement.findMany({ where: { childId: params.id }, select: { status: true, placementDate: true, endDate: true }, orderBy: { placementDate: 'desc' }, take: 50 }),
      prisma.appointment.findMany({ where: { childId: params.id }, select: { title: true, type: true, startsAt: true }, orderBy: { startsAt: 'desc' }, take: 30 }),
      prisma.medication.findMany({ where: { childId: params.id, isActive: true }, select: { name: true, dosage: true, schedule: true }, orderBy: { name: 'asc' } }),
      prisma.dailyCareLog.findMany({ where: { childId: params.id }, select: { logDate: true, behavior: true, mood: true, incidents: true, milestones: true }, orderBy: { logDate: 'desc' }, take: 20 }),
    ]);

    const pdf = buildChildReportPdf({
      childName: child.preferredName || `${child.firstName} ${child.lastName ?? ''}`.trim(),
      dateOfBirth: child.dateOfBirth,
      caseNumber: child.caseNumber,
      caseworkerName: child.caseworkerName,
      school: child.school,
      placementStatus: child.placementStatus,
      placements,
      appointments,
      medications,
      careLogs,
    });

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="child-report.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  });
}
