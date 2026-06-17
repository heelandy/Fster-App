'use client';

import { useEffect, useState, useCallback } from 'react';

interface PaymentRow {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  refundable: boolean;
  tier: string;
  householdId: string | null;
  householdName: string | null;
  ownerEmail: string | null;
  stripeCustomerId: string | null;
}

const money = (cents: number, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

export function AdminFinance() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/admin/payments');
    if (res.ok) setPayments(await res.json());
    else if (res.status === 403) setError('You do not have permission to view finance.');
    else setError('Could not load payments.');
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function refund(p: PaymentRow) {
    const input = prompt(
      `Refund ${p.ownerEmail ?? 'customer'} — ${money(p.amountCents, p.currency)}.\nLeave blank for a FULL refund, or enter an amount in dollars for a partial refund:`,
      '',
    );
    if (input === null) return;
    const trimmed = input.trim();
    let amountCents: number | undefined;
    if (trimmed) {
      const dollars = Number(trimmed);
      if (!Number.isFinite(dollars) || dollars <= 0) { alert('Enter a valid dollar amount.'); return; }
      amountCents = Math.round(dollars * 100);
    }
    if (!confirm(`Confirm refund of ${amountCents ? money(amountCents, p.currency) : 'the full amount'}?`)) return;
    setBusy(p.id);
    const res = await fetch(`/api/admin/payments/${p.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(amountCents ? { amountCents } : {}),
    });
    setBusy(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d?.error || 'Refund failed.'); return; }
    await load();
  }

  async function credit(p: PaymentRow) {
    if (!p.householdId) { alert('No household linked to this payment.'); return; }
    const input = prompt(`Apply an account credit to ${p.householdName ?? 'this household'} (dollars):`, '');
    if (input === null) return;
    const dollars = Number(input.trim());
    if (!Number.isFinite(dollars) || dollars <= 0) { alert('Enter a valid dollar amount.'); return; }
    const note = prompt('Optional note (shown on the customer balance):', '') ?? undefined;
    setBusy(p.id);
    const res = await fetch('/api/admin/payments/credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId: p.householdId, amountCents: Math.round(dollars * 100), note }),
    });
    setBusy(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d?.error || 'Credit failed.'); return; }
    alert('Credit applied to the customer balance.');
  }

  return (
    <div className="space-y-6">
      <ReportExport />

      <div>
        <h3 className="mb-3 font-semibold text-slate-900">Recent payments</h3>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {payments === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : payments.length === 0 ? (
          <div className="card text-center text-sm text-slate-500">No payments recorded yet.</div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Household / customer</th>
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3 text-slate-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-800">{p.householdName ?? '—'}</p>
                      <p className="text-xs text-slate-500">{p.ownerEmail ?? '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{p.tier}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{money(p.amountCents, p.currency)}</td>
                    <td className="px-3 py-3">
                      {p.status === 'succeeded' ? <span className="badge bg-green-100 text-green-700">Paid</span>
                        : p.status === 'refunded' ? <span className="badge bg-slate-200 text-slate-600">Refunded</span>
                        : p.status === 'partially_refunded' ? <span className="badge bg-amber-100 text-amber-700">Partial refund</span>
                        : <span className="badge bg-red-100 text-red-700">{p.status}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {p.refundable && (
                          <button disabled={busy === p.id} onClick={() => refund(p)} className="text-red-700 hover:underline disabled:opacity-50">Refund</button>
                        )}
                        {p.stripeCustomerId && (
                          <button disabled={busy === p.id} onClick={() => credit(p)} className="text-brand-700 hover:underline disabled:opacity-50">Apply credit</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Refunds and credits are processed by Stripe. Card data never touches this server.
        </p>
      </div>
    </div>
  );
}

function ReportExport() {
  const types: { key: string; label: string }[] = [
    { key: 'users', label: 'Users' },
    { key: 'subscriptions', label: 'Subscriptions' },
    { key: 'revenue', label: 'Revenue' },
  ];
  return (
    <div className="card">
      <h3 className="mb-1 font-semibold text-slate-900">Export reports (CSV)</h3>
      <p className="mb-3 text-xs text-slate-400">Account &amp; billing metadata only — no child or case data.</p>
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <a key={t.key} href={`/api/admin/reports/export?type=${t.key}`} className="btn-secondary">⬇ {t.label}</a>
        ))}
      </div>
    </div>
  );
}
