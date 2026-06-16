import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';

export const runtime = 'nodejs';

export function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    // Scope by userId so a user can only ever read their own ticket (IDOR-safe).
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
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
