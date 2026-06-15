import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireHousehold, requireUser, can } from '@/lib/authz';
import { planHasFeature } from '@/lib/plans';
import { DashboardNav, type NavItem } from '@/components/dashboard-nav';
import { SignOutButton } from '@/components/sign-out-button';

function NoHousehold({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card max-w-md text-center">
        <p className="text-2xl">🏠</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">No household yet</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your account isn’t part of a household. {isAdmin ? 'As an admin you can manage the platform from the admin console.' : 'Ask a foster parent to add you, or create a new account to start one.'}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          {isAdmin && <Link href="/admin" className="btn-primary">Go to Admin</Link>}
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Confirm authentication first so we never bounce a logged-in user to /login
  // (which would loop). Then resolve the household, tolerating users without one.
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect('/login');
  }

  let ctx;
  try {
    ctx = await requireHousehold();
  } catch {
    return <NoHousehold isAdmin={user.role === 'ADMIN'} />;
  }

  const items: NavItem[] = [{ href: '/dashboard', label: 'Overview', icon: '📊' }];
  if (can(ctx, 'children:read')) items.push({ href: '/dashboard/children', label: 'Children', icon: '🧒' });
  if (can(ctx, 'appointments:read')) items.push({ href: '/dashboard/appointments', label: 'Appointments', icon: '📅' });
  if (can(ctx, 'documents:read') && planHasFeature(ctx.tier, 'documents'))
    items.push({ href: '/dashboard/documents', label: 'Documents', icon: '📄' });
  if (can(ctx, 'careLogs:read') && planHasFeature(ctx.tier, 'careLogs'))
    items.push({ href: '/dashboard/care-logs', label: 'Care Logs', icon: '📝' });
  if (can(ctx, 'medications:read') && planHasFeature(ctx.tier, 'medications'))
    items.push({ href: '/dashboard/medications', label: 'Medications', icon: '💊' });
  if (can(ctx, 'expenses:read') && planHasFeature(ctx.tier, 'expenses'))
    items.push({ href: '/dashboard/expenses', label: 'Expenses', icon: '💵' });
  if (can(ctx, 'contacts:read')) items.push({ href: '/dashboard/contacts', label: 'Contacts', icon: '📇' });
  if (can(ctx, 'routines:read')) items.push({ href: '/dashboard/routines', label: 'Routines', icon: '🔁' });
  if (can(ctx, 'routines:read')) items.push({ href: '/dashboard/checklists', label: 'Checklists', icon: '✅' });
  if (can(ctx, 'licensing:read') && planHasFeature(ctx.tier, 'licensingTracker'))
    items.push({ href: '/dashboard/licensing', label: 'Licensing', icon: '🛡️' });
  if (can(ctx, 'members:manage')) items.push({ href: '/dashboard/household', label: 'Household', icon: '🏠' });
  if (can(ctx, 'billing:manage')) items.push({ href: '/billing', label: 'Billing', icon: '💳' });
  if (ctx.globalRole === 'ADMIN') items.push({ href: '/admin', label: 'Admin', icon: '⚙️' });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="mb-6">
            <p className="text-lg font-bold text-brand-700">🏠 Foster Care HMS</p>
            <p className="mt-1 truncate text-xs text-slate-500" title={ctx.householdName}>
              {ctx.householdName}
            </p>
            <span className="badge mt-2 bg-brand-100 text-brand-800">{ctx.tier} plan</span>
            <p className="mt-1 text-xs text-slate-400">Role: {ctx.role.replaceAll('_', ' ').toLowerCase()}</p>
          </div>
          <DashboardNav items={items} />
          <div className="mt-6 border-t border-slate-200 pt-4">
            <SignOutButton />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          {/* Mobile nav */}
          <div className="mb-4 flex items-center justify-between md:hidden">
            <p className="font-bold text-brand-700">🏠 {ctx.householdName}</p>
            <SignOutButton />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
