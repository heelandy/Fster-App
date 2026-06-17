'use client';

import { useState } from 'react';

interface Home {
  id: string;
  name: string;
  current: boolean;
}

/**
 * Active-home selector for agency / multi-home users. Posts to the verified
 * switch endpoint, then reloads so server components re-read the new household.
 * Renders nothing when the user has only one home.
 */
export function HomeSwitcher({ homes }: { homes: Home[] }) {
  const [busy, setBusy] = useState(false);
  if (homes.length <= 1) return null;

  async function switchTo(id: string) {
    if (busy) return;
    setBusy(true);
    const res = await fetch('/api/household/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId: id }),
    });
    if (res.ok) window.location.href = '/dashboard';
    else setBusy(false);
  }

  return (
    <select
      aria-label="Switch home"
      disabled={busy}
      value={homes.find((h) => h.current)?.id ?? ''}
      onChange={(e) => switchTo(e.target.value)}
      className="input mt-2 py-1 text-xs"
    >
      {homes.map((h) => (
        <option key={h.id} value={h.id}>{h.name}{h.current ? ' • current' : ''}</option>
      ))}
    </select>
  );
}
