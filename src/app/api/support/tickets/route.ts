import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { supportTicketSchema } from '@/lib/validation';
import { notifyAdmins } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

export function GET() {
  return handle(async () => {
    const user = await requireUser();
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true, subject: true, status: true, priority: true,
        createdAt: true, lastMessageAt: true,
        _count: { select: { messages: true } },
      },
    });
    return json(tickets);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('support', user.id, RateLimits.write);
    const data = await readJson(req, supportTicketSchema);

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: data.subject,
        priority: data.priority,
        status: 'OPEN',
        messages: { create: { authorId: user.id, fromStaff: false, body: data.message } },
      },
      select: { id: true, subject: true, status: true, priority: true, createdAt: true, lastMessageAt: true },
    });

    await notifyAdmins({
      type: 'SUPPORT_TICKET',
      message: `New support ticket: ${data.subject}`,
      level: data.priority === 'URGENT' ? 'warning' : 'info',
      metadata: { ticketId: ticket.id, userId: user.id },
    });

    return json(ticket, 201);
  });
}
