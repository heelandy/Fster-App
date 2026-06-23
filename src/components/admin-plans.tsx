'use client';

import { useEffect, useState } from 'react';

interface PlanRow {
  tier: string;
  name: string;
  description: string;
  isActive: boolean;
  priceCentsMonthly: number;
  priceCentsAnnual: number;
  limits: Record<string, number>;
  features: string[];
  stripeMonthlySet: boolean;
  stripeAnnualSet: boolean;
}

const money = (c: number) => (c === 0 ? 'Free' : `$${(c / 100).toFixed(2)}`);
const dollars = (c: number) => (c / 100).toFixed(2);

/**
 * Plan catalogue. SUPER_ADMIN can edit the commercial fields (name, description,
 * displayed prices, active) — persisted as a DB override over the code defaults.
 * Limits & feature gating stay in code (tamper-proof) and are shown read-only.
 * The displayed price is marketing copy; the real charge is the Stripe Price set in
 * the Integrations tab.
 */
export function AdminPlans() {
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/admin/plans');
    if (r.ok) {
      const d = (await r.json()) as { canEdit: boolean; plans: PlanRow[] };
      setRows(d.plans);
      setCanEdit(d.canEdit);
    }
  }
  useEffect(() => { void load(); }, []);

  async function save(tier: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    const syncStripe = fd.get('syncStripe') === 'on';
    if (syncStripe && !confirm('Also update the live price in Stripe? This creates a new Stripe Price for the new amount (used for new checkouts). Current subscribers keep their existing price.')) {
      return;
    }
    setSaving(true);
    const payload = {
      tier,
      name: String(fd.get('name') || ''),
      description: String(fd.get('description') || ''),
      priceCentsMonthly: Math.round(Number(fd.get('priceMonthly') || 0) * 100),
      priceCentsAnnual: Math.round(Number(fd.get('priceAnnual') || 0) * 100),
      isActive: fd.get('isActive') === 'on',
      syncStripe,
    };
    const r = await fetch('/api/admin/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const fieldErr = d?.fields ? Object.values(d.fields).flat()[0] : null;
      setError((fieldErr as string) || d?.error || 'Could not save the plan.');
      return;
    }
    setEditing(null);
    if (d?.stripe) {
      if (d.stripe.ok) setNotice(d.stripe.note);
      else setError(d.stripe.note);
    }
    await load();
  }

  if (rows === null) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        {canEdit
          ? 'Names, descriptions and displayed prices are editable. Limits & feature gating are defined in code (tamper-proof). The displayed price is marketing copy — the actual charge is the Stripe Price set in the Integrations tab.'
          : 'Plans & feature gating are defined in code (source of truth, tamper-proof). Editing is restricted to super admins.'}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((p) => (
          <div key={p.tier} className="card">
            {editing === p.tier ? (
              <form onSubmit={(e) => save(p.tier, e)} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="badge bg-brand-100 text-brand-800">{p.tier}</span>
                </div>
                <div>
                  <label className="label" htmlFor={`name-${p.tier}`}>Name</label>
                  <input id={`name-${p.tier}`} name="name" defaultValue={p.name} required className="input" />
                </div>
                <div>
                  <label className="label" htmlFor={`desc-${p.tier}`}>Description</label>
                  <textarea id={`desc-${p.tier}`} name="description" rows={2} defaultValue={p.description} className="input" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor={`pm-${p.tier}`}>$ / mo</label>
                    <input id={`pm-${p.tier}`} name="priceMonthly" type="number" step="0.01" min="0" defaultValue={dollars(p.priceCentsMonthly)} className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor={`pa-${p.tier}`}>$ / yr</label>
                    <input id={`pa-${p.tier}`} name="priceAnnual" type="number" step="0.01" min="0" defaultValue={dollars(p.priceCentsAnnual)} className="input" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="isActive" defaultChecked={p.isActive} /> Active
                </label>
                {p.tier !== 'FREE' && (
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="syncStripe" className="mt-0.5" />
                    <span>
                      Also update the live price in Stripe
                      <span className="block text-xs text-slate-400">Creates a new Stripe Price for changed amounts. Current subscribers keep their price.</span>
                    </span>
                  </label>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Save'}</button>
                  <button type="button" onClick={() => { setEditing(null); setError(null); }} className="btn-secondary text-sm">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{p.name}</h3>
                  <span className="badge bg-brand-100 text-brand-800">{p.tier}</span>
                </div>
                {!p.isActive && <span className="badge mt-1 bg-slate-200 text-slate-600">inactive</span>}
                <p className="mt-1 text-2xl font-bold text-slate-900">{money(p.priceCentsMonthly)}<span className="text-sm font-normal text-slate-500">/mo</span></p>
                <p className="text-xs text-slate-500">{money(p.priceCentsAnnual)}/yr</p>
                {p.description && <p className="mt-2 text-xs text-slate-600">{p.description}</p>}

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Limits</p>
                <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                  {Object.entries(p.limits).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span>{v < 0 ? '∞' : v}</span></li>
                  ))}
                </ul>

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Features ({p.features.length})</p>
                <p className="mt-1 text-xs text-slate-600">{p.features.length ? p.features.join(', ') : '—'}</p>

                {p.tier !== 'FREE' && (
                  <p className="mt-3 text-xs">
                    Stripe price:{' '}
                    <span className={p.stripeMonthlySet ? 'text-green-700' : 'text-red-600'}>monthly {p.stripeMonthlySet ? 'set' : 'missing'}</span>{' · '}
                    <span className={p.stripeAnnualSet ? 'text-green-700' : 'text-red-600'}>annual {p.stripeAnnualSet ? 'set' : 'missing'}</span>
                  </p>
                )}

                {canEdit && (
                  <button onClick={() => { setEditing(p.tier); setError(null); }} className="btn-secondary mt-4 w-full text-sm">Edit</button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
