'use client';

import { useEffect, useState } from 'react';

interface PlanRow {
  tier: string;
  name: string;
  priceCentsMonthly: number;
  priceCentsAnnual: number;
  limits: Record<string, number>;
  features: string[];
  stripeMonthlySet: boolean;
  stripeAnnualSet: boolean;
}

const money = (c: number) => (c === 0 ? 'Free' : `$${(c / 100).toFixed(2)}`);

/**
 * Plan catalogue view. The plans and their feature gating are the source of truth
 * in code (lib/plans.ts) and cannot be edited via data — that is intentional, so
 * entitlements can't be tampered with through the admin UI. Stripe Price IDs are
 * set in the Integrations tab.
 */
export function AdminPlans() {
  const [rows, setRows] = useState<PlanRow[] | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await fetch('/api/admin/plans');
      if (r.ok) setRows(await r.json());
    })();
  }, []);

  if (rows === null) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Plans &amp; feature gating are defined in code (source of truth, tamper-proof). Edit Stripe Price IDs in the Integrations tab.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((p) => (
          <div key={p.tier} className="card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{p.name}</h3>
              <span className="badge bg-brand-100 text-brand-800">{p.tier}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-900">{money(p.priceCentsMonthly)}<span className="text-sm font-normal text-slate-500">/mo</span></p>
            <p className="text-xs text-slate-500">{money(p.priceCentsAnnual)}/yr</p>

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
                <span className={p.stripeMonthlySet ? 'text-green-700' : 'text-red-600'}>monthly {p.stripeMonthlySet ? '✓' : '✗'}</span>{' · '}
                <span className={p.stripeAnnualSet ? 'text-green-700' : 'text-red-600'}>annual {p.stripeAnnualSet ? '✓' : '✗'}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
