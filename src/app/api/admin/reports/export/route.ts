import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, Errors } from '@/lib/http';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

const TYPES = ['users', 'subscriptions', 'revenue'] as const;
type ReportType = (typeof TYPES)[number];

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/**
 * Export an aggregate platform report as CSV. Account/billing metadata only —
 * never child records, documents, notes or case data. Gated by `reports.export`.
 */
export function GET(req: Request) {
  return handle(async () => {
    const admin = await requireAdminPermission('reports.export');
    const type = (new URL(req.url).searchParams.get('type') ?? 'users') as ReportType;
    if (!TYPES.includes(type)) throw Errors.badRequest('Unknown report type.');

    let csv: string;
    if (type === 'users') {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10_000,
        select: {
          email: true, name: true, globalRole: true, adminRole: true, isActive: true,
          isBanned: true, emailVerifiedAt: true, lastLoginAt: true, createdAt: true, deletedAt: true,
        },
      });
      csv = toCsv(
        ['email', 'name', 'role', 'adminRole', 'status', 'verified', 'lastLogin', 'createdAt'],
        users.map((u) => [
          u.email, u.name ?? '', u.globalRole, u.adminRole ?? '',
          u.deletedAt ? 'deleted' : u.isBanned ? 'banned' : u.isActive ? 'active' : 'suspended',
          u.emailVerifiedAt ? 'yes' : 'no',
          u.lastLoginAt?.toISOString() ?? '', u.createdAt.toISOString(),
        ]),
      );
    } else if (type === 'subscriptions') {
      const subs = await prisma.subscription.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10_000,
        select: {
          tier: true, status: true, interval: true, currentPeriodEnd: true, createdAt: true,
          household: { select: { name: true, owner: { select: { email: true } } } },
        },
      });
      csv = toCsv(
        ['household', 'ownerEmail', 'tier', 'status', 'interval', 'currentPeriodEnd', 'createdAt'],
        subs.map((s) => [
          s.household?.name ?? '', s.household?.owner?.email ?? '', s.tier, s.status, s.interval,
          s.currentPeriodEnd?.toISOString() ?? '', s.createdAt.toISOString(),
        ]),
      );
    } else {
      const payments = await prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10_000,
        select: {
          amountCents: true, currency: true, status: true, createdAt: true,
          subscription: { select: { tier: true, household: { select: { name: true } } } },
        },
      });
      csv = toCsv(
        ['date', 'amount', 'currency', 'status', 'tier', 'household'],
        payments.map((p) => [
          p.createdAt.toISOString(), (p.amountCents / 100).toFixed(2), p.currency, p.status,
          p.subscription.tier, p.subscription.household?.name ?? '',
        ]),
      );
    }

    await logAdmin({ actorId: admin.id, action: 'ADMIN_EXPORT_REPORT', metadata: { type } });
    const filename = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
