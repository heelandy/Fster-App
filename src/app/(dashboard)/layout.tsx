import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireHousehold, requireUser, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { findAgencyMembership } from '@/lib/agency';
import { planHasFeature } from '@/lib/plans';
import { isFlagOn } from '@/lib/settings';
import { DashboardNav, type NavItem } from '@/components/dashboard-nav';
import { MobileNav } from '@/components/mobile-nav';
import { HomeSwitcher } from '@/components/home-switcher';
import { SignOutButton } from '@/components/sign-out-button';
import { VerifyEmailNeeded } from '@/components/resend-verification';

function Maintenance() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card max-w-md text-center">
        <p className="text-3xl">🛠️</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">We’ll be right back</h1>
        <p className="mt-1 text-sm text-slate-600">
          The app is temporarily down for maintenance. Please try again shortly.
        </p>
        <div className="mt-4"><SignOutButton /></div>
      </div>
    </div>
  );
}

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

  // Maintenance mode blocks everyone except admins.
  if (user.role !== 'ADMIN' && (await isFlagOn('maintenanceMode'))) {
    return <Maintenance />;
  }

  // Email verification gate (when enabled): non-admins must confirm their email.
  if (user.role !== 'ADMIN' && !user.emailVerifiedAt && (await isFlagOn('emailVerificationRequired'))) {
    return <VerifyEmailNeeded email={user.email ?? ''} />;
  }

  let ctx;
  try {
    ctx = await requireHousehold();
  } catch {
    return <NoHousehold isAdmin={user.role === 'ADMIN'} />;
  }

  const items: NavItem[] = [{ href: '/dashboard', label: 'Overview', icon: '📊' }];
  items.push({ href: '/dashboard/today', label: 'Today', icon: '☀️' });
  if (can(ctx, 'children:read')) items.push({ href: '/dashboard/children', label: 'Children', icon: '🧒' });
  if (can(ctx, 'children:read')) items.push({ href: '/dashboard/emergency', label: 'Emergency', icon: '🚨' });
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
  if (can(ctx, 'behaviorLogs:read')) items.push({ href: '/dashboard/behavior', label: 'Behavior', icon: '💛' });
  if (can(ctx, 'communications:read')) items.push({ href: '/dashboard/communication', label: 'Communication', icon: '☎️' });
  if (can(ctx, 'inventory:read')) items.push({ href: '/dashboard/closet', label: 'Foster Closet', icon: '👕' });
  if (can(ctx, 'journal:read')) items.push({ href: '/dashboard/journal', label: 'Journal', icon: '📖' });
  if (can(ctx, 'children:read')) items.push({ href: '/dashboard/timeline', label: 'Timeline', icon: '🗓️' });
  items.push({ href: '/dashboard/resources', label: 'Resources', icon: '📚' });
  if (can(ctx, 'household:manage') && planHasFeature(ctx.tier, 'agencyDashboard'))
    items.push({ href: '/dashboard/agency', label: 'Agency', icon: '🏢' });
  if (can(ctx, 'members:manage')) items.push({ href: '/dashboard/household', label: 'Household', icon: '🏠' });
  if (can(ctx, 'billing:manage')) items.push({ href: '/billing', label: 'Billing', icon: '💳' });
  items.push({ href: '/support', label: 'Support', icon: '💬' });
  items.push({ href: '/account', label: 'Account', icon: '👤' });
  if (ctx.globalRole === 'ADMIN') items.push({ href: '/admin', label: 'Admin', icon: '⚙️' });
  // Agency staff get a link to the separate oversight portal.
  if (await findAgencyMembership(ctx.userId)) items.push({ href: '/agency', label: 'Agency Portal', icon: '🏢' });

  // Homes this user belongs to — powers the multi-home switcher.
  const homeRows = await prisma.householdMember.findMany({
    where: { userId: ctx.userId },
    select: { household: { select: { id: true, name: true } } },
    orderBy: { invitedAt: 'asc' },
  });
  const homes = homeRows.map((h) => ({ id: h.household.id, name: h.household.name, current: h.household.id === ctx.householdId }));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="mb-6">
            <p className="text-lg font-bold text-brand-700">🏠 Foster Care HMS</p>
            <p className="mt-1 truncate text-xs text-slate-500" title={ctx.householdName}>
              {ctx.householdName}
            </p>
            <HomeSwitcher homes={homes} />
            <span className="badge mt-2 bg-brand-100 text-brand-800">{ctx.tier} plan</span>
            <p className="mt-1 text-xs text-slate-400">Role: {ctx.role.replaceAll('_', ' ').toLowerCase()}</p>
          </div>
          <DashboardNav items={items} />
          <div className="mt-6 border-t border-slate-200 pt-4">
            <SignOutButton />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          {/* Mobile header + dropdown nav */}
          <div className="mb-4 md:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-brand-700">🏠 {ctx.householdName}</p>
                <span className="badge mt-1 bg-brand-100 text-brand-800">{ctx.tier} plan</span>
              </div>
              <SignOutButton />
            </div>
            <div className="mt-3">
              <MobileNav items={items} />
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
