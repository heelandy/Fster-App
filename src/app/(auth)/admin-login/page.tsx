import { Suspense } from 'react';
import Link from 'next/link';
import { LoginForm } from '@/components/auth-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin sign-in — Foster Care HMS' };

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700">
          ⚙️ Foster Care HMS — Admin
        </Link>
        <div className="card">
          <h1 className="text-xl font-semibold text-slate-900">Admin sign-in</h1>
          <p className="mb-6 mt-1 text-sm text-slate-600">Restricted to platform staff. Two-factor may be required.</p>
          <Suspense fallback={null}>
            <LoginForm defaultCallback="/admin" showRoleSelect={false} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
