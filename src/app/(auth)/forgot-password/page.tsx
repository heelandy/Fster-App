import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth-forms';

// Dynamic so the middleware nonce-based CSP applies to this page's scripts.
export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700">
          🏠 Foster Care HMS
        </Link>
        <div className="card">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Reset your password</h1>
          <p className="mb-6 text-sm text-slate-600">
            Enter your account email and we’ll send you a link to set a new password.
          </p>
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
