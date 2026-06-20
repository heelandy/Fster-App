import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { AccessDenied } from '@/components/feature-locked';

type Ev = { date: Date; icon: string; label: string };

// Placement timeline / child journey — a merged chronological view of each
// child's key events (placements, appointments, journal entries, behaviour notes).
export default async function TimelinePage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'children:read')) return <AccessDenied />;
  const hh = ctx.householdId;

  const [children, placements, appts, journal, behavior] = await Promise.all([
    prisma.childProfile.findMany({ where: { householdId: hh }, select: { id: true, firstName: true, preferredName: true }, orderBy: { firstName: 'asc' } }),
    prisma.placement.findMany({ where: { child: { householdId: hh } }, select: { childId: true, status: true, placementDate: true, endDate: true } }),
    can(ctx, 'appointments:read') ? prisma.appointment.findMany({ where: { householdId: hh, childId: { not: null } }, select: { childId: true, title: true, type: true, startsAt: true } }) : [],
    can(ctx, 'journal:read') ? prisma.journalEntry.findMany({ where: { householdId: hh }, select: { childId: true, title: true, entryDate: true } }) : [],
    can(ctx, 'behaviorLogs:read') ? prisma.behaviorLog.findMany({ where: { householdId: hh }, select: { childId: true, strength: true, intervention: true, logDate: true } }) : [],
  ]);

  const byChild = new Map<string, Ev[]>();
  const push = (id: string | null, ev: Ev) => { if (!id) return; const a = byChild.get(id) ?? []; a.push(ev); byChild.set(id, a); };

  for (const p of placements) push(p.childId, { date: p.placementDate, icon: '🏠', label: `Placement: ${p.status.replaceAll('_', ' ').toLowerCase()}` });
  for (const a of appts) push(a.childId, { date: a.startsAt, icon: '📅', label: `${a.type.replaceAll('_', ' ').toLowerCase()}: ${a.title}` });
  for (const j of journal) push(j.childId, { date: j.entryDate, icon: '⭐', label: `Journal: ${j.title || 'entry'}` });
  for (const b of behavior) push(b.childId, { date: b.logDate, icon: '💛', label: `Behaviour: ${b.strength || b.intervention || 'note'}` });

  const fmt = (d: Date) => d.toLocaleDateString(undefined, { timeZone: 'UTC' });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Placement timeline</h1>
      <p className="mb-6 text-sm text-slate-600">Each child&rsquo;s journey, newest first — a one-glance case summary.</p>

      {children.length === 0 ? (
        <div className="card text-sm text-slate-500">No children yet.</div>
      ) : children.map((c) => {
        const events = (byChild.get(c.id) ?? []).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 30);
        return (
          <div key={c.id} className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{c.preferredName || c.firstName}</h2>
            {events.length === 0 ? (
              <div className="card text-sm text-slate-400">No events recorded yet.</div>
            ) : (
              <ol className="card relative space-y-4 border-l-2 border-slate-100 pl-0">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-lg" aria-hidden>{e.icon}</span>
                    <div>
                      <p className="text-sm text-slate-800">{e.label}</p>
                      <p className="text-xs text-slate-500">{fmt(e.date)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}
