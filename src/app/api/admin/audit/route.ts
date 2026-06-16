import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

export function GET() {
  return handle(async () => {
    await requireAdminPermission('logs.view');
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
