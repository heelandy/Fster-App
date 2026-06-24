import { Suspense } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { LoginForm } from '@/components/auth-forms';

// Dynamic so the middleware nonce-based CSP applies to this page's scripts.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold text-brand-700">
          <Heart className="h-5 w-5" fill="currentColor" /> Foster Care HMS
        </Link>
        <div className="card">
          <h1 className="mb-6 text-xl font-semibold text-slate-900">Welcome back</h1>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Are you a foster agency?{' '}
          <Link href="/register/agency" className="font-medium text-brand-700 hover:underline">
            Register your agency →
          </Link>
        </p>
      </div>
    </main>
  );
}
