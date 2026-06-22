'use client';

import { useState } from 'react';

export function AcceptAgencyInviteButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/agency/invites/accept', {
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
    // Hard navigation so the agency portal reads the new membership cleanly.
    window.location.href = '/agency';
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
