import { prisma } from '@/lib/prisma';
import { requireUser, requireHousehold } from '@/lib/authz';
import { findAgencyMembership } from '@/lib/agency';
import { handle, Errors } from '@/lib/http';
import { readStoredFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // reads the session — never prerender

/**
 * Serve an agency's branding logo. The agency is resolved from the SESSION — never
 * from a client-supplied id — so no one can enumerate other tenants' logos. The
 * caller sees a logo only if they are (a) staff of that agency, or (b) a foster
 * parent whose current home is overseen by it.
 */
export function GET() {
  return handle(async () => {
    const user = await requireUser();

    let logoStorageKey: string | null = null;
    let logoMimeType: string | null = null;

    const membership = await findAgencyMembership(user.id);
    if (membership) {
      const a = await prisma.agency.findUnique({
        where: { id: membership.agencyId },
        select: { logoStorageKey: true, logoMimeType: true },
      });
      logoStorageKey = a?.logoStorageKey ?? null;
      logoMimeType = a?.logoMimeType ?? null;
    } else {
      // Foster parent: use the same "current home" the dashboard resolves.
      try {
        const ctx = await requireHousehold();
        const home = await prisma.household.findUnique({
          where: { id: ctx.householdId },
          select: { agency: { select: { logoStorageKey: true, logoMimeType: true } } },
        });
        logoStorageKey = home?.agency?.logoStorageKey ?? null;
        logoMimeType = home?.agency?.logoMimeType ?? null;
      } catch {
        // No household (e.g. admin) — nothing to brand.
      }
    }

    if (!logoStorageKey || !logoMimeType) throw Errors.notFound();

    const data = await readStoredFile(logoStorageKey);
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': logoMimeType,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
