import Link from 'next/link';
import { Heart } from 'lucide-react';
import { RegisterForm } from '@/components/auth-forms';

// Dynamic so the middleware nonce-based CSP applies to this page's scripts.
export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold text-brand-700">
          <Heart className="h-5 w-5" fill="currentColor" /> Foster Care HMS
        </Link>
        <div className="card">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Create your account</h1>
          <p className="mb-6 text-sm text-slate-600">
            Foster parents start free with one household; agencies manage homes and staff. Upgrade anytime.
          </p>
          <RegisterForm />
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="text-brand-700 hover:underline">Terms</Link> and{' '}
          <Link href="/privacy" className="text-brand-700 hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
