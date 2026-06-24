'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal, X, Heart } from 'lucide-react';
import { NAV_ICONS } from './nav-icons';
import { DashboardNav, type NavItem } from './dashboard-nav';

/**
 * Native-app-style bottom tab bar, shown only on small screens (md:hidden). It
 * surfaces up to four primary destinations plus a "More" tab that opens a
 * bottom sheet with the full navigation. Replaces the old dropdown menu so the
 * app feels like an installed PWA. Lucide icons only (no emoji).
 */

// Preferred primary tabs, in priority order. Only those the signed-in user
// actually has (present in `items`) are shown; the first four win, the rest fold
// into "More". A short list keeps the bar uncluttered on narrow phones.
const PRIMARY_ORDER = [
  '/dashboard',
  '/dashboard/today',
  '/dashboard/children',
  '/dashboard/appointments',
  '/dashboard/medications',
  '/dashboard/care-logs',
];

export function MobileTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const byHref = new Map(items.map((i) => [i.href, i]));
  const primary: NavItem[] = [];
  for (const href of PRIMARY_ORDER) {
    const it = byHref.get(href);
    if (it && !primary.includes(it)) primary.push(it);
    if (primary.length === 4) break;
  }
  // If the user lacks some of the preferred tabs, top up from the front of the list.
  if (primary.length < 4) {
    for (const it of items) {
      if (!primary.includes(it)) primary.push(it);
      if (primary.length === 4) break;
    }
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  // Highlight "More" when the current page lives behind it (not a primary tab).
  const onMorePage = !primary.some((p) => isActive(p.href));

  return (
    <>
      {/* Full-screen "More" sheet */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="mt-auto rounded-t-3xl border-t border-cream-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white">
                  <Heart className="h-[18px] w-[18px]" fill="currentColor" />
                </span>
                <span className="text-lg font-bold text-brand-600">Menu</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-2 text-slate-500 hover:bg-cream-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Tapping any link navigates and closes the sheet. */}
            <div
              className="max-h-[65vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
              onClick={() => setOpen(false)}
            >
              <DashboardNav items={items} />
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {primary.map((item) => {
            const active = isActive(item.href);
            const { Icon } = NAV_ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  active ? 'text-brand-600' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            aria-label="More"
            aria-expanded={open}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
              open || onMorePage ? 'text-brand-600' : 'text-slate-500'
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
