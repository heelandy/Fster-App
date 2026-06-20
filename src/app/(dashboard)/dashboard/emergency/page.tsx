import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { AccessDenied } from '@/components/feature-locked';

// Emergency info mode — a quick, glanceable per-child screen for caregivers:
// allergies, active medications, doctor and emergency contact. Read-only.
export default async function EmergencyPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'children:read')) return <AccessDenied />;

  const children = await prisma.childProfile.findMany({
    where: { householdId: ctx.householdId },
    select: {
      id: true, firstName: true, preferredName: true, allergies: true, doctorName: true,
      emergencyContactName: true, emergencyContactPhone: true,
      medications: { where: { isActive: true }, select: { id: true, name: true, dosage: true, schedule: true } },
    },
    orderBy: { firstName: 'asc' },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">🚨 Emergency info</h1>
      <p className="mb-6 text-sm text-slate-600">Allergies, medications and emergency contacts at a glance.</p>

      {children.length === 0 ? (
        <div className="card text-sm text-slate-500">No children in this household yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((c) => (
            <div key={c.id} className="card border-l-4 border-red-400">
              <h2 className="text-lg font-semibold text-slate-900">{c.preferredName || c.firstName}</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-red-600">Allergies</dt>
                  <dd className="text-slate-800">{c.allergies || 'None recorded'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active medications</dt>
                  <dd className="text-slate-800">
                    {c.medications.length === 0 ? 'None' : (
                      <ul className="mt-1 space-y-0.5">
                        {c.medications.map((m) => (
                          <li key={m.id}>{m.name}{m.dosage ? ` — ${m.dosage}` : ''}{m.schedule ? ` (${m.schedule})` : ''}</li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctor</dt>
                    <dd className="text-slate-800">{c.doctorName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency contact</dt>
                    <dd className="text-slate-800">{c.emergencyContactName || '—'}{c.emergencyContactPhone ? ` · ${c.emergencyContactPhone}` : ''}</dd>
                  </div>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
