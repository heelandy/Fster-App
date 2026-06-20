'use client';

import { useEffect, useState } from 'react';
import { AdminTickets } from './admin-tickets';
import { AdminAnalytics } from './admin-analytics';
import { AdminSystem } from './admin-system';
import { AdminIntegrations } from './admin-integrations';
import { AdminFinance } from './admin-finance';
import { AdminPlans } from './admin-plans';

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  globalRole: string;
  adminRole: string | null;
  isActive: boolean;
  isBanned: boolean;
  internalNote: string | null;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  deletedAt: string | null;
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
interface Notif {
  id: string;
  type: string;
  message: string;
  level: string;
  isRead: boolean;
  createdAt: string;
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
    revenueCents: number;
    paymentIssues: number;
    unreadNotifications: number;
  };
  subscriptionsByTier: Record<string, number>;
  subscriptionsByStatus: Record<string, number>;
  security24h: { failedLogins: number; accessDenied: number };
}

const ADMIN_ROLES = ['', 'READ_ONLY', 'SUPPORT', 'MODERATOR', 'MANAGER', 'FINANCE_ADMIN', 'ADMIN', 'SUPER_ADMIN'];

type Tab = 'overview' | 'users' | 'tickets' | 'analytics' | 'finance' | 'plans' | 'notifications' | 'settings' | 'integrations' | 'system' | 'security' | 'admin';

