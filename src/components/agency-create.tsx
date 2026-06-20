'use client';

import { useState } from 'react';

export function AgencyCreate() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/agency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: String(fd.get('name')) }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || 'Could not create the agency.');
      return;
    }
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <h1 className="text-xl font-semibold text-slate-900">Create your agency</h1>
        <p className="mt-1 text-sm text-slate-600">
          An agency oversees multiple foster homes and employs case workers. You’ll be its first administrator.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="name">Agency name</label>
            <input id="name" name="name" required className="input" placeholder="e.g. Hope Foster Agency" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create agency'}</button>
        </form>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">
        Already part of an agency? Ask an administrator to add you as staff.
      </p>
    </div>
  );
}
