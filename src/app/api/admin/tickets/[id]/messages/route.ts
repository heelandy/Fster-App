import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { supportMessageSchema } from '@/lib/validation';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';

/** Staff reply. Moves the ticket to PENDING (awaiting the user). */
export function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdminPermission('support.manage');
    mutationGuard('admin-ticket-msg', admin.id, RateLimits.write);
    const { body } = await readJson(req, supportMessageSchema);

    const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!ticket) throw Errors.notFound();

    const message = await prisma.supportMessage.create({
      data: { ticketId: ticket.id, authorId: admin.id, fromStaff: true, body },
      select: { id: true, body: true, fromStaff: true, createdAt: true },
    });
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: 'PENDING', lastMessageAt: new Date() },
    });
    await logAdmin({
      actorId: admin.id,
      action: 'TICKET_REPLY',
      targetType: 'SupportTicket',
      targetId: ticket.id,
    });
    return json(message, 201);
  });
}
