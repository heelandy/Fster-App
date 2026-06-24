'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import Script from 'next/script';
import { US_STATES } from '@/lib/us-states';

/**
 * Dedicated agency sign-up. Collects the legitimacy details required for manual
 * verification (legal name, EIN, US state, address, license) alongside the
 * account credentials, then creates a PENDING agency and lands in the portal.
 */
export function AgencyRegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password')),
      agencyName: String(form.get('agencyName')),
      legalName: String(form.get('legalName')),
      ein: String(form.get('ein')),
      npi: String(form.get('npi') || ''),
      usState: String(form.get('usState')),
      licenseNumber: String(form.get('licenseNumber') || ''),
      phone: String(form.get('phone') || ''),
      addressLine: String(form.get('addressLine')),
      city: String(form.get('city')),
      postalCode: String(form.get('postalCode')),
      website: String(form.get('website') || ''),
      captchaToken: String(form.get('cf-turnstile-response') || ''),
    };
    const res = await fetch('/api/auth/register-agency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const fieldErr = data?.fields ? Object.values(data.fields).flat()[0] : null;
      setError((fieldErr as string) || data?.error || 'Could not create the agency account.');
      setLoading(false);
      return;
    }
    await signIn('credentials', { email: payload.email, password: payload.password, redirect: false });
    window.location.href = '/agency';
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Your account</legend>
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
          <p className="mt-1 text-xs text-slate-500">At least 10 characters with upper, lower and a number.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Agency details</legend>
        <p className="text-xs text-slate-500">
          We verify every agency before it can oversee foster homes. These details are reviewed by our team —
          they confirm you&rsquo;re a real, licensed organisation in the USA.
        </p>
        <div>
          <label className="label" htmlFor="agencyName">Agency name (shown to your homes)</label>
          <input id="agencyName" name="agencyName" required className="input" placeholder="e.g. Bright Futures Foster Agency" />
        </div>
        <div>
          <label className="label" htmlFor="legalName">Registered legal name</label>
          <input id="legalName" name="legalName" required className="input" placeholder="As filed with the state / IRS" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ein">EIN (Tax ID)</label>
            <input id="ein" name="ein" required className="input" placeholder="12-3456789" inputMode="numeric" />
          </div>
          <div>
            <label className="label" htmlFor="usState">State</label>
            <select id="usState" name="usState" required defaultValue="" className="input">
              <option value="" disabled>Select a state…</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="licenseNumber">State license / cert # <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="licenseNumber" name="licenseNumber" className="input" placeholder="Child-placing license #" />
          </div>
          <div>
            <label className="label" htmlFor="npi">NPI <span className="font-normal text-slate-400">(optional, 10 digits)</span></label>
            <input id="npi" name="npi" className="input" placeholder="National Provider Identifier" inputMode="numeric" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="addressLine">Street address</label>
          <input id="addressLine" name="addressLine" required className="input" placeholder="123 Main St, Suite 200" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="city">City</label>
            <input id="city" name="city" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="postalCode">ZIP code</label>
            <input id="postalCode" name="postalCode" required className="input" placeholder="00000" inputMode="numeric" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">Phone <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="phone" name="phone" className="input" inputMode="tel" />
          </div>
          <div>
            <label className="label" htmlFor="website">Website <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="website" name="website" className="input" placeholder="https://" />
          </div>
        </div>
      </fieldset>

      {turnstileSiteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Creating…' : 'Create agency account'}
      </button>
      <p className="text-center text-sm text-slate-600">
        Signing up as a foster parent instead? <Link href="/register" className="text-brand-700 hover:underline">Foster-parent sign-up</Link>
      </p>
    </form>
  );
}
