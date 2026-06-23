'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';

export interface OversightRequestItem {
  id: string;
  agencyName: string;
}

/**
 * Agency oversight requests waiting for the foster parent. An agency asked to oversee
 * this home; the parent approves (links the home, sharing its data) or denies. Until
 * approval, the agency sees nothing of this home. Mirrors PendingPlacements.
 */
export function PendingOversightRequests({ items }: { items: OversightRequestItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function respond(id: string, decision: 'APPROVED' | 'DENIED') {
    if (decision === 'DENIED' && !confirm('Deny this agency? They will not be able to see your home.')) return;
    setBusy(id);
    setErr(null);
    const res = await fetch(`/api/oversight-requests/${id}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    setBusy(null);
    if (!res.ok) {
      const x = await res.json().catch(() => ({}));
      setErr(x?.error || 'Could not save your response.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="mb-8">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Agency oversight requests</h2>
      <p className="mb-3 text-sm text-slate-600">
        An agency is asking to oversee your home. They can only see your home&rsquo;s data after you approve.
      </p>
      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
      <div className="space-y-3">
        {items.map((r) => (
          <div key={r.id} className="card border-brand-200 bg-brand-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-brand-600" />
                <div>
                  <p className="font-semibold text-slate-900">{r.agencyName}</p>
                  <p className="text-xs text-slate-600">wants to oversee your foster home</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button disabled={busy === r.id} onClick={() => respond(r.id, 'APPROVED')} className="btn-primary">
                  {busy === r.id ? '…' : 'Approve'}
                </button>
                <button disabled={busy === r.id} onClick={() => respond(r.id, 'DENIED')} className="btn-secondary">
                  Deny
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Lets the foster parent end their current agency's oversight. Clears the link so the
 * agency immediately loses access to this home.
 */
export function RevokeOversight({ agencyName }: { agencyName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function revoke() {
    if (!confirm(`Remove ${agencyName}'s oversight of your home? They will immediately lose access.`)) return;
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/oversight-requests/revoke', { method: 'POST' });
    setBusy(false);
    if (!res.ok) {
      const x = await res.json().catch(() => ({}));
      setErr(x?.error || 'Could not remove oversight.');
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start">
      {err && <span className="mb-1 text-xs text-red-600">{err}</span>}
      <button onClick={revoke} disabled={busy} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {busy ? 'Removing…' : 'Remove agency oversight'}
      </button>
    </span>
  );
}
