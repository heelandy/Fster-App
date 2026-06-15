import Link from 'next/link';
import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

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

  const [childCount, upcoming, activeMeds] = await Promise.all([
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
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Welcome back 👋</h1>
      <p className="mb-6 text-sm text-slate-600">Here’s what’s happening in {ctx.householdName}.</p>

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
