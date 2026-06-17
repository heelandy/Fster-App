'use client';

import { useState, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';

function Banner({ kind, children }: { kind: 'ok' | 'err'; children: React.ReactNode }) {
  return (
    <p className={`text-sm ${kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{children}</p>
  );
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fieldErr = data?.fields ? Object.values(data.fields).flat()[0] : null;
    throw new Error((fieldErr as string) || data?.error || 'Request failed.');
  }
  return data;
}

// ───────────────────────────── Password ─────────────────────────────

function PasswordCard() {
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await postJson('/api/account/password', {
        currentPassword: String(fd.get('currentPassword')),
        newPassword: String(fd.get('newPassword')),
      });
      setMsg({ kind: 'ok', text: 'Password updated.' });
      form.reset();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-900">Password</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="currentPassword">Current password</label>
          <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="newPassword">New password</label>
          <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required className="input" />
          <p className="mt-1 text-xs text-slate-500">At least 10 characters with upper, lower and a number.</p>
        </div>
        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

// ───────────────────────────── Two-factor ─────────────────────────────

function TwoFactorCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string; qrDataUrl: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function beginSetup() {
    setMsg(null);
    setLoading(true);
    try {
      const data = await postJson('/api/account/2fa/setup');
      setSetup({ secret: data.secret, otpauthUri: data.otpauthUri, qrDataUrl: data.qrDataUrl });
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const data = await postJson('/api/account/2fa/enable', { code: String(fd.get('code')) });
      setBackupCodes(data.backupCodes);
      setEnabled(true);
      setSetup(null);
      setMsg({ kind: 'ok', text: 'Two-factor authentication is now on.' });
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function disable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await postJson('/api/account/2fa/disable', { password: String(fd.get('password')) });
      setEnabled(false);
      setBackupCodes(null);
      setMsg({ kind: 'ok', text: 'Two-factor authentication disabled.' });
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Two-factor authentication</h2>
        <span className={`badge ${enabled ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
          {enabled ? 'On' : 'Off'}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Add a one-time code from an authenticator app (Google Authenticator, Authy, 1Password…) to your sign-in.
      </p>

      {backupCodes && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Save your backup codes</p>
          <p className="mt-1 text-xs text-amber-800">
            Each code works once if you lose your authenticator. Store them somewhere safe — they won’t be shown again.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-slate-800">
            {backupCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
        </div>
      )}

      {!enabled && !setup && (
        <div className="mt-4">
          {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
          <button onClick={beginSetup} disabled={loading} className="btn-primary mt-2">
            {loading ? 'Preparing…' : 'Enable 2FA'}
          </button>
        </div>
      )}

      {!enabled && setup && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-700">
            1. Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password…):
          </p>
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qrDataUrl}
              alt="Two-factor QR code"
              width={192}
              height={192}
              className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-2"
            />
          </div>
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer">Can’t scan? Enter this key manually</summary>
            <div className="mt-2 rounded-lg bg-slate-100 p-3">
              <p className="font-mono text-sm tracking-wider text-slate-900 break-all">{setup.secret}</p>
            </div>
          </details>
          <form onSubmit={confirmEnable} className="space-y-3">
            <div>
              <label className="label" htmlFor="code">2. Enter the 6-digit code it shows</label>
              <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required className="input" />
            </div>
            {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Verifying…' : 'Verify & turn on'}
            </button>
          </form>
        </div>
      )}

      {enabled && (
        <form onSubmit={disable} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="disablePassword">Confirm your password to disable</label>
            <input id="disablePassword" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          {msg && !backupCodes && <Banner kind={msg.kind}>{msg.text}</Banner>}
          <button type="submit" disabled={loading} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
            {loading ? 'Disabling…' : 'Disable 2FA'}
          </button>
        </form>
      )}
    </div>
  );
}

// ───────────────────────────── Sessions ─────────────────────────────

interface DeviceSession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

/** Turn a raw user-agent into a short, friendly device label. */
function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /Linux/.test(ua) ? 'Linux' : 'device';
  return `${browser} on ${os}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function SessionsCard() {
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/account/sessions');
      if (res.ok) setSessions(await res.json());
      else setSessions([]);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function revokeOne(s: DeviceSession) {
    if (s.current) return;
    if (!confirm(`Sign out ${deviceLabel(s.userAgent)}? That device will need to sign in again.`)) return;
    setBusyId(s.id);
    try {
      await postJson(`/api/account/sessions/${s.id}`);
      await load();
    } catch {
      // ignore — list reload will reflect any change
    } finally {
      setBusyId(null);
    }
  }

  async function revokeAll() {
    setLoading(true);
    try {
      await postJson('/api/account/logout-all');
    } catch {
      // even on error, fall through to sign-out
    }
    // Our own session is now invalid too — clear the cookie and return to home.
    await signOut({ callbackUrl: '/' });
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-900">Active sessions</h2>
      <p className="mt-1 text-sm text-slate-600">
        Devices currently signed in to your account. Revoke any you don’t recognize.
      </p>

      <div className="mt-4 divide-y divide-slate-100">
        {sessions === null ? (
          <p className="py-3 text-sm text-slate-500">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">No other active sessions.</p>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {deviceLabel(s.userAgent)}
                  {s.current && <span className="ml-2 badge bg-green-100 text-green-800">This device</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {s.ip ?? 'unknown IP'} · active {relativeTime(s.lastSeenAt)}
                </p>
              </div>
              {!s.current && (
                <button
                  onClick={() => revokeOne(s)}
                  disabled={busyId === s.id}
                  className="shrink-0 text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                >
                  {busyId === s.id ? 'Revoking…' : 'Revoke'}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <button onClick={revokeAll} disabled={loading} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {loading ? 'Signing out…' : 'Sign out of all devices'}
      </button>
    </div>
  );
}

export function AccountSecurity({ email, twoFactorEnabled }: { email: string; twoFactorEnabled: boolean }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Signed in as <span className="font-medium text-slate-700">{email}</span></p>
      <PasswordCard />
      <TwoFactorCard initialEnabled={twoFactorEnabled} />
      <SessionsCard />
    </div>
  );
}
