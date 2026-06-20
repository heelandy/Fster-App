'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface PendingPlacement {
  placementId: string;
  childName: string;
  trialEndDate: string | null;
  agency: string | null;
}

/**
 * Placement requests waiting for the foster parent. A case worker assigned the
 * child to this home; the parent accepts (starts the trial) or declines. The Y/N
 * is recorded server-side on the placement.
 */
export function PendingPlacements({ items }: { items: PendingPlacement[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function respond(placementId: string, decision: 'ACCEPTED' | 'DECLINED') {
    if (decision === 'DECLINED' && !confirm('Decline this placement? The child will not be placed in your home.')) return;
    setBusy(placementId);
    setErr(null);
    const res = await fetch(`/api/placements/${placementId}/respond`, {
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

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { timeZone: 'UTC' }) : '—');

  return (
    <div className="mb-8">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Placement requests</h2>
      <p className="mb-3 text-sm text-slate-600">
        A case worker assigned {items.length === 1 ? 'a child' : `${items.length} children`} to your home. Review and respond.
      </p>
      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
      <div className="space-y-3">
        {items.map((p) => (
          <div key={p.placementId} className="card border-amber-200 bg-amber-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{p.childName}</p>
                <p className="text-xs text-slate-600">
                  {p.agency ? `From ${p.agency} · ` : ''}Trial through {fmt(p.trialEndDate)}
                </p>
              </div>
              <div className="flex gap-2">
                <button disabled={busy === p.placementId} onClick={() => respond(p.placementId, 'ACCEPTED')} className="btn-primary">
                  {busy === p.placementId ? '…' : 'Accept'}
                </button>
                <button disabled={busy === p.placementId} onClick={() => respond(p.placementId, 'DECLINED')} className="btn-secondary">
                  Decline
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
