'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/dashboard';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn('credentials', {
      email: String(form.get('email')),
      password: String(form.get('password')),
      totp: String(form.get('totp') || ''),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError('Sign-in failed. Check your email and password — and if two-factor is enabled, enter your 6-digit authenticator code below.');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="totp">
          Authenticator code <span className="font-normal text-slate-400">(only if you’ve enabled 2FA)</span>
        </label>
        <input
          id="totp"
          name="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          className="input"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">Forgot password?</Link>
        <Link href="/register" className="text-brand-700 hover:underline">Create account</Link>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(form.get('email')) }),
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          If an account exists for that address, we’ve sent a password-reset link. Check your inbox
          (and spam). The link expires in 1 hour.
        </p>
        <Link href="/login" className="btn-primary inline-block">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
      <p className="text-center text-sm text-slate-600">
        Remembered it? <Link href="/login" className="text-brand-700 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: String(form.get('password')) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const fieldErr = data?.fields ? Object.values(data.fields).flat()[0] : null;
      setError((fieldErr as string) || data?.error || 'Could not reset your password.');
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    setTimeout(() => router.push('/login'), 1500);
  }

  if (!token) {
    return <p className="text-sm text-red-600">This reset link is missing its token. Please request a new one.</p>;
  }
  if (done) {
    return <p className="text-sm text-green-700">Password updated. Redirecting you to sign in…</p>;
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
        <p className="mt-1 text-xs text-slate-500">At least 10 characters with upper, lower and a number.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'ok' | 'error'>('working');

  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => setState(res.ok ? 'ok' : 'error'))
      .catch(() => setState('error'));
  }, [token]);

  if (!token) return <p className="text-sm text-red-600">This link is missing its token.</p>;
  if (state === 'working') return <p className="text-sm text-slate-600">Confirming your email…</p>;
  if (state === 'ok')
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-700">✅ Your email is confirmed. You’re all set.</p>
        <Link href="/dashboard" className="btn-primary inline-block">Go to dashboard</Link>
      </div>
    );
  return (
    <div className="space-y-3">
      <p className="text-sm text-red-600">This verification link is invalid or has expired.</p>
      <Link href="/login" className="text-brand-700 hover:underline">Sign in</Link> to request a new one.
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password')),
      householdName: String(form.get('householdName')),
    };
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const fieldErr = data?.fields ? Object.values(data.fields).flat()[0] : null;
      setError((fieldErr as string) || data?.error || 'Could not create account.');
      setLoading(false);
      return;
    }
    // Auto sign-in after successful registration.
    await signIn('credentials', { email: payload.email, password: payload.password, redirect: false });
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input id="name" name="name" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="householdName">Household name</label>
        <input id="householdName" name="householdName" required className="input" placeholder="e.g. The Smith Home" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
        <p className="mt-1 text-xs text-slate-500">At least 10 characters with upper, lower and a number.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Creating…' : 'Create account'}
      </button>
      <p className="text-center text-sm text-slate-600">
        Already have an account? <Link href="/login" className="text-brand-700 hover:underline">Log in</Link>
      </p>
    </form>
  );
}
