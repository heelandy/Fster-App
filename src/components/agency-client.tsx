'use client';

import { useState } from 'react';

interface Home {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
  current: boolean;
  children: number;
  upcomingAppointments: number;
  complianceAlerts: number;
}
interface Totals {
  homes: number;
  children: number;
  upcomingAppointments: number;
  complianceAlerts: number;
}

export function AgencyClient({
  homes,
  totals,
  canCreate,
  maxHomes,
}: {
  homes: Home[];
  totals: Totals;
  canCreate: boolean;
  maxHomes: number;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createHome() {
    const name = prompt('Name for the new foster home (e.g. “Maple Street Home”):');
    if (!name || !name.trim()) return;
    setBusy('create');
    setError(null);
    const res = await fetch('/api/household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(d?.error || 'Could not create the home.'); return; }
    window.location.reload();
  }

  async function openHome(id: string) {
    setBusy(id);
    const res = await fetch('/api/household/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId: id }),
    });
    if (res.ok) window.location.href = '/dashboard';
    else { setBusy(null); setError('Could not switch home.'); }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Agency dashboard</h1>
          <p className="text-sm text-slate-600">
            Overview across your foster homes{maxHomes === -1 ? ' (unlimited on your plan)' : ''}. You only see homes you belong to.
          </p>
        </div>
        {canCreate && (
          <button onClick={createHome} disabled={busy === 'create'} className="btn-primary">
            {busy === 'create' ? 'Creating…' : '+ New home'}
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Homes" value={totals.homes} />
        <Stat label="Children (total)" value={totals.children} />
        <Stat label="Upcoming appointments" value={totals.upcomingAppointments} />
        <Stat label="Compliance alerts" value={totals.complianceAlerts} alert={totals.complianceAlerts > 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {homes.map((h) => (
          <div key={h.id} className={`card flex flex-col ${h.current ? 'ring-2 ring-brand-500' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-900">{h.name}</h3>
              {h.current && <span className="badge bg-brand-100 text-brand-800">Current</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {h.isOwner ? 'Owner' : h.role.replaceAll('_', ' ').toLowerCase()}
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <Metric label="Children" value={h.children} />
              <Metric label="Appts" value={h.upcomingAppointments} />
              <Metric label="Alerts" value={h.complianceAlerts} alert={h.complianceAlerts > 0} />
            </dl>
            <div className="mt-4">
              {h.current ? (
                <span className="btn-secondary cursor-default opacity-60">Viewing</span>
              ) : (
                <button onClick={() => openHome(h.id)} disabled={busy === h.id} className="btn-secondary">
                  {busy === h.id ? 'Opening…' : 'Open home'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        “Compliance alerts” counts licensing items marked Due soon or Expired. Open a home to manage its children,
        appointments, documents and licensing.
      </p>
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function Metric({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div>
      <dd className={`text-lg font-semibold ${alert ? 'text-red-600' : 'text-slate-800'}`}>{value}</dd>
      <dt className="text-xs text-slate-500">{label}</dt>
    </div>
  );
}
