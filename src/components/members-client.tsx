'use client';

import { useEffect, useState } from 'react';

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
}

export function MembersClient({ ownerId }: { ownerId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/household/members');
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/household/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(fd.get('email')), role: String(fd.get('role')) }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || 'Could not add member.');
      return;
    }
    (e.target as HTMLFormElement).reset();
    await load();
  }

  async function onRemove(id: string) {
    if (!confirm('Remove this member?')) return;
    const res = await fetch(`/api/household/members/${id}`, { method: 'DELETE' });
    if (res.ok) setMembers((p) => p.filter((m) => m.id !== id));
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Household Members</h1>
      <p className="mb-6 text-sm text-slate-600">
        Add a co-parent or babysitter. They must create an account first, then you can add them by email.
        Co-parent and babysitter access require a Pro or Agency plan.
      </p>

      <form onSubmit={onAdd} className="card mb-6 grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select id="role" name="role" className="input" defaultValue="CO_PARENT">
            <option value="CO_PARENT">Co-parent / household member</option>
            <option value="BABYSITTER">Babysitter / respite (limited)</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Adding…' : 'Add member'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
      </form>

      <div className="card p-0">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{m.user.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{m.user.email}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-brand-100 text-brand-800">{m.role.replaceAll('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.user.id !== ownerId && (
                      <button onClick={() => onRemove(m.id)} className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    )}
                    {m.user.id === ownerId && <span className="text-xs text-slate-400">Owner</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
