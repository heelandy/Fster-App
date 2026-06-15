'use client';

import { useEffect, useState } from 'react';

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  globalRole: string;
  isActive: boolean;
  lastLoginAt: string | null;
  _count: { memberships: number; ownedHouseholds: number };
}
interface LogRow {
  id: string;
  createdAt: string;
  actor?: { email: string } | null;
  action?: string;
  event?: string;
  ip?: string | null;
}
interface Stats {
  totals: {
    users: number;
    admins: number;
    households: number;
    children: number;
    documents: number;
    appointmentsUpcoming: number;
    newUsers7d: number;
  };
  subscriptionsByTier: Record<string, number>;
  subscriptionsByStatus: Record<string, number>;
  security24h: { failedLogins: number; accessDenied: number };
}

export function AdminClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [security, setSecurity] = useState<LogRow[]>([]);
  const [adminLogs, setAdminLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'overview' | 'users' | 'security' | 'admin'>('overview');

  useEffect(() => {
    fetch('/api/admin/stats').then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => {});
    fetch('/api/admin/users').then((r) => (r.ok ? r.json() : [])).then(setUsers).catch(() => {});
    fetch('/api/admin/audit')
      .then((r) => (r.ok ? r.json() : { admin: [], security: [] }))
      .then((d) => {
        setAdminLogs(d.admin ?? []);
        setSecurity(d.security ?? []);
      })
      .catch(() => {});
  }, []);

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Admin</h1>
      <p className="mb-6 text-sm text-slate-600">
        Manage accounts and review audit logs. Admins cannot view private child data.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabBtn('overview', 'Overview')}
        {tabBtn('users', `Users (${users.length})`)}
        {tabBtn('security', 'Security log')}
        {tabBtn('admin', 'Admin log')}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {!stats ? (
            <p className="text-sm text-slate-500">Loading overview…</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Users" value={stats.totals.users} sub={`${stats.totals.admins} admin`} />
                <Stat label="Households" value={stats.totals.households} />
                <Stat label="Children (count)" value={stats.totals.children} />
                <Stat label="Documents (count)" value={stats.totals.documents} />
                <Stat label="Upcoming appointments" value={stats.totals.appointmentsUpcoming} />
                <Stat label="New users (7d)" value={stats.totals.newUsers7d} />
                <Stat label="Failed logins (24h)" value={stats.security24h.failedLogins} />
                <Stat label="Access denied (24h)" value={stats.security24h.accessDenied} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="card">
                  <h3 className="mb-3 font-semibold text-slate-900">Subscriptions by plan</h3>
                  <Breakdown data={stats.subscriptionsByTier} />
                </div>
                <div className="card">
                  <h3 className="mb-3 font-semibold text-slate-900">Subscriptions by status</h3>
                  <Breakdown data={stats.subscriptionsByStatus} />
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Privacy note: this overview reports aggregate counts only. Admins cannot view
                individual children, documents, notes or case data.
              </p>
            </>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="card p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Households</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.name || '—'}</td>
                  <td className="px-4 py-3">{u.globalRole}</td>
                  <td className="px-4 py-3 text-slate-600">{u._count.memberships}</td>
                  <td className="px-4 py-3">{u.isActive ? '✅' : '⛔'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(tab === 'security' || tab === 'admin') && (
        <div className="card p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">{tab === 'security' ? 'Event' : 'Action'}</th>
                <th className="px-4 py-3">Actor</th>
                {tab === 'security' && <th className="px-4 py-3">IP</th>}
              </tr>
            </thead>
            <tbody>
              {(tab === 'security' ? security : adminLogs).map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-600">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-800">{l.event || l.action}</td>
                  <td className="px-4 py-3 text-slate-600">{l.actor?.email || '—'}</td>
                  {tab === 'security' && <td className="px-4 py-3 text-slate-500">{l.ip || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Breakdown({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <p className="text-sm text-slate-400">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{k.replaceAll('_', ' ')}</span>
          <span className="font-semibold text-slate-900">{v}</span>
        </li>
      ))}
    </ul>
  );
}
