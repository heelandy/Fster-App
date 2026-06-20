import { Suspense } from 'react';
import Link from 'next/link';
import { LoginForm } from '@/components/auth-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agency sign-in — Foster Care HMS' };

export default function AgencyLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700">
          🏢 Foster Care HMS — Agency
        </Link>
        <div className="card">
          <h1 className="text-xl font-semibold text-slate-900">Agency sign-in</h1>
          <p className="mb-6 mt-1 text-sm text-slate-600">Sign in to your agency oversight portal.</p>
          <Suspense fallback={null}>
            <LoginForm defaultCallback="/agency" showRoleSelect={false} />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Foster parent? <Link href="/login" className="text-brand-700 hover:underline">Sign in to the app</Link>
        </p>
      </div>
    </main>
  );
}
