'use client';

import { useEffect, useState } from 'react';

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
}
interface Invite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

export function MembersClient({ ownerId }: { ownerId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [mRes, iRes] = await Promise.all([
      fetch('/api/household/members'),
      fetch('/api/household/invites'),
    ]);
    if (mRes.ok) setMembers(await mRes.json());
    if (iRes.ok) setInvites(await iRes.json());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch('/api/household/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(fd.get('email')), role: String(fd.get('role')) }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || 'Could not send the invitation.');
      return;
    }
    const d = await res.json().catch(() => ({}));
    setNotice(d?.invited ? 'Invitation emailed. It expires in 7 days.' : 'Member added.');
    form.reset();
    await load();
  }

  async function onRemove(id: string) {
    if (!confirm('Remove this member?')) return;
    const res = await fetch(`/api/household/members/${id}`, { method: 'DELETE' });
    if (res.ok) setMembers((p) => p.filter((m) => m.id !== id));
  }

  async function onRevoke(id: string) {
    if (!confirm('Revoke this pending invitation?')) return;
    const res = await fetch(`/api/household/invites/${id}`, { method: 'DELETE' });
    if (res.ok) setInvites((p) => p.filter((i) => i.id !== id));
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Household Members</h1>
      <p className="mb-6 text-sm text-slate-600">
        Invite a co-parent or babysitter by email. If they don’t have an account yet, they’ll get a link to
        join. Co-parent and babysitter access require a Pro or Agency plan.
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
            {busy ? 'Sending…' : 'Send invite'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
        {notice && <p className="text-sm text-green-700 sm:col-span-3">{notice}</p>}
      </form>

      {invites.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Pending invitations</h2>
          <ul className="divide-y divide-slate-100">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-slate-800">{i.email}</p>
                  <p className="text-xs text-slate-500">
                    {i.role.replaceAll('_', ' ').toLowerCase()} · expires {new Date(i.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => onRevoke(i.id)} className="text-xs text-red-600 hover:underline">Revoke</button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
