import Link from 'next/link';
import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { PendingPlacements } from '@/components/pending-placements';
import { PendingOversightRequests, RevokeOversight } from '@/components/pending-oversight-requests';
import { IncidentReporter } from '@/components/incident-reporter';
import { MessageThread } from '@/components/message-thread';

function StatCard({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const inner = (
    <div className="card h-full">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function DashboardOverview() {
  const ctx = await requireHousehold();
  const hh = ctx.householdId;

  // Agency context for this home (announcements + recent oversight visits).
  const home = await prisma.household.findUnique({
    where: { id: hh },
    select: { agencyId: true, agency: { select: { name: true } } },
  });
  // Pending agency oversight requests the home owner must approve/deny before any
  // data is shared. Owner-only (household:manage).
  const oversightRequests = can(ctx, 'household:manage')
    ? await prisma.agencyOversightRequest.findMany({
        where: { householdId: hh, status: 'PENDING' },
        select: { id: true, agency: { select: { name: true } }, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  const oversightItems = oversightRequests.map((r) => ({ id: r.id, agencyName: r.agency.name }));
  const [announcements, recentVisits, goals] = await Promise.all([
    home?.agencyId
      ? prisma.announcement.findMany({ where: { agencyId: home.agencyId }, select: { id: true, title: true, body: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 })
      : [],
    home?.agencyId
      ? prisma.visit.findMany({ where: { householdId: hh, status: 'COMPLETED' }, select: { id: true, visitType: true, summary: true, visitDate: true }, orderBy: { visitDate: 'desc' }, take: 5 })
      : [],
    can(ctx, 'goals:read')
      ? prisma.goal.findMany({ where: { householdId: hh, NOT: { status: 'CANCELLED' } }, select: { id: true, title: true, status: true, targetDate: true }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 8 })
      : [],
  ]);

  const [childCount, upcoming, activeMeds, pending] = await Promise.all([
    can(ctx, 'children:read') ? prisma.childProfile.count({ where: { householdId: hh } }) : 0,
    can(ctx, 'appointments:read')
      ? prisma.appointment.findMany({
          where: { householdId: hh, startsAt: { gte: new Date() } },
          orderBy: { startsAt: 'asc' },
          take: 5,
          include: { child: { select: { firstName: true, preferredName: true } } },
        })
      : [],
    can(ctx, 'medications:read')
      ? prisma.medication.count({ where: { householdId: hh, isActive: true } })
      : 0,
    // Children a case worker assigned to this home, awaiting the foster parent's Y/N.
    can(ctx, 'children:write')
      ? prisma.placement.findMany({
          where: { parentResponse: 'PENDING', child: { householdId: hh } },
          select: { id: true, endDate: true, agency: true, child: { select: { firstName: true, preferredName: true } } },
          orderBy: { placementDate: 'desc' },
        })
      : [],
  ]);

  const pendingItems = pending.map((p) => ({
    placementId: p.id,
    childName: p.child.preferredName || p.child.firstName,
    trialEndDate: p.endDate ? p.endDate.toISOString() : null,
    agency: p.agency,
  }));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Welcome back 👋</h1>
      <p className="mb-6 text-sm text-slate-600">Here’s what’s happening in {ctx.householdName}.</p>

      <PendingOversightRequests items={oversightItems} />

      <PendingPlacements items={pendingItems} />

      {home?.agencyId && can(ctx, 'household:manage') && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-600">
            Overseen by <span className="font-medium text-slate-900">{home.agency?.name ?? 'your agency'}</span>
          </p>
          <RevokeOversight agencyName={home.agency?.name ?? 'your agency'} />
        </div>
      )}

      {announcements.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">From your agency</h2>
          <div className="space-y-2">
            {announcements.map((a) => (
              <div key={a.id} className="card bg-brand-50">
                <p className="font-medium text-slate-900">{a.title}</p>
                <p className="text-xs text-slate-500">{a.createdAt.toLocaleDateString()}</p>
                {a.body && <p className="mt-1 text-sm text-slate-700">{a.body}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {can(ctx, 'children:read') && <StatCard label="Children" value={childCount} href="/dashboard/children" />}
        {can(ctx, 'appointments:read') && (
          <StatCard label="Upcoming appointments" value={upcoming.length} href="/dashboard/appointments" />
        )}
        {can(ctx, 'medications:read') && (
          <StatCard label="Active medications" value={activeMeds} href="/dashboard/medications" />
        )}
      </div>

      {can(ctx, 'appointments:read') && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Next appointments</h2>
          <div className="card p-0">
            {upcoming.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No upcoming appointments.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{a.title}</p>
                      <p className="text-xs text-slate-500">
                        {a.type.replaceAll('_', ' ')}
                        {a.child ? ` · ${a.child.preferredName || a.child.firstName}` : ''}
                      </p>
                    </div>
                    <span className="text-sm text-slate-600">{a.startsAt.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {recentVisits.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Recent caseworker visits</h2>
          <div className="card p-0">
            <ul className="divide-y divide-slate-100">
              {recentVisits.map((v) => (
                <li key={v.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-800">{v.visitType || 'Visit'}</p>
                    {v.summary && <p className="text-xs text-slate-500">{v.summary}</p>}
                  </div>
                  <span className="text-sm text-slate-600">{v.visitDate.toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Case goals</h2>
          <div className="card p-0">
            <ul className="divide-y divide-slate-100">
              {goals.map((g) => (
                <li key={g.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-slate-800">{g.title}{g.targetDate ? <span className="text-slate-400"> · by {g.targetDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}</span> : null}</span>
                  <span className="badge bg-slate-100 text-slate-600">{g.status.replaceAll('_', ' ').toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {can(ctx, 'incidents:write') && <IncidentReporter />}

      {home?.agencyId && can(ctx, 'messages:read') && <MessageThread />}

      {ctx.role === 'BABYSITTER' && (
        <div className="mt-8 card bg-amber-50">
          <p className="text-sm text-amber-800">
            You have <strong>caregiver access</strong>. You can view care instructions, routines and
            medications, but not private case documents or legal information.
          </p>
        </div>
      )}
    </div>
  );
}
