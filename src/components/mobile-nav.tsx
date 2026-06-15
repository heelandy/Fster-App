'use client';

import { useState } from 'react';
import { DashboardNav, type NavItem } from './dashboard-nav';

/** Collapsible dropdown version of the sidebar nav, shown on small screens. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="btn-secondary w-full justify-between"
      >
        <span>☰ Menu</span>
        <span className={`transition ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        // Clicking a link bubbles here and closes the menu after navigation.
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm" onClick={() => setOpen(false)}>
          <DashboardNav items={items} />
        </div>
      )}
    </div>
  );
}
