'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { NAV_ICONS, type IconKey } from './nav-icons';

export interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
}

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        const { Icon, color, chip } = NAV_ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition ${
              active
                ? 'bg-gradient-to-r from-brand-400 to-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-cream-100'
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                active ? 'bg-white/20 text-white' : `${chip} ${color}`
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span className="flex-1 truncate">{item.label}</span>
            <ChevronRight
              className={`h-4 w-4 shrink-0 ${active ? 'text-white/80' : 'text-slate-300 group-hover:text-slate-400'}`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
