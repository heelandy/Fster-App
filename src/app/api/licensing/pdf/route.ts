import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle } from '@/lib/http';
import { buildLicensingPdf } from '@/lib/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Download the household's licensing / compliance list as a printable PDF. */
export function GET() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'licensing:read');
    const items = await prisma.licensingRequirement.findMany({
      where: { householdId: ctx.householdId },
      select: { name: true, category: true, status: true, dueDate: true, completedAt: true },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
    const pdf = buildLicensingPdf(ctx.householdName, items);
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
