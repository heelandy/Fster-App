'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || 'Could not accept the invitation.');
      setBusy(false);
      return;
    }
    // Switch the active household to the one we just joined, then go to the dashboard.
    const data = await res.json().catch(() => ({}));
    if (data?.householdId) {
      await fetch('/api/household/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId: data.householdId }),
      }).catch(() => {});
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button onClick={accept} disabled={busy} className="btn-primary">
        {busy ? 'Joining…' : 'Accept invitation'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
