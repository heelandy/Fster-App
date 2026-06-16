import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { ticketStatusSchema } from '@/lib/validation';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';

export function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdminPermission('support.manage');
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, body: true, fromStaff: true, createdAt: true },
        },
      },
    });
    if (!ticket) throw Errors.notFound();
    return json(ticket);
  });
}

/** Update ticket status (open / pending / resolved / closed). */
export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdminPermission('support.manage');
    mutationGuard('admin-ticket', admin.id, RateLimits.write);
    const { status } = await readJson(req, ticketStatusSchema);
    const existing = await prisma.supportTicket.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!existing) throw Errors.notFound();

    const ticket = await prisma.supportTicket.update({
      where: { id: params.id },
      data: { status },
      select: { id: true, status: true },
    });
    await logAdmin({
      actorId: admin.id,
      action: 'TICKET_STATUS_CHANGED',
      targetType: 'SupportTicket',
      targetId: params.id,
      metadata: { from: existing.status, to: status },
    });
    return json(ticket);
  });
}
