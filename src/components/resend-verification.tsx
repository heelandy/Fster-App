'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

/** Shown when the app requires email verification and the user hasn't verified. */
export function VerifyEmailNeeded({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    await fetch('/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    setBusy(false);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card max-w-md text-center">
        <p className="text-3xl">✉️</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">Confirm your email</h1>
        <p className="mt-1 text-sm text-slate-600">
          We sent a verification link to <span className="font-medium">{email}</span>. Click it to access the app.
        </p>
        {sent && <p className="mt-3 text-sm text-green-700">Sent — check your inbox (and spam).</p>}
        <div className="mt-4 flex justify-center gap-3">
          <button onClick={resend} disabled={busy} className="btn-primary">{busy ? 'Sending…' : 'Resend email'}</button>
          <SignOut />
        </div>
      </div>
    </div>
  );
}

function SignOut() {
  return (
    <button onClick={() => signOut({ callbackUrl: '/' })} className="text-sm text-slate-500 hover:text-slate-800">
      Sign out
    </button>
  );
}
