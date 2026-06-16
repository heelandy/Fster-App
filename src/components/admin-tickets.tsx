'use client';

import { useEffect, useState, useCallback } from 'react';
import { StatusBadge, PriorityBadge, TicketThread, TICKET_STATUSES, type TicketMessage } from './ticket-shared';

interface TicketSummary {
  id: string;
  subject: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
  lastMessageAt: string;
  user: { email: string; name: string | null };
  _count: { messages: number };
}
interface TicketDetail extends TicketSummary { messages: TicketMessage[] }

export function AdminTickets() {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [active, setActive] = useState<TicketDetail | null>(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (status = '') => {
    const res = await fetch(`/api/admin/tickets${status ? `?status=${status}` : ''}`);
    if (res.ok) setTickets(await res.json());
  }, []);

  useEffect(() => { void load(filter); }, [load, filter]);

  async function open(id: string) {
    const res = await fetch(`/api/admin/tickets/${id}`);
    if (res.ok) setActive(await res.json());
  }

  async function reply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active) return;
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch(`/api/admin/tickets/${active.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: String(fd.get('body')) }),
    });
    setBusy(false);
    if (res.ok) { form.reset(); await open(active.id); await load(filter); }
  }

  async function setStatus(status: string) {
    if (!active) return;
    const res = await fetch(`/api/admin/tickets/${active.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { await open(active.id); await load(filter); }
  }

  if (active) {
    return (
      <div className="card">
        <button onClick={() => setActive(null)} className="mb-4 text-sm text-brand-700 hover:underline">← All tickets</button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{active.subject}</h2>
            <p className="text-xs text-slate-500">{active.user.email}{active.user.name ? ` · ${active.user.name}` : ''}</p>
          </div>
          <PriorityBadge priority={active.priority} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          {TICKET_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded px-2 py-1 text-xs font-medium ${active.status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s.toLowerCase()}
            </button>
          ))}
        </div>

        <TicketThread messages={active.messages} staffLabel="🛟 Staff" userLabel="👤 User" />

        <form onSubmit={reply} className="mt-4 space-y-2">
          <textarea name="body" required rows={3} className="input" placeholder="Reply to the user…" />
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Sending…' : 'Send reply'}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter('')} className={`rounded px-3 py-1 text-sm ${filter === '' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>All</button>
        {TICKET_STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded px-3 py-1 text-sm ${filter === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {s.toLowerCase()}
          </button>
        ))}
      </div>
      {tickets === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : tickets.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">No tickets{filter ? ` with status ${filter.toLowerCase()}` : ''}.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Subject</th>
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} onClick={() => open(t.id)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-3 font-medium text-slate-800">{t.subject}</td>
                  <td className="px-3 py-3 text-slate-600">{t.user.email}</td>
                  <td className="px-3 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-3 py-3 text-slate-500">{new Date(t.lastMessageAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
