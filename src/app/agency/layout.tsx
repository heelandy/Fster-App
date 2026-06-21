import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { SignOutButton } from '@/components/sign-out-button';

// The agency portal is independent of household context. Gated to signed-in users;
// the page decides between "create an agency" and the oversight portal.
export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect('/agency-login');
  }
  // Only foster parents (users who belong to a household) get "Back to app" —
  // a case worker has no household, so the link would dead-end.
  const hasHousehold = !!(await prisma.householdMember.findFirst({ where: { userId: user.id }, select: { id: true } }));

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <span className="font-bold text-brand-700">🏢 Agency Portal</span>
            {hasHousehold && <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">← Back to app</Link>}
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
