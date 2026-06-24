'use client';

import { useState } from 'react';
import { Home, Calendar, Star, Heart, ChevronRight } from 'lucide-react';

export type TimelineKind = 'placement' | 'appointment' | 'journal' | 'behavior';
export interface TimelineEvent { date: string; kind: TimelineKind; label: string }
export interface TimelineChild { id: string; name: string; events: TimelineEvent[] }

const KIND: Record<TimelineKind, { Icon: typeof Home; chip: string }> = {
  placement: { Icon: Home, chip: 'bg-brand-100 text-brand-700' },
  appointment: { Icon: Calendar, chip: 'bg-sky-100 text-sky-700' },
  journal: { Icon: Star, chip: 'bg-amber-100 text-amber-700' },
  behavior: { Icon: Heart, chip: 'bg-rose-100 text-rose-700' },
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { timeZone: 'UTC' });

/**
 * Per-child timeline. Pick a child on the left; their chronological journey
 * (newest first) renders on the right. One child is selected by default.
 */
export function TimelineExplorer({ data }: { data: TimelineChild[] }) {
  const [selectedId, setSelectedId] = useState(data[0]?.id ?? '');
  const selected = data.find((c) => c.id === selectedId) ?? data[0];

  return (
    <div className="grid gap-4 md:grid-cols-[240px,1fr]">
      {/* Child list */}
      <ul className="space-y-1">
        {data.map((c) => {
          const active = c.id === selected?.id;
          return (
            <li key={c.id}>
              <button
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${active ? 'border-brand-200 bg-brand-50 font-semibold text-brand-700' : 'border-cream-200 bg-white text-slate-700 hover:bg-cream-50'}`}
              >
                <span className="min-w-0 truncate">{c.name}</span>
                <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-slate-400">
                  {c.events.length}
                  <ChevronRight className={`h-4 w-4 ${active ? 'text-brand-500' : 'text-slate-300'}`} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Selected child's timeline */}
      <div>
        {!selected ? (
          <div className="card text-sm text-slate-400">Select a child to see their timeline.</div>
        ) : selected.events.length === 0 ? (
          <div className="card text-sm text-slate-400">No events recorded yet for {selected.name}.</div>
        ) : (
          <ol className="card space-y-4">
            {selected.events.map((e, i) => {
              const { Icon, chip } = KIND[e.kind];
              return (
                <li key={i} className="flex gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chip}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800">{e.label}</p>
                    <p className="text-xs text-slate-500">{fmt(e.date)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
