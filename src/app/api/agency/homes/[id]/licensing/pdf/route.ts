import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability, requireAgencyHome } from '@/lib/agency';
import { handle } from '@/lib/http';
import { buildLicensingPdf } from '@/lib/pdf';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/** Download a home's licensing / compliance list as a printable PDF (agency oversight). */
export function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'homes:view');
    const home = await requireAgencyHome(ctx, params.id);
    const items = await prisma.licensingRequirement.findMany({
      where: { householdId: home.id },
      select: { name: true, category: true, status: true, dueDate: true, completedAt: true },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
    const pdf = buildLicensingPdf(home.name, items);
    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="licensing.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  });
}
