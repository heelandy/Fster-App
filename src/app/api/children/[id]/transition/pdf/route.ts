import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, Errors } from '@/lib/http';
import { assertChildInHousehold } from '@/lib/scope';
import { buildTransitionPacketPdf } from '@/lib/pdf';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/** Placement-transition packet PDF for a child (summary, meds, routines, comfort notes). */
export function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'children:read');
    await assertChildInHousehold(ctx, params.id);

    const child = await prisma.childProfile.findUnique({
      where: { id: params.id },
      select: {
        firstName: true, preferredName: true, lastName: true, dateOfBirth: true, school: true,
        doctorName: true, allergies: true, importantNotes: true, emergencyContactName: true, emergencyContactPhone: true,
        medications: { where: { isActive: true }, select: { name: true, dosage: true, schedule: true }, orderBy: { name: 'asc' } },
        routines: { select: { name: true }, orderBy: { name: 'asc' } },
      },
    });
    if (!child) throw Errors.notFound();

    const pdf = buildTransitionPacketPdf({
      childName: child.preferredName || `${child.firstName} ${child.lastName ?? ''}`.trim(),
      dateOfBirth: child.dateOfBirth,
      school: child.school,
      doctorName: child.doctorName,
      allergies: child.allergies,
      importantNotes: child.importantNotes,
      emergencyContactName: child.emergencyContactName,
      emergencyContactPhone: child.emergencyContactPhone,
      medications: child.medications,
      routines: child.routines,
    });

    return new Response(pdf, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="transition-packet.pdf"', 'Cache-Control': 'no-store' },
    });
  });
}
