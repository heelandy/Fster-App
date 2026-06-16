'use client';

import { useEffect, useState, useCallback } from 'react';

interface Status {
  stripe: {
    secretKeySet: boolean; secretKeyMasked: string; secretKeySource: string; livemode: boolean;
    publishableKey: string;
    webhookSecretSet: boolean; webhookSecretSource: string; webhookEndpointId: string;
    prices: Record<string, string>;
  };
  email: { apiKeySet: boolean; apiKeyMasked: string; apiKeySource: string; from: string };
}
interface GetResp {
  twoFactorEnabled: boolean;
  stepUpRequired: boolean;
  status?: Status;
}

const PRICE_KEYS = ['FAMILY.MONTHLY', 'FAMILY.ANNUAL', 'PRO.MONTHLY', 'PRO.ANNUAL', 'AGENCY.MONTHLY', 'AGENCY.ANNUAL'];

function SourceTag({ source, set }: { source: string; set: boolean }) {
  if (!set) return <span className="badge bg-slate-100 text-slate-500">not set</span>;
  return <span className={`badge ${source === 'db' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>{source === 'db' ? 'set in app' : 'from env'}</span>;
}

export function AdminIntegrations() {
  const [resp, setResp] = useState<GetResp | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/integrations');
    if (res.status === 403) { setForbidden(true); return; }
    if (res.ok) setResp(await res.json());
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function verifyStepUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/admin/step-up', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: String(fd.get('code')) }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg({ kind: 'err', text: d?.error || 'Verification failed.' }); return; }
    await load();
  }

  async function saveConfig(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    // Secrets: only send if the admin typed a value (empty = leave unchanged).
    for (const k of ['stripeSecretKey', 'stripeWebhookSecret', 'resendApiKey']) {
      const v = String(fd.get(k) ?? '').trim();
      if (v) body[k] = v;
    }
    // Non-secret: always send the (editable) current value.
    body.stripePublishableKey = String(fd.get('stripePublishableKey') ?? '');
    body.emailFrom = String(fd.get('emailFrom') ?? '');
    const prices: Record<string, Record<string, string>> = {};
    for (const key of PRICE_KEYS) {
      const [tier, interval] = key.split('.');
      (prices[tier] ??= {})[interval] = String(fd.get(`price.${key}`) ?? '');
    }
    body.prices = prices;

    const res = await fetch('/api/admin/integrations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ kind: 'err', text: d?.error || 'Save failed.' }); return; }
    setResp((p) => (p ? { ...p, status: d.status } : p));
    setMsg({ kind: 'ok', text: 'Saved.' });
  }

  async function clearSecret(field: string) {
    if (!confirm('Clear this value? It will fall back to the environment variable (or be disabled).')) return;
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/integrations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: '' }),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setResp((p) => (p ? { ...p, status: d.status } : p)); setMsg({ kind: 'ok', text: 'Cleared.' }); }
  }

  async function createWebhook() {
    if (!confirm('Create (or recreate) the live Stripe webhook endpoint for this deployment?')) return;
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/integrations/stripe/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ kind: 'err', text: d?.error || 'Could not create the webhook.' }); return; }
    setMsg({ kind: 'ok', text: `Webhook endpoint created (${d.endpointId}). Signing secret stored.` });
    await load();
  }

  if (forbidden) return <div className="card text-sm text-slate-500">Integrations are restricted to Super Admins.</div>;
  if (!resp) return <p className="text-sm text-slate-500">Loading…</p>;

  // Gate 1: needs 2FA on the account.
  if (!resp.twoFactorEnabled) {
    return (
      <div className="card">
        <h3 className="font-semibold text-slate-900">Authenticator required</h3>
        <p className="mt-1 text-sm text-slate-600">
          This area holds live payment keys, so it’s protected by two-factor authentication. Enable 2FA on your
          account, then come back.
        </p>
        <a href="/account" className="btn-primary mt-3 inline-block">Go to Account &amp; security</a>
      </div>
    );
  }

  // Gate 2: needs a fresh step-up verification.
  if (resp.stepUpRequired || !resp.status) {
    return (
      <div className="card max-w-sm">
        <h3 className="font-semibold text-slate-900">Verify it’s you</h3>
        <p className="mt-1 text-sm text-slate-600">Enter the 6-digit code from your authenticator to unlock integration settings.</p>
        <form onSubmit={verifyStepUp} className="mt-3 space-y-3">
          <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required className="input" />
          {msg && <p className={`text-sm ${msg.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Verifying…' : 'Unlock'}</button>
        </form>
      </div>
    );
  }

  const s = resp.status;
  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400">
        Verified ✓ — this session can edit live keys for ~10 minutes. Secrets are stored encrypted; values shown are masked.
      </p>

      {/* Status summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Stripe mode</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {s.stripe.secretKeySet ? (s.stripe.livemode ? '🟢 Live' : '🧪 Test') : '—'}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Webhook</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{s.stripe.webhookSecretSet ? '✅ Configured' : '⬜ Not set'}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Email</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{s.email.apiKeySet ? '✅ Configured' : '⬜ Dev log'}</p>
        </div>
      </div>

      <form onSubmit={saveConfig} className="space-y-6">
        {/* Stripe */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-slate-900">Stripe</h3>

          <div>
            <label className="label flex items-center gap-2">Secret key <SourceTag source={s.stripe.secretKeySource} set={s.stripe.secretKeySet} /></label>
            <input name="stripeSecretKey" type="password" autoComplete="off" placeholder={s.stripe.secretKeySet ? `current: ${s.stripe.secretKeyMasked} — leave blank to keep` : 'sk_live_…'} className="input" />
            {s.stripe.secretKeySource === 'db' && <button type="button" onClick={() => clearSecret('stripeSecretKey')} className="mt-1 text-xs text-red-600 hover:underline">Clear (use env)</button>}
          </div>

          <div>
            <label className="label">Publishable key</label>
            <input name="stripePublishableKey" defaultValue={s.stripe.publishableKey} placeholder="pk_live_…" className="input" />
          </div>

          <div>
            <label className="label flex items-center gap-2">Webhook signing secret <SourceTag source={s.stripe.webhookSecretSource} set={s.stripe.webhookSecretSet} /></label>
            <input name="stripeWebhookSecret" type="password" autoComplete="off" placeholder={s.stripe.webhookSecretSet ? 'set — leave blank to keep' : 'whsec_… (or use the button below)'} className="input" />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" onClick={createWebhook} disabled={busy} className="btn-secondary">Create live webhook endpoint</button>
              {s.stripe.webhookEndpointId && <span className="text-xs text-slate-500">endpoint: {s.stripe.webhookEndpointId}</span>}
            </div>
            <p className="mt-1 text-xs text-slate-400">Registers <code>/api/stripe/webhook</code> with Stripe and stores the signing secret automatically (needs the secret key set first).</p>
          </div>

          <div>
            <label className="label">Price IDs</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRICE_KEYS.map((k) => (
                <div key={k}>
                  <span className="text-xs text-slate-500">{k.replace('.', ' ').toLowerCase()}</span>
                  <input name={`price.${k}`} defaultValue={s.stripe.prices[k] ?? ''} placeholder="price_…" className="input" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-slate-900">Email (Resend)</h3>
          <div>
            <label className="label flex items-center gap-2">API key <SourceTag source={s.email.apiKeySource} set={s.email.apiKeySet} /></label>
            <input name="resendApiKey" type="password" autoComplete="off" placeholder={s.email.apiKeySet ? `current: ${s.email.apiKeyMasked} — leave blank to keep` : 're_…'} className="input" />
            {s.email.apiKeySource === 'db' && <button type="button" onClick={() => clearSecret('resendApiKey')} className="mt-1 text-xs text-red-600 hover:underline">Clear (use env)</button>}
          </div>
          <div>
            <label className="label">From address</label>
            <input name="emailFrom" defaultValue={s.email.from} placeholder="Foster Care HMS &lt;no-reply@yourdomain.com&gt;" className="input" />
          </div>
        </div>

        {msg && <p className={`text-sm ${msg.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save configuration'}</button>
      </form>
    </div>
  );
}
