import Link from 'next/link';
import { VerifyEmailForm } from '@/components/auth-forms';

export const dynamic = 'force-dynamic';

export default function VerifyEmailPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700">🏠 Foster Care HMS</Link>
        <div className="card">
          <h1 className="mb-4 text-xl font-semibold text-slate-900">Email verification</h1>
          <VerifyEmailForm token={searchParams.token ?? ''} />
        </div>
      </div>
    </main>
  );
}
