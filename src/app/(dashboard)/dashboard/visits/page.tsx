import { DoorOpen } from 'lucide-react';
import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { AccessDenied } from '@/components/feature-locked';
import { LogVisitForm } from '@/components/log-visit-form';

// Visit Log — visits to this foster home. Case workers create/schedule visits from
// the agency portal; foster parents can also log their own (often unscheduled)
// visits here. Both appear in the list below.
export default async function VisitsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'children:read')) return <AccessDenied />;
  const canLog = can(ctx, 'children:write');

  const visits = await prisma.visit.findMany({
    where: { householdId: ctx.householdId },
    select: { id: true, visitType: true, visitor: true, summary: true, visitDate: true, status: true },
    orderBy: { visitDate: 'desc' },
    take: 200,
  });
  const upcoming = visits.filter((v) => v.status === 'SCHEDULED').sort((a, b) => a.visitDate.getTime() - b.visitDate.getTime());
  const past = visits.filter((v) => v.status !== 'SCHEDULED');
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const titleOf = (v: { visitor: string | null; visitType: string | null }) => v.visitor || v.visitType || 'Visit';
  const subtitleOf = (v: { visitor: string | null; visitType: string | null }) => (v.visitor && v.visitType ? v.visitType : null);

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-semibold text-slate-900">
        <DoorOpen className="h-6 w-6 text-orange-600" /> Visit Log
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        Visits scheduled and logged by your case worker{canLog ? ', plus any you log yourself' : ''}.
      </p>

      {canLog && <LogVisitForm />}

      {visits.length === 0 ? (
        <div className="card text-sm text-slate-500">
          No visits yet. {canLog ? 'Log a visit above, or your case worker’s visits will appear here.' : 'When your case worker schedules or records a visit, it will appear here.'}
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Upcoming</h2>
            {upcoming.length === 0 ? (
              <div className="card text-sm text-slate-400">No upcoming visits scheduled.</div>
            ) : (
              <div className="space-y-2">
                {upcoming.map((v) => (
                  <div key={v.id} className="card border-l-4 border-brand-300">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">
                        {titleOf(v)}
                        {subtitleOf(v) && <span className="ml-2 text-sm font-normal text-slate-500">{subtitleOf(v)}</span>}
                        <span className="ml-1 badge bg-brand-100 text-brand-800">scheduled</span>
                      </p>
                      <p className="text-sm text-slate-600">{fmt(v.visitDate)}</p>
                    </div>
                    {v.summary && <p className="mt-1 text-sm text-slate-600">{v.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Past visits</h2>
            {past.length === 0 ? (
              <div className="card text-sm text-slate-400">No past visits recorded.</div>
            ) : (
              <div className="card p-0">
                <ul className="divide-y divide-cream-200">
                  {past.map((v) => (
                    <li key={v.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800">
                          {titleOf(v)}
                          {subtitleOf(v) && <span className="ml-2 text-sm font-normal text-slate-500">{subtitleOf(v)}</span>}
                        </p>
                        {v.summary && <p className="text-sm text-slate-500">{v.summary}</p>}
                      </div>
                      <p className="shrink-0 text-sm text-slate-500">{fmt(v.visitDate)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
