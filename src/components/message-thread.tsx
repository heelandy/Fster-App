'use client';

import { useCallback, useEffect, useState } from 'react';

interface Msg { id: string; body: string; fromAgency: boolean; createdAt: string }

/** Foster parent's secure message thread with their agency. */
export function MessageThread() {
  const [items, setItems] = useState<Msg[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/messages');
    if (r.ok) setItems(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get('body') || '').trim();
    if (!body) return;
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    if (!res.ok) { const x = await res.json().catch(() => ({})); setErr(x?.error || 'Could not send.'); return; }
    (e.target as HTMLFormElement).reset();
    await load();
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Messages with your agency</h2>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <div className="card">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {items === null ? <p className="text-sm text-slate-400">Loading…</p> : items.length === 0 ? (
            <p className="text-sm text-slate-400">No messages yet.</p>
          ) : items.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${m.fromAgency ? 'bg-slate-100 text-slate-800' : 'ml-auto bg-brand-100 text-brand-900'}`}>
              <p>{m.body}</p>
              <p className="text-[10px] text-slate-500">{m.fromAgency ? 'Agency' : 'You'} · {new Date(m.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input name="body" placeholder="Write a message…" className="input flex-1" />
          <button className="btn-secondary">Send</button>
        </form>
      </div>
    </div>
  );
}
