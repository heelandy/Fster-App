import { Suspense } from 'react';
import Link from 'next/link';
import { LoginForm } from '@/components/auth-forms';

// Dynamic so the middleware nonce-based CSP applies to this page's scripts.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700">
          🏠 Foster Care HMS
        </Link>
        <div className="card">
          <h1 className="mb-6 text-xl font-semibold text-slate-900">Welcome back</h1>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
