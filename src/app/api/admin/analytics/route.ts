import type { PlanTier, BillingInterval } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { PLANS } from '@/lib/plans';

/** Monthly-equivalent price for a plan/interval (annual ÷ 12). FREE = 0. */
function monthlyCents(tier: PlanTier, interval: BillingInterval): number {
  const plan = PLANS[tier];
  if (!plan) return 0;
  return interval === 'ANNUAL' ? Math.round(plan.priceCentsAnnual / 12) : plan.priceCentsMonthly;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

const DAY_MS = 86_400_000;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/**
 * Platform analytics: signups/day and active-users/day over 30 days, plus
 * DAU/WAU/MAU and a simple subscription churn estimate. Derived from existing
 * data (User.createdAt, LOGIN_SUCCESS security events, Subscription) — no PII.
 */
export function GET() {
  return handle(async () => {
    await requireAdminPermission('analytics.view');
    const now = Date.now();
    const since = new Date(now - 30 * DAY_MS);

    const [signupRows, loginRows, totalUsers, activeSubs, canceled30d, subGroups] = await Promise.all([
      prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.securityAuditLog.findMany({
        where: { event: 'LOGIN_SUCCESS', createdAt: { gte: since }, actorId: { not: null } },
        select: { actorId: true, createdAt: true },
        // Most-recent first so the cap drops the OLDEST rows: DAU/WAU/MAU stay
        // accurate even past the cap (they care about recent activity).
        orderBy: { createdAt: 'desc' },
        take: 50_000,
      }),
      prisma.user.count(),
      prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING', 'GRACE', 'PAST_DUE'] } } }),
      prisma.subscription.count({ where: { status: 'CANCELED', updatedAt: { gte: since } } }),
      // Entitling subscriptions grouped by plan + interval → recurring revenue.
      prisma.subscription.groupBy({
        by: ['tier', 'interval'],
        where: { status: { in: ['ACTIVE', 'TRIALING', 'GRACE', 'PAST_DUE'] } },
        _count: { _all: true },
      }),
    ]);

    // Build 30 contiguous day buckets so the chart has no gaps.
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) days.push(dayKey(new Date(now - i * DAY_MS)));

    const signupsByDay = new Map<string, number>();
    for (const r of signupRows) signupsByDay.set(dayKey(r.createdAt), (signupsByDay.get(dayKey(r.createdAt)) ?? 0) + 1);

    // Single pass over loginRows: per-day active sets (for the chart) AND the
    // distinct DAU/WAU/MAU windows (all rows are already within 30d via the query).
    const activeUsersByDay = new Map<string, Set<string>>();
    const dau = new Set<string>();
    const wau = new Set<string>();
    const mau = new Set<string>();
    const dayCut = now - DAY_MS;
    const weekCut = now - 7 * DAY_MS;
    for (const r of loginRows) {
      if (!r.actorId) continue;
      const t = r.createdAt.getTime();
      mau.add(r.actorId);
      if (t >= weekCut) wau.add(r.actorId);
      if (t >= dayCut) dau.add(r.actorId);
      const k = dayKey(r.createdAt);
      let set = activeUsersByDay.get(k);
      if (!set) { set = new Set(); activeUsersByDay.set(k, set); }
      set.add(r.actorId);
    }

    const series = days.map((d) => ({
      date: d,
      signups: signupsByDay.get(d) ?? 0,
      activeUsers: activeUsersByDay.get(d)?.size ?? 0,
    }));

    const churnRate = activeSubs + canceled30d > 0 ? canceled30d / (activeSubs + canceled30d) : 0;

    // Recurring revenue from entitling subscriptions (monthly-equivalent).
    let mrrCents = 0;
    let payingSubs = 0;
    for (const g of subGroups) {
      mrrCents += g._count._all * monthlyCents(g.tier, g.interval);
      if (g.tier !== 'FREE') payingSubs += g._count._all;
    }
    const arrCents = mrrCents * 12;
    const arpuCents = payingSubs > 0 ? Math.round(mrrCents / payingSubs) : 0;

    return json({
      series,
      kpis: {
        dau: dau.size,
        wau: wau.size,
        mau: mau.size,
        totalUsers,
        newUsers30d: signupRows.length,
        activeSubs,
        payingSubs,
        canceled30d,
        churnRatePct: Math.round(churnRate * 1000) / 10,
        mrrCents,
        arrCents,
        arpuCents,
      },
    });
  });
}
