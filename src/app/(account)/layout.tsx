import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/authz';
import { SignOutButton } from '@/components/sign-out-button';

// Account settings live outside the household scope so they work even for users
// without a household (e.g. admins, or members between placements).
export const dynamic = 'force-dynamic';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireUser();
  } catch {
    redirect('/login');
  }
  return (
    <div className="min-h-screen bg-cream-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-brand-700 hover:underline">← Back to dashboard</Link>
          <SignOutButton />
        </div>
        {children}
      </div>
    </div>
  );
}
