import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle } from '@/lib/http';
import { buildJournalPdf, type JournalGroup } from '@/lib/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Keepsake memory book PDF of the household's journal entries, grouped by child. */
export function GET() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'journal:read');

    const children = await prisma.childProfile.findMany({
      where: { householdId: ctx.householdId },
      select: {
        firstName: true, preferredName: true,
        journalEntries: { select: { entryDate: true, title: true, body: true }, orderBy: { entryDate: 'asc' } },
      },
      orderBy: { firstName: 'asc' },
    });

    const groups: JournalGroup[] = children.map((c) => ({
      childName: c.preferredName || c.firstName,
      entries: c.journalEntries,
    }));

    const pdf = buildJournalPdf(groups);
    return new Response(pdf, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="journal-keepsake.pdf"', 'Cache-Control': 'no-store' },
    });
  });
}
