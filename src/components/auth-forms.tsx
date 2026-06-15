'use client';

import { useState } from 'react';
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
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password.');
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-slate-600">
        No account? <Link href="/register" className="text-brand-700 hover:underline">Create one</Link>
      </p>
    </form>
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
