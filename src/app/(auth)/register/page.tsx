import Link from 'next/link';
import { RegisterForm } from '@/components/auth-forms';

// Dynamic so the middleware nonce-based CSP applies to this page's scripts.
export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700">
          🏠 Foster Care HMS
        </Link>
        <div className="card">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Create your account</h1>
          <p className="mb-6 text-sm text-slate-600">
            Start free with one household and one child profile. Upgrade anytime.
          </p>
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
