import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Heart, Home, Wrench } from 'lucide-react';
import { requireHousehold, requireUser, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { findAgencyMembership } from '@/lib/agency';
import { planHasFeature } from '@/lib/plans';
import { isFlagOn } from '@/lib/settings';
import { DashboardNav, type NavItem } from '@/components/dashboard-nav';
import { MobileTabBar } from '@/components/mobile-tab-bar';
import { HomeSwitcher } from '@/components/home-switcher';
import { SignOutButton } from '@/components/sign-out-button';
import { VerifyEmailNeeded } from '@/components/resend-verification';
import { IdleLogout } from '@/components/idle-logout';

function Maintenance() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
          <Wrench className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-slate-900">We’ll be right back</h1>
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
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
          <Home className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-slate-900">No household yet</h1>
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

// White-label tab icon: if this foster home is overseen by an agency that has
// uploaded a logo, use that logo as the browser-tab favicon (overrides the root
// default). The logo is served session-scoped via /api/branding/logo.
export async function generateMetadata(): Promise<Metadata> {
  try {
    const ctx = await requireHousehold();
    const home = await prisma.household.findUnique({
      where: { id: ctx.householdId },
      select: { agency: { select: { logoStorageKey: true } } },
    });
    if (home?.agency?.logoStorageKey) {
      return { icons: { icon: '/api/branding/logo', shortcut: '/api/branding/logo' } };
    }
  } catch {
    // Not signed in / no household yet — inherit the default icon.
  }
  return {};
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

  const items: NavItem[] = [{ href: '/dashboard', label: 'Overview', icon: 'overview' }];
  items.push({ href: '/dashboard/today', label: 'Today', icon: 'today' });
  if (can(ctx, 'children:read')) items.push({ href: '/dashboard/children', label: 'Children', icon: 'children' });
  if (can(ctx, 'children:read')) items.push({ href: '/dashboard/emergency', label: 'Emergency', icon: 'emergency' });
  if (can(ctx, 'appointments:read')) items.push({ href: '/dashboard/appointments', label: 'Appointments', icon: 'appointments' });
  if (can(ctx, 'documents:read') && planHasFeature(ctx.tier, 'documents'))
    items.push({ href: '/dashboard/documents', label: 'Documents', icon: 'documents' });
  if (can(ctx, 'careLogs:read') && planHasFeature(ctx.tier, 'careLogs'))
    items.push({ href: '/dashboard/care-logs', label: 'Care Logs', icon: 'careLogs' });
  if (can(ctx, 'medications:read') && planHasFeature(ctx.tier, 'medications'))
    items.push({ href: '/dashboard/medications', label: 'Medications', icon: 'medications' });
  if (can(ctx, 'medical:read')) items.push({ href: '/dashboard/immunizations', label: 'Immunizations', icon: 'immunizations' });
  if (can(ctx, 'education:read')) items.push({ href: '/dashboard/education', label: 'Education', icon: 'education' });
  if (can(ctx, 'court:read')) items.push({ href: '/dashboard/court', label: 'Court', icon: 'court' });
  if (can(ctx, 'expenses:read') && planHasFeature(ctx.tier, 'expenses'))
    items.push({ href: '/dashboard/expenses', label: 'Expenses', icon: 'expenses' });
  if (can(ctx, 'contacts:read')) items.push({ href: '/dashboard/contacts', label: 'Contacts', icon: 'contacts' });
  if (can(ctx, 'routines:read')) items.push({ href: '/dashboard/routines', label: 'Routines', icon: 'routines' });
  if (can(ctx, 'routines:read')) items.push({ href: '/dashboard/checklists', label: 'Checklists', icon: 'checklists' });
  if (can(ctx, 'licensing:read') && planHasFeature(ctx.tier, 'licensingTracker'))
    items.push({ href: '/dashboard/licensing', label: 'Licensing', icon: 'licensing' });
  if (can(ctx, 'training:read')) items.push({ href: '/dashboard/training', label: 'Training', icon: 'training' });
  if (can(ctx, 'behaviorLogs:read')) items.push({ href: '/dashboard/behavior', label: 'Behavior', icon: 'behavior' });
  if (can(ctx, 'communications:read')) items.push({ href: '/dashboard/communication', label: 'Communication', icon: 'communication' });
  if (can(ctx, 'children:read')) items.push({ href: '/dashboard/visits', label: 'Visit Log', icon: 'visits' });
  if (can(ctx, 'journal:read')) items.push({ href: '/dashboard/journal', label: 'Journal', icon: 'journal' });
  if (can(ctx, 'children:read')) items.push({ href: '/dashboard/timeline', label: 'Timeline', icon: 'timeline' });
  items.push({ href: '/dashboard/resources', label: 'Resources', icon: 'resources' });
  if (can(ctx, 'household:manage') && planHasFeature(ctx.tier, 'agencyDashboard'))
    items.push({ href: '/dashboard/agency', label: 'Agency', icon: 'agency' });
  if (can(ctx, 'members:manage')) items.push({ href: '/dashboard/household', label: 'Household', icon: 'household' });
  if (can(ctx, 'billing:manage')) items.push({ href: '/billing', label: 'Billing', icon: 'billing' });
  items.push({ href: '/support', label: 'Support', icon: 'support' });
  items.push({ href: '/account', label: 'Account', icon: 'account' });
  if (ctx.globalRole === 'ADMIN') items.push({ href: '/admin', label: 'Admin', icon: 'admin' });
  // Agency staff get a link to the separate oversight portal.
  if (await findAgencyMembership(ctx.userId)) items.push({ href: '/agency', label: 'Agency Portal', icon: 'agency' });

  // Homes this user belongs to — powers the multi-home switcher.
  const homeRows = await prisma.householdMember.findMany({
    where: { userId: ctx.userId },
    select: { household: { select: { id: true, name: true } } },
    orderBy: { invitedAt: 'asc' },
  });
  const homes = homeRows.map((h) => ({ id: h.household.id, name: h.household.name, current: h.household.id === ctx.householdId }));

  // Friendly greeting + avatar fallback for the profile card.
  const firstName = user.name?.trim().split(/\s+/)[0] || 'there';
  const initial = (user.name?.trim()[0] || user.email?.[0] || 'F').toUpperCase();
  const roleLabel = ctx.role
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // White-label: if this home is overseen by an agency, surface its branding so
  // the foster parent sees who supports them. The logo is served session-scoped.
  const overseen = await prisma.household.findUnique({
    where: { id: ctx.householdId },
    select: { agency: { select: { name: true, displayName: true, brandColor: true, logoStorageKey: true } } },
  });
  const agencyBrand = overseen?.agency ?? null;

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Extra bottom padding on mobile so the fixed tab bar never covers content. */}
      <div className="mx-auto flex max-w-7xl gap-6 px-4 pt-6 pb-28 md:pb-6">
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col rounded-3xl border border-cream-200 bg-white p-4 shadow-sm">
            {/* Brand */}
            <div className="px-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
                  <Heart className="h-[18px] w-[18px]" fill="currentColor" />
                </span>
                <span className="text-xl font-bold tracking-tight text-brand-600">Foster</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Care. Support. <span className="text-brand-500">Change a life.</span>
              </p>
            </div>

            {/* Profile */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-50 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">Hi, {firstName}</p>
                <span className="badge mt-0.5 bg-brand-100 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                  {ctx.tier} plan
                </span>
                <p className="mt-0.5 truncate text-[11px] text-slate-400" title={ctx.householdName}>
                  Role: {roleLabel}
                </p>
              </div>
            </div>
            <HomeSwitcher homes={homes} />

            {/* Nav — scrolls internally when the list is long */}
            <div className="-mr-1 mt-4 flex-1 overflow-y-auto pr-1">
              <DashboardNav items={items} />
            </div>

            {/* Impact card */}
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-brand-500">
                  <Heart className="h-5 w-5" fill="currentColor" />
                </span>
                <p className="text-xs font-medium text-slate-600">You&rsquo;re making a difference every day.</p>
              </div>
              <Link
                href="/dashboard"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                View impact <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-3 border-t border-cream-200 pt-3">
              <SignOutButton />
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          {/* Mobile header + dropdown nav */}
          <div className="mb-4 md:hidden">
            <div className="flex items-center justify-between rounded-2xl border border-cream-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white">
                  <Heart className="h-[18px] w-[18px]" fill="currentColor" />
                </span>
                <div>
                  <p className="text-sm font-bold leading-tight text-brand-600">Foster</p>
                  <span className="badge bg-brand-100 text-[10px] font-bold uppercase text-brand-700">
                    {ctx.tier} plan
                  </span>
                </div>
              </div>
              <SignOutButton />
            </div>
          </div>
          {agencyBrand && (
            <div
              className="mb-4 flex items-center gap-3 rounded-2xl border border-cream-200 bg-white p-3 shadow-sm"
              style={agencyBrand.brandColor ? { borderLeftColor: agencyBrand.brandColor, borderLeftWidth: 4 } : undefined}
            >
              {agencyBrand.logoStorageKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/api/branding/logo" alt="" className="h-9 w-9 rounded-lg object-contain" />
              )}
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Overseen by</p>
                <p
                  className="truncate text-sm font-semibold text-slate-800"
                  style={agencyBrand.brandColor ? { color: agencyBrand.brandColor } : undefined}
                >
                  {agencyBrand.displayName || agencyBrand.name}
                </p>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
      {/* App-style bottom navigation (mobile only). */}
      <MobileTabBar items={items} />
      <IdleLogout />
    </div>
  );
}
