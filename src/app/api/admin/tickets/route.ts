import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

/** List support tickets for staff, newest activity first. Optional ?status= filter. */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdminPermission('support.manage');
    const status = new URL(req.url).searchParams.get('status') ?? undefined;
    const tickets = await prisma.supportTicket.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
      select: {
        id: true, subject: true, status: true, priority: true,
        createdAt: true, lastMessageAt: true,
        user: { select: { email: true, name: true } },
        _count: { select: { messages: true } },
      },
    });
    return json(tickets);
  });
}
