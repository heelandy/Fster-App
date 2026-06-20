'use client';

import { useEffect, useState, useCallback } from 'react';

interface Status {
  stripe: {
    secretKeySet: boolean; secretKeyMasked: string; secretKeySource: string; livemode: boolean;
    publishableKey: string;
    webhookSecretSet: boolean; webhookSecretSource: string; webhookEndpointId: string;
    prices: Record<string, string>;
    paymentLinks: Record<string, string>;
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
  const [testTo, setTestTo] = useState('');

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
    // Non-secret config only — secret keys are set via environment variables and
    // are never entered through this UI.
    body.emailFrom = String(fd.get('emailFrom') ?? '');
    const prices: Record<string, Record<string, string>> = {};
    const paymentLinks: Record<string, Record<string, string>> = {};
    for (const key of PRICE_KEYS) {
      const [tier, interval] = key.split('.');
      (prices[tier] ??= {})[interval] = String(fd.get(`price.${key}`) ?? '');
      (paymentLinks[tier] ??= {})[interval] = String(fd.get(`link.${key}`) ?? '');
    }
    body.prices = prices;
    body.paymentLinks = paymentLinks;

    const res = await fetch('/api/admin/integrations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ kind: 'err', text: d?.error || 'Save failed.' }); return; }
    setResp((p) => (p ? { ...p, status: d.status } : p));
    setMsg({ kind: 'ok', text: 'Saved.' });
  }

  async function sendTestEmail() {
    setBusy(true); setMsg(null);
    const to = testTo.trim();
    const res = await fetch('/api/admin/integrations/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Always send a valid JSON body; omit `to` when blank (route defaults to the admin's email).
      body: JSON.stringify(to ? { to } : {}),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ kind: 'err', text: d?.error || 'Could not send the test email.' }); return; }
    if (d.provider === 'log') {
      setMsg({ kind: 'err', text: 'No Resend API key is set — the message was only written to the server log (dev mode). Save a key above, then test again.' });
    } else if (d.ok) {
      setMsg({ kind: 'ok', text: `Test email sent to ${d.to}. Check your inbox (and spam).` });
    } else {
      setMsg({ kind: 'err', text: `Resend rejected it: ${d.error || 'unknown reason'}. Tip: the default From (onboarding@resend.dev) only delivers to your own Resend-account email — set the recipient to that address, or verify your own domain in Resend.` });
    }
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
        Verified ✓ — edit non-secret config (prices, links, email From) here for ~10 minutes. <strong>Secret keys are
        set via environment variables only</strong> and are never entered in this UI; their status is shown (masked) below.
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
            <p className="font-mono text-sm text-slate-700">{s.stripe.secretKeySet ? s.stripe.secretKeyMasked : 'Not set'}</p>
            <p className="mt-1 text-xs text-slate-400">Set via the <code>STRIPE_SECRET_KEY</code> environment variable — kept server-side, never entered here.</p>
          </div>

          <div>
            <label className="label flex items-center gap-2">Webhook signing secret <SourceTag source={s.stripe.webhookSecretSource} set={s.stripe.webhookSecretSet} /></label>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <button type="button" onClick={createWebhook} disabled={busy} className="btn-secondary">Create live webhook endpoint</button>
              {s.stripe.webhookEndpointId && <span className="text-xs text-slate-500">endpoint: {s.stripe.webhookEndpointId}</span>}
            </div>
            <p className="mt-1 text-xs text-slate-400">Set via <code>STRIPE_WEBHOOK_SECRET</code>, or use the button (registers <code>/api/stripe/webhook</code> and stores the secret automatically — needs a public URL).</p>
          </div>

          <div>
            <label className="label">Price IDs <span className="font-normal text-slate-400">— for Stripe Checkout (Option A)</span></label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRICE_KEYS.map((k) => (
                <div key={k}>
                  <span className="text-xs text-slate-500">{k.replace('.', ' ').toLowerCase()}</span>
                  <input name={`price.${k}`} defaultValue={s.stripe.prices[k] ?? ''} placeholder="price_…" className="input" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Payment Links <span className="font-normal text-slate-400">— optional (Option B); overrides Checkout for that plan</span></label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRICE_KEYS.map((k) => (
                <div key={k}>
                  <span className="text-xs text-slate-500">{k.replace('.', ' ').toLowerCase()}</span>
                  <input name={`link.${k}`} defaultValue={s.stripe.paymentLinks[k] ?? ''} placeholder="https://buy.stripe.com/…" className="input" />
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">When set, “Subscribe” sends the user to this Stripe-hosted link instead of a Checkout Session. Leave blank to use the Price ID above. Webhook still attributes the subscription to the household.</p>
          </div>
        </div>

        {/* Email */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-slate-900">Email (Resend)</h3>
          <div>
            <label className="label flex items-center gap-2">API key <SourceTag source={s.email.apiKeySource} set={s.email.apiKeySet} /></label>
            <p className="font-mono text-sm text-slate-700">{s.email.apiKeySet ? s.email.apiKeyMasked : 'Not set'}</p>
            <p className="mt-1 text-xs text-slate-400">Set via the <code>RESEND_API_KEY</code> environment variable.</p>
          </div>
          <div>
            <label className="label">From address</label>
            <input name="emailFrom" defaultValue={s.email.from} placeholder="Foster Care HMS &lt;no-reply@yourdomain.com&gt;" className="input" />
            <p className="mt-1 text-xs text-slate-400">Must use a domain you’ve verified in Resend (for testing, <code>onboarding@resend.dev</code> sends only to your own account email).</p>
          </div>
          <div>
            <label className="label">Send test email</label>
            <div className="flex flex-wrap items-center gap-2">
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="recipient (defaults to your email)" className="input max-w-xs" />
              <button type="button" onClick={sendTestEmail} disabled={busy} className="btn-secondary">Send test email</button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Save your key first. With the default <code>onboarding@resend.dev</code>, send only to your Resend-account email; with a verified domain you can send anywhere.</p>
          </div>
        </div>

        {msg && <p className={`text-sm ${msg.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save configuration'}</button>
      </form>
    </div>
  );
}
