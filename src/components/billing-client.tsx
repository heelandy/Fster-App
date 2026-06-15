'use client';

import { useState } from 'react';

interface PlanCard {
  tier: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
}

interface Props {
  currentTier: string;
  status: string;
  plans: PlanCard[];
  hasCustomer: boolean;
}

export function BillingClient({ currentTier, status, plans, hasCustomer }: Props) {
  const [interval, setInterval] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(tier: string) {
    setBusy(tier);
    setError(null);
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, interval }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok && d.url) {
      window.location.href = d.url;
    } else {
      setError(d?.error || 'Could not start checkout.');
    }
  }

  async function manage() {
    setBusy('portal');
    setError(null);
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok && d.url) window.location.href = d.url;
    else setError(d?.error || 'Could not open billing portal.');
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Billing &amp; Plans</h1>
          <p className="text-sm text-slate-600">
            Current plan: <strong>{currentTier}</strong>{' '}
            <span className="badge bg-slate-100 text-slate-600">{status}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
            <button
              onClick={() => setInterval('MONTHLY')}
              className={`rounded-md px-3 py-1 ${interval === 'MONTHLY' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('ANNUAL')}
              className={`rounded-md px-3 py-1 ${interval === 'ANNUAL' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              Annual
            </button>
          </div>
          {hasCustomer && (
            <button onClick={manage} disabled={busy === 'portal'} className="btn-secondary">
              {busy === 'portal' ? 'Opening…' : 'Manage billing'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-4">
        {plans.map((p) => {
          const cents = interval === 'ANNUAL' ? p.priceAnnual : p.priceMonthly;
          const isCurrent = p.tier === currentTier;
          return (
            <div key={p.tier} className={`card flex flex-col ${isCurrent ? 'ring-2 ring-brand-500' : ''}`}>
              <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
              <p className="mt-2 text-2xl font-bold text-brand-700">
                {cents === 0 ? 'Free' : `$${(cents / 100).toFixed(0)}`}
                {cents > 0 && <span className="text-sm font-normal text-slate-500">/{interval === 'ANNUAL' ? 'yr' : 'mo'}</span>}
              </p>
              <p className="mt-2 flex-1 text-sm text-slate-600">{p.description}</p>
              {isCurrent ? (
                <span className="btn-secondary mt-4 cursor-default">Current plan</span>
              ) : p.tier === 'FREE' ? (
                <span className="mt-4 text-center text-xs text-slate-400">Downgrade via Manage billing</span>
              ) : (
                <button onClick={() => choose(p.tier)} disabled={busy === p.tier} className="btn-primary mt-4">
                  {busy === p.tier ? 'Redirecting…' : 'Choose plan'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
