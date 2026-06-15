import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/authz';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';

export function GET() {
  return handle(async () => {
    await requireAdmin();
    const [admin, security] = await Promise.all([
      prisma.adminAuditLog.findMany({
        include: { actor: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.securityAuditLog.findMany({
        include: { actor: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return json({ admin, security });
  });
}
