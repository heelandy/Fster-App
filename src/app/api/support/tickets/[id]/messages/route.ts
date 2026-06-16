import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { supportMessageSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('support-msg', user.id, RateLimits.write);
    const { body } = await readJson(req, supportMessageSchema);

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, status: true },
    });
    if (!ticket) throw Errors.notFound();
    if (ticket.status === 'CLOSED') throw Errors.badRequest('This ticket is closed. Please open a new one.');

    const message = await prisma.supportMessage.create({
      data: { ticketId: ticket.id, authorId: user.id, fromStaff: false, body },
      select: { id: true, body: true, fromStaff: true, createdAt: true },
    });
    // A user reply moves the ticket back to OPEN (awaiting staff).
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: 'OPEN', lastMessageAt: new Date() },
    });

    return json(message, 201);
  });
}
