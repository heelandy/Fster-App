import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { AccessDenied } from '@/components/feature-locked';
import { TimelineExplorer, type TimelineChild, type TimelineEvent } from '@/components/timeline-explorer';

// Placement timeline / child journey — pick a child and see their merged
// chronological view (placements, appointments, journal entries, behaviour notes).
export default async function TimelinePage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'children:read')) return <AccessDenied />;
  const hh = ctx.householdId;

  const [children, placements, appts, journal, behavior] = await Promise.all([
    prisma.childProfile.findMany({ where: { householdId: hh }, select: { id: true, firstName: true, preferredName: true }, orderBy: { firstName: 'asc' } }),
    prisma.placement.findMany({ where: { child: { householdId: hh } }, select: { childId: true, status: true, placementDate: true } }),
    can(ctx, 'appointments:read') ? prisma.appointment.findMany({ where: { householdId: hh, childId: { not: null } }, select: { childId: true, title: true, type: true, startsAt: true } }) : [],
    can(ctx, 'journal:read') ? prisma.journalEntry.findMany({ where: { householdId: hh }, select: { childId: true, title: true, entryDate: true } }) : [],
    can(ctx, 'behaviorLogs:read') ? prisma.behaviorLog.findMany({ where: { householdId: hh }, select: { childId: true, strength: true, intervention: true, logDate: true } }) : [],
  ]);

  const byChild = new Map<string, TimelineEvent[]>();
  const push = (id: string | null, date: Date, kind: TimelineEvent['kind'], label: string) => {
    if (!id) return;
    const a = byChild.get(id) ?? [];
    a.push({ date: date.toISOString(), kind, label });
    byChild.set(id, a);
  };

  for (const p of placements) push(p.childId, p.placementDate, 'placement', `Placement: ${p.status.replaceAll('_', ' ').toLowerCase()}`);
  for (const a of appts) push(a.childId, a.startsAt, 'appointment', `${a.type.replaceAll('_', ' ').toLowerCase()}: ${a.title}`);
  for (const j of journal) push(j.childId, j.entryDate, 'journal', `Journal: ${j.title || 'entry'}`);
  for (const b of behavior) push(b.childId, b.logDate, 'behavior', `Behaviour: ${b.strength || b.intervention || 'note'}`);

  const data: TimelineChild[] = children.map((c) => ({
    id: c.id,
    name: c.preferredName || c.firstName,
    events: (byChild.get(c.id) ?? []).sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 50),
  }));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Placement timeline</h1>
      <p className="mb-6 text-sm text-slate-600">Pick a child to see their journey, newest first — a one-glance case summary.</p>

      {data.length === 0 ? (
        <div className="card text-sm text-slate-500">No children yet.</div>
      ) : (
        <TimelineExplorer data={data} />
      )}
    </div>
  );
}
