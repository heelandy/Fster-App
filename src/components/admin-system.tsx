'use client';

import { useEffect, useState, useCallback } from 'react';

interface Health {
  db: { ok: boolean; latencyMs: number };
  storage: { dir: string; files: number; bytes: number; writable: boolean; capped?: boolean; maxUploadBytes: number };
  runtime: { node: string; uptimeSeconds: number; rssBytes: number; heapUsedBytes: number; platform: string; env: string };
  integrations: { stripe: boolean; email: boolean; cronConfigured: boolean };
  queues: { openTickets: number; unreadNotifications: number };
  configWarnings: { level: 'critical' | 'warning'; message: string }[];
  checkedAt: string;
}

function mb(bytes: number) { return `${(bytes / 1_048_576).toFixed(1)} MB`; }
function uptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Dot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />;
}

function Row({ label, value, status }: { label: string; value: React.ReactNode; status?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="flex items-center gap-2 font-medium text-slate-900">
        {status !== undefined && <Dot ok={status} />}{value}
      </span>
    </div>
  );
}

export function AdminSystem() {
  const [data, setData] = useState<Health | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/health')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (err) return <div className="card text-sm text-slate-500">You don’t have permission to view system health, or it failed to load.</div>;
  if (!data) return <p className="text-sm text-slate-500">Checking system health…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Checked {new Date(data.checkedAt).toLocaleString()}</p>
        <button onClick={load} className="btn-secondary">Refresh</button>
      </div>

      {data.configWarnings.length > 0 && (
        <div className="card border-l-4 border-amber-400">
          <h3 className="mb-2 font-semibold text-slate-900">Configuration checks</h3>
          <ul className="space-y-1 text-sm">
            {data.configWarnings.map((c, i) => (
              <li key={i} className={c.level === 'critical' ? 'text-red-700' : 'text-amber-700'}>
                {c.level === 'critical' ? '🔴' : '🟠'} {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 font-semibold text-slate-900">Database</h3>
          <Row label="Connection" value={data.db.ok ? 'Healthy' : 'Down'} status={data.db.ok} />
          <Row label="Query latency" value={`${data.db.latencyMs} ms`} status={data.db.latencyMs < 200} />
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold text-slate-900">File storage</h3>
          <Row label="Writable" value={data.storage.writable ? 'Yes' : 'No'} status={data.storage.writable} />
          <Row label="Files stored" value={`${data.storage.files}${data.storage.capped ? '+' : ''}`} />
          <Row label="Total size" value={mb(data.storage.bytes)} />
          <Row label="Max upload" value={mb(data.storage.maxUploadBytes)} />
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold text-slate-900">Runtime</h3>
          <Row label="Node" value={data.runtime.node} />
          <Row label="Environment" value={data.runtime.env} />
          <Row label="Uptime" value={uptime(data.runtime.uptimeSeconds)} />
          <Row label="Memory (RSS)" value={mb(data.runtime.rssBytes)} />
          <Row label="Heap used" value={mb(data.runtime.heapUsedBytes)} />
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold text-slate-900">Integrations &amp; queues</h3>
          <Row label="Stripe billing" value={data.integrations.stripe ? 'Configured' : 'Not set'} status={data.integrations.stripe} />
          <Row label="Email delivery" value={data.integrations.email ? 'Configured' : 'Dev (log only)'} status={data.integrations.email} />
          <Row label="Reminder cron" value={data.integrations.cronConfigured ? 'Configured' : 'Not set'} status={data.integrations.cronConfigured} />
          <Row label="Open tickets" value={data.queues.openTickets} />
          <Row label="Unread notifications" value={data.queues.unreadNotifications} />
        </div>
      </div>
    </div>
  );
}
