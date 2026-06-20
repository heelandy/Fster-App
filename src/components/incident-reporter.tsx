'use client';

import { useCallback, useEffect, useState } from 'react';

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  resolution: string | null;
  createdAt: string;
}

const SEV_BADGE: Record<string, string> = { HIGH: 'bg-red-100 text-red-800', MEDIUM: 'bg-amber-100 text-amber-800', LOW: 'bg-slate-100 text-slate-600' };

/**
 * Foster-parent incident reporting. Report an incident about a placement; the
 * agency's case worker reviews and escalates / resolves it. Shows the status the
 * agency has set so the foster parent can follow it.
 */
export function IncidentReporter() {
  const [items, setItems] = useState<Incident[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/incidents');
    if (r.ok) setItems(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { title: String(fd.get('title')), severity: String(fd.get('severity') || 'LOW') };
    const desc = String(fd.get('description') || '').trim();
    if (desc) body.description = desc;
    const res = await fetch('/api/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const x = await res.json().catch(() => ({})); setErr(x?.error || 'Could not report the incident.'); return; }
    (e.target as HTMLFormElement).reset();
    setOpen(false);
    await load();
  }

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Incidents</h2>
        {!open && <button onClick={() => setOpen(true)} className="text-sm font-medium text-brand-700 hover:underline">+ Report an incident</button>}
      </div>
      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
      {open && (
        <form onSubmit={submit} className="card mb-3 space-y-2">
          <input name="title" required placeholder="What happened? (title) *" className="input" />
          <select name="severity" defaultValue="LOW" className="input max-w-[12rem]">
            <option value="LOW">Low severity</option>
            <option value="MEDIUM">Medium severity</option>
            <option value="HIGH">High severity</option>
          </select>
          <textarea name="description" placeholder="Details (optional)" rows={3} className="input" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Reporting…' : 'Report'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}
      {items === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card text-sm text-slate-500">No incidents reported. Use “Report an incident” if something needs your agency’s attention.</div>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{i.title} <span className={`ml-1 badge ${SEV_BADGE[i.severity] ?? 'bg-slate-100 text-slate-600'}`}>{i.severity.toLowerCase()}</span></p>
                  <p className="text-xs text-slate-500">Reported {new Date(i.createdAt).toLocaleDateString()}</p>
                  {i.description && <p className="mt-1 text-sm text-slate-700">{i.description}</p>}
                  {i.resolution && <p className="mt-1 text-sm text-slate-500"><span className="font-medium">Agency:</span> {i.resolution}</p>}
                </div>
                <span className="badge bg-brand-100 text-brand-800">{i.status.replaceAll('_', ' ').toLowerCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
