'use client';

import { useEffect, useState, useCallback } from 'react';
import { StatusBadge, TicketThread, type TicketMessage } from './ticket-shared';

interface TicketSummary {
  id: string;
  subject: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
  lastMessageAt: string;
  _count: { messages: number };
}

interface TicketDetail extends TicketSummary {
  messages: TicketMessage[];
}

export function SupportClient() {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [view, setView] = useState<'list' | 'new'>('list');
  const [active, setActive] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch('/api/support/tickets');
    if (res.ok) setTickets(await res.json());
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  async function openTicket(id: string) {
    setError(null);
    const res = await fetch(`/api/support/tickets/${id}`);
    if (res.ok) { setActive(await res.json()); setView('list'); }
  }

  async function createTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: String(fd.get('subject')),
        message: String(fd.get('message')),
        priority: String(fd.get('priority')),
      }),
    });
    setBusy(false);
    if (!res.ok) { setError('Could not create the ticket. Please try again.'); return; }
    const created = await res.json();
    await loadList();
    await openTicket(created.id);
    setView('list');
  }

  async function reply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active) return;
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch(`/api/support/tickets/${active.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: String(fd.get('body')) }),
    });
    setBusy(false);
    if (res.ok) { form.reset(); await openTicket(active.id); await loadList(); }
  }

  // ── Thread view ──
  if (active) {
    return (
      <div className="card">
        <button onClick={() => setActive(null)} className="mb-4 text-sm text-brand-700 hover:underline">← All tickets</button>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{active.subject}</h2>
          <StatusBadge status={active.status} />
        </div>
        <TicketThread messages={active.messages} staffLabel="🛟 Support team" userLabel="You" />
        {active.status !== 'CLOSED' ? (
          <form onSubmit={reply} className="mt-4 space-y-2">
            <textarea name="body" required rows={3} className="input" placeholder="Write a reply…" />
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Sending…' : 'Send reply'}</button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-500">This ticket is closed. Open a new one if you still need help.</p>
        )}
      </div>
    );
  }

  // ── New ticket view ──
  if (view === 'new') {
    return (
      <div className="card">
        <button onClick={() => setView('list')} className="mb-4 text-sm text-brand-700 hover:underline">← Cancel</button>
        <h2 className="text-lg font-semibold text-slate-900">New ticket</h2>
        <form onSubmit={createTicket} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="subject">Subject</label>
            <input id="subject" name="subject" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="priority">Priority</label>
            <select id="priority" name="priority" defaultValue="NORMAL" className="input">
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="message">How can we help?</label>
            <textarea id="message" name="message" required rows={5} className="input" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Submitting…' : 'Submit ticket'}</button>
        </form>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      <button onClick={() => setView('new')} className="btn-primary">New ticket</button>
      {tickets === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : tickets.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">No tickets yet. Open one if you need a hand.</div>
      ) : (
        <div className="card divide-y divide-slate-100 p-0">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => openTicket(t.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{t.subject}</p>
                <p className="text-xs text-slate-500">
                  {t._count.messages} message{t._count.messages === 1 ? '' : 's'} · updated {new Date(t.lastMessageAt).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge status={t.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