export function AdminClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [security, setSecurity] = useState<LogRow[]>([]);
  const [adminLogs, setAdminLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  async function loadUsers(q = '') {
    const res = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    if (res.ok) setUsers(await res.json());
  }
  async function loadNotifs() {
    const res = await fetch('/api/admin/notifications');
    if (res.ok) setNotifs(await res.json());
  }
  async function loadSettings() {
    const res = await fetch('/api/admin/settings');
    if (res.ok) setSettings(await res.json());
  }

  useEffect(() => {
    fetch('/api/admin/stats').then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => {});
    loadUsers();
    loadNotifs();
    loadSettings();
    fetch('/api/admin/audit')
      .then((r) => (r.ok ? r.json() : { admin: [], security: [] }))
      .then((d) => {
        setAdminLogs(d.admin ?? []);
        setSecurity(d.security ?? []);
      })
      .catch(() => {});
  }, []);

  async function userAction(id: string, action: string, value?: string, extra?: Record<string, unknown>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, value, ...extra }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d?.error || 'Action failed.');
      return;
    }
    await loadUsers(query);
    if (action === 'sendPasswordReset') alert('Password-reset email sent.');
  }
  function editUser(u: AdminUser) {
    const name = prompt('Name:', u.name ?? '');
    if (name === null) return;
    const email = prompt('Email:', u.email);
    if (email === null) return;
    void userAction(u.id, 'editProfile', undefined, { name, email });
  }
  async function createUser() {
    const email = prompt('New user email:');
    if (!email) return;
    const name = prompt('Name:', '');
    if (name === null) return;
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d?.error || 'Could not create the user.');
      return;
    }
    alert('User created. A set-password email has been sent.');
    await loadUsers(query);
  }
  async function deleteUser(id: string) {
    if (!confirm('Delete this user? Their account is deactivated and retained for recovery (soft delete). You can restore it later.')) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d?.error || 'Delete failed.');
      return;
    }
    await loadUsers(query);
  }
  async function saveSetting(key: string, value: string) {
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (res.ok) setSettings(await res.json());
    else alert('Could not save setting.');
  }
  async function markNotif(id?: string, all?: boolean) {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(all ? { all: true } : { id }),
    });
    await loadNotifs();
  }

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  );

  const unread = stats?.totals.unreadNotifications ?? notifs.filter((n) => !n.isRead).length;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Admin</h1>
      <p className="mb-6 text-sm text-slate-600">
        Manage accounts, settings and the platform. Admins cannot view private child data.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabBtn('overview', 'Overview')}
        {tabBtn('users', `Users (${users.length})`)}
        {tabBtn('tickets', 'Tickets')}
        {tabBtn('analytics', 'Analytics')}
        {tabBtn('finance', 'Finance')}
        {tabBtn('plans', 'Plans')}
        {tabBtn('notifications', `Notifications${unread ? ` (${unread})` : ''}`)}
        {tabBtn('settings', 'Settings')}
        {tabBtn('integrations', 'Integrations')}
        {tabBtn('system', 'System')}
        {tabBtn('security', 'Security log')}
        {tabBtn('admin', 'Admin log')}
      </div>

      {tab === 'tickets' && <AdminTickets />}
      {tab === 'analytics' && <AdminAnalytics />}
      {tab === 'finance' && <AdminFinance />}
      {tab === 'plans' && <AdminPlans />}
      {tab === 'integrations' && <AdminIntegrations />}
      {tab === 'system' && <AdminSystem />}

      {tab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Users" value={stats.totals.users} sub={`${stats.totals.admins} admin`} />
            <Stat label="Households" value={stats.totals.households} />
            <Stat label="Children (count)" value={stats.totals.children} />
            <Stat label="Documents (count)" value={stats.totals.documents} />
            <Stat label="Revenue" value={`$${(stats.totals.revenueCents / 100).toFixed(2)}`} />
            <Stat label="Payment issues" value={stats.totals.paymentIssues} />
            <Stat label="New users (7d)" value={stats.totals.newUsers7d} />
            <Stat label="Unread alerts" value={stats.totals.unreadNotifications} />
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
            Aggregate counts only — admins cannot view individual children, documents, notes or case data.
          </p>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <form
            onSubmit={(e) => { e.preventDefault(); loadUsers(query); }}
            className="mb-4 flex gap-2"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="input max-w-sm"
            />
            <button type="submit" className="btn-secondary">Search</button>
            <button type="button" onClick={createUser} className="btn-primary ml-auto">+ New user</button>
          </form>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Email / name</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Admin role</th>
                  <th className="px-3 py-3">Last login</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
                  return (
                    <tr key={u.id} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-800">{u.email}</p>
                        <p className="text-xs text-slate-500">{u.name || '—'}</p>
                        {u.internalNote && <p className="mt-1 text-xs italic text-amber-700">📝 {u.internalNote}</p>}
                      </td>
                      <td className="px-3 py-3">
                        {u.deletedAt ? <span className="badge bg-slate-800 text-white">Deleted</span>
                          : u.isBanned ? <span className="badge bg-red-100 text-red-700">Banned</span>
                          : u.isActive ? <span className="badge bg-green-100 text-green-700">Active</span>
                          : <span className="badge bg-slate-200 text-slate-600">Suspended</span>}
                        {locked && !u.deletedAt && <span className="badge ml-1 bg-amber-100 text-amber-700">Locked</span>}
                        {!u.emailVerifiedAt && !u.deletedAt && <span className="badge ml-1 bg-amber-50 text-amber-700">Unverified</span>}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          defaultValue={u.adminRole ?? ''}
                          onChange={(e) => userAction(u.id, 'setAdminRole', e.target.value)}
                          className="input py-1 text-xs"
                        >
                          {ADMIN_ROLES.map((r) => (
                            <option key={r} value={r}>{r === '' ? '— not admin —' : r}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {u.deletedAt ? (
                            <button onClick={() => userAction(u.id, 'restore')} className="text-green-700 hover:underline">Restore</button>
                          ) : (
                            <>
                              {u.isActive
                                ? <button onClick={() => userAction(u.id, 'suspend')} className="text-amber-700 hover:underline">Suspend</button>
                                : <button onClick={() => userAction(u.id, 'reactivate')} className="text-green-700 hover:underline">Reactivate</button>}
                              {u.isBanned
                                ? <button onClick={() => userAction(u.id, 'unban')} className="text-green-700 hover:underline">Unban</button>
                                : <button onClick={() => userAction(u.id, 'ban')} className="text-red-700 hover:underline">Ban</button>}
                              {locked && <button onClick={() => userAction(u.id, 'unlock')} className="text-blue-700 hover:underline">Unlock</button>}
                              {!u.emailVerifiedAt && <button onClick={() => userAction(u.id, 'verify')} className="text-green-700 hover:underline">Verify</button>}
                              <button onClick={() => editUser(u)} className="text-slate-600 hover:underline">Edit</button>
                              <button onClick={() => userAction(u.id, 'sendPasswordReset')} className="text-blue-700 hover:underline">Send reset</button>
                              <button onClick={() => { if (confirm('Sign this user out of all devices?')) userAction(u.id, 'forceLogout'); }} className="text-blue-700 hover:underline">Force logout</button>
                              <button onClick={() => { const v = prompt('Internal note:', u.internalNote ?? ''); if (v !== null) userAction(u.id, 'note', v); }} className="text-slate-600 hover:underline">Note</button>
                              <button onClick={() => deleteUser(u.id)} className="text-red-700 hover:underline">Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div>
          {notifs.length > 0 && (
            <button onClick={() => markNotif(undefined, true)} className="btn-secondary mb-3">Mark all read</button>
          )}
          <div className="card p-0">
            {notifs.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No notifications.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifs.map((n) => (
                  <li key={n.id} className={`flex items-center justify-between px-4 py-3 ${n.isRead ? 'opacity-60' : ''}`}>
                    <div>
                      <p className="text-sm text-slate-800">
                        {n.level === 'critical' ? '🔴' : n.level === 'warning' ? '🟠' : '🔵'} {n.message}
                      </p>
                      <p className="text-xs text-slate-500">{n.type} · {new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {!n.isRead && <button onClick={() => markNotif(n.id)} className="text-xs text-brand-700 hover:underline">Mark read</button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="card max-w-xl space-y-4">
          <div>
            <label className="label">App name</label>
            <div className="flex gap-2">
              <input
                defaultValue={settings.appName ?? ''}
                onBlur={(e) => e.target.value !== settings.appName && saveSetting('appName', e.target.value)}
                className="input"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">Saved on blur.</p>
          </div>
          <Toggle label="Maintenance mode" hint="Blocks the app for everyone except admins." checked={settings.maintenanceMode === 'true'} onChange={(v) => saveSetting('maintenanceMode', String(v))} />
          <Toggle label="Sign-ups enabled" hint="Allow new accounts to register." checked={settings.signupEnabled === 'true'} onChange={(v) => saveSetting('signupEnabled', String(v))} />
          <Toggle label="Require email verification" hint="Non-admins must confirm their email before using the app." checked={settings.emailVerificationRequired === 'true'} onChange={(v) => saveSetting('emailVerificationRequired', String(v))} />
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

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
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

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 rounded border-slate-300" />
    </label>
  );
}
