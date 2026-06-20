import Link from 'next/link';
import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

// "Today" command center — one screen of what needs attention now: today's
// appointments, active meds, upcoming visits, court dates and licensing due soon.
export default async function TodayPage() {
  const ctx = await requireHousehold();
  const hh = ctx.householdId;
  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday.getTime() + 86_400_000);
  const in14 = new Date(now.getTime() + 14 * 86_400_000);

  const [todayAppts, courtDates, activeMeds, upcomingVisits, licensingDue] = await Promise.all([
    can(ctx, 'appointments:read')
      ? prisma.appointment.findMany({ where: { householdId: hh, startsAt: { gte: startToday, lt: endToday } }, select: { id: true, title: true, type: true, startsAt: true }, orderBy: { startsAt: 'asc' } })
      : [],
    can(ctx, 'appointments:read')
      ? prisma.appointment.findMany({ where: { householdId: hh, type: 'COURT', startsAt: { gte: now } }, select: { id: true, title: true, startsAt: true }, orderBy: { startsAt: 'asc' }, take: 5 })
      : [],
    can(ctx, 'medications:read')
      ? prisma.medication.findMany({ where: { householdId: hh, isActive: true }, select: { id: true, name: true, schedule: true, child: { select: { firstName: true, preferredName: true } } }, orderBy: { name: 'asc' } })
      : [],
    prisma.visit.findMany({ where: { householdId: hh, status: 'SCHEDULED', visitDate: { gte: startToday } }, select: { id: true, visitType: true, visitDate: true }, orderBy: { visitDate: 'asc' }, take: 5 }),
    can(ctx, 'licensing:read')
      ? prisma.licensingRequirement.findMany({ where: { householdId: hh, OR: [{ status: { in: ['DUE_SOON', 'EXPIRED'] } }, { dueDate: { lte: in14 } }], NOT: { status: 'COMPLETE' } }, select: { id: true, name: true, status: true, dueDate: true }, orderBy: { dueDate: 'asc' }, take: 8 })
      : [],
  ]);

  const Section = ({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) => (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {href && <Link href={href} className="text-xs text-brand-700 hover:underline">View all</Link>}
      </div>
      {children}
    </div>
  );
  const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const fmtDate = (d: Date) => d.toLocaleDateString();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Today</h1>
      <p className="mb-6 text-sm text-slate-600">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} — what needs your attention.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Appointments today" href="/dashboard/appointments">
          {todayAppts.length === 0 ? <p className="text-sm text-slate-400">Nothing scheduled today.</p> : (
            <ul className="space-y-1 text-sm">{todayAppts.map((a) => <li key={a.id} className="flex justify-between"><span className="text-slate-800">{a.title}</span><span className="text-slate-500">{fmtTime(a.startsAt)}</span></li>)}</ul>
          )}
        </Section>

        <Section title="Medications" href="/dashboard/medications">
          {activeMeds.length === 0 ? <p className="text-sm text-slate-400">No active medications.</p> : (
            <ul className="space-y-1 text-sm">{activeMeds.map((m) => <li key={m.id} className="flex justify-between"><span className="text-slate-800">{m.name} <span className="text-slate-400">· {m.child.preferredName || m.child.firstName}</span></span><span className="text-slate-500">{m.schedule || ''}</span></li>)}</ul>
          )}
        </Section>

        <Section title="Upcoming court dates" href="/dashboard/appointments">
          {courtDates.length === 0 ? <p className="text-sm text-slate-400">None upcoming.</p> : (
            <ul className="space-y-1 text-sm">{courtDates.map((a) => <li key={a.id} className="flex justify-between"><span className="text-slate-800">{a.title}</span><span className="text-slate-500">{fmtDate(a.startsAt)}</span></li>)}</ul>
          )}
        </Section>

        <Section title="Upcoming visits">
          {upcomingVisits.length === 0 ? <p className="text-sm text-slate-400">No scheduled visits.</p> : (
            <ul className="space-y-1 text-sm">{upcomingVisits.map((v) => <li key={v.id} className="flex justify-between"><span className="text-slate-800">{v.visitType || 'Visit'}</span><span className="text-slate-500">{fmtDate(v.visitDate)}</span></li>)}</ul>
          )}
        </Section>

        <Section title="Licensing due soon" href="/dashboard/licensing">
          {licensingDue.length === 0 ? <p className="text-sm text-slate-400">Nothing due soon.</p> : (
            <ul className="space-y-1 text-sm">{licensingDue.map((l) => <li key={l.id} className="flex justify-between"><span className="text-slate-800">{l.name}</span><span className={['DUE_SOON', 'EXPIRED'].includes(l.status) ? 'text-red-600' : 'text-slate-500'}>{l.dueDate ? fmtDate(l.dueDate) : l.status.replaceAll('_', ' ').toLowerCase()}</span></li>)}</ul>
          )}
        </Section>
      </div>
    </div>
  );
}
