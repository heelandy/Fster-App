import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/authz';
import { SignOutButton } from '@/components/sign-out-button';

// The admin area is intentionally independent of any household context — global
// admins do not need to be a member of a household to manage the platform.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <span className="font-bold text-brand-700">⚙️ Admin Console</span>
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
              ← Back to app
            </Link>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
