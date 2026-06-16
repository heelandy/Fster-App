import Link from 'next/link';
import { ResetPasswordForm } from '@/components/auth-forms';

// Dynamic so the middleware nonce-based CSP applies to this page's scripts.
export const dynamic = 'force-dynamic';

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? '';
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700">
          🏠 Foster Care HMS
        </Link>
        <div className="card">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Choose a new password</h1>
          <p className="mb-6 text-sm text-slate-600">Pick a strong password you don’t use elsewhere.</p>
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </main>
  );
}
