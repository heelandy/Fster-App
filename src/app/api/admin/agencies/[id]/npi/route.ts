import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { lookupNpi } from '@/lib/agency-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = { params: { id: string } };

/**
 * On-demand NPI registry (CMS NPPES) lookup for ONE agency. Kept off the list
 * endpoint so loading the verification queue never waits on an external API.
 */
export function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    await requireAdminPermission('agencies.verify');
    const agency = await prisma.agency.findUnique({ where: { id: params.id }, select: { npi: true } });
    if (!agency) throw Errors.notFound();
    if (!agency.npi) return json({ npiLookup: null });
    return json({ npiLookup: await lookupNpi(agency.npi) });
  });
}
