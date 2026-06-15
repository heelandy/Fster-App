import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export function GET() {
  return handle(async () => {
    await requireAdmin();
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return json(notifications);
  });
}

const patchSchema = z.object({ id: z.string().cuid().optional(), all: z.boolean().optional() });

export function PATCH(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    mutationGuard('admin-notif', admin.id, RateLimits.write);
    const { id, all } = await readJson(req, patchSchema);
    if (all) await prisma.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
    else if (id) await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return json({ ok: true });
  });
}
