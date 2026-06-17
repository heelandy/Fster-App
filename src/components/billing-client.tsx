'use client';

import { useState, useEffect } from 'react';
import { CountdownRedirect } from './countdown-redirect';

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
  interval: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  plans: PlanCard[];
  hasCustomer: boolean;
}

export function BillingClient({
  currentTier,
  status,
  interval: currentInterval,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  trialEndsAt,
  plans,
  hasCustomer,
}: Props) {
  const [interval, setInterval] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [checking, setChecking] = useState(false);

  // While a payment tab is open, pull the subscription from Stripe every few
  // seconds (webhook-free). As soon as the plan changes, send the user to the
  // dashboard — that's the post-purchase auto-redirect + upgrade.
  useEffect(() => {
    if (!awaitingPayment) return;
    let live = true;
    let tries = 0;
    // NOTE: `setInterval` is shadowed by the billing-interval state setter above,
    // so call the timer functions via `window.` explicitly.
    const id = window.setInterval(async () => {
      tries += 1;
      try {
        const res = await fetch('/api/stripe/sync', { method: 'POST' });
        if (res.ok) {
          const d = await res.json();
          if (live && d.tier && d.tier !== currentTier) {
            window.clearInterval(id);
            window.location.href = '/dashboard?upgraded=1';
            return;
          }
        }
      } catch {
        /* keep polling */
      }
      if (tries >= 30) window.clearInterval(id); // give up after ~2 min
    }, 4000);
    return () => { live = false; window.clearInterval(id); };
  }, [awaitingPayment, currentTier]);

  async function checkNow() {
    setChecking(true);
    try {
      const res = await fetch('/api/stripe/sync', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.tier && d.tier !== currentTier) { window.location.href = '/dashboard?upgraded=1'; return; }
    } catch { /* ignore */ }
    setChecking(false);
    window.location.reload();
  }

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
      // Open payment in a NEW tab so the app stays put; the payment tab shows a
      // "you can close this" confirmation on return. If the popup is blocked,
      // fall back to a same-tab redirect.
      const win = window.open(d.url, '_blank', 'noopener,noreferrer');
      if (win) setAwaitingPayment(true);
      else window.location.href = d.url;
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

      {awaitingPayment && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          💳 Payment opened in a new tab. Complete it there — once it’s done you’ll be taken to your
          dashboard automatically.{' '}
          <button onClick={checkNow} disabled={checking} className="font-medium underline disabled:opacity-50">
            {checking ? 'Checking…' : 'I’ve paid — check now'}
          </button>
        </div>
      )}

      {currentTier !== 'FREE' && (
        <div className="card mb-6">
          <h2 className="font-semibold text-slate-900">Your subscription</h2>
          <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Plan</p>
              <p className="text-slate-800">{currentTier} · {currentInterval.toLowerCase()}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">
                {cancelAtPeriodEnd ? 'Access until' : 'Renews on'}
              </p>
              <p className="text-slate-800">
                {currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Status</p>
              <p className="text-slate-800">{status}</p>
            </div>
          </div>

          {trialEndsAt && new Date(trialEndsAt) > new Date() && (
            <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              🎁 Trial active until {new Date(trialEndsAt).toLocaleDateString()}.
            </p>
          )}
          {cancelAtPeriodEnd && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Your plan is set to cancel at the end of the period. Use “Manage billing” to resume.
            </p>
          )}
          {(status === 'GRACE' || status === 'PAST_DUE') && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              ⚠️ There’s a payment issue. Update your payment method in “Manage billing” to avoid losing access.
            </p>
          )}

          <p className="mt-3 text-xs text-slate-500">
            Use <strong>Manage billing</strong> to update your payment method, change or cancel your plan,
            resume a cancellation, and download invoices &amp; receipts.
          </p>
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-slate-900">Plans</h2>
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
