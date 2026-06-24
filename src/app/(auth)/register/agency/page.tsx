import Link from 'next/link';
import { Building2, ShieldCheck } from 'lucide-react';
import { AgencyRegisterForm } from '@/components/agency-register-form';

// Dynamic so the middleware nonce-based CSP applies to this page's scripts.
export const dynamic = 'force-dynamic';

export default function AgencyRegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold text-brand-700">
          <Building2 className="h-5 w-5" /> Foster Care HMS — for agencies
        </Link>
        <div className="card">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Register your agency</h1>
          <p className="mb-4 text-sm text-slate-600">
            Oversee your foster homes, staff and placements in one place. Your agency is reviewed before
            oversight features unlock.
          </p>
          <div className="mb-5 flex items-start gap-2 rounded-2xl border border-cream-200 bg-cream-50 p-3 text-xs text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <span>
              While you wait for verification you can sign in, set up your branding and invite staff. Requesting
              oversight of a foster home unlocks once we confirm your agency is legitimate.
            </span>
          </div>
          <AgencyRegisterForm />
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
