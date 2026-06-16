'use client';

import { useEffect, useState } from 'react';

interface Point { date: string; signups: number; activeUsers: number }
interface Analytics {
  series: Point[];
  kpis: {
    dau: number; wau: number; mau: number; totalUsers: number;
    newUsers30d: number; activeSubs: number; canceled30d: number; churnRatePct: number;
  };
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

/** Dependency-free SVG bar chart. */
function BarChart({ data, accessor, color, label }: {
  data: Point[];
  accessor: (p: Point) => number;
  color: string;
  label: string;
}) {
  const max = Math.max(1, ...data.map(accessor));
  const W = 640, H = 140, pad = 4;
  const bw = (W - pad * 2) / data.length;
  return (
    <div className="card">
      <h3 className="mb-2 font-semibold text-slate-900">{label}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {data.map((p, i) => {
          const v = accessor(p);
          const h = (v / max) * (H - 24);
          return (
            <g key={p.date}>
              <rect
                x={pad + i * bw + 1}
                y={H - h - 16}
                width={Math.max(1, bw - 2)}
                height={h}
                rx={1.5}
                fill={color}
              >
                <title>{`${p.date}: ${v}`}</title>
              </rect>
            </g>
          );
        })}
        <text x={pad} y={H - 2} fontSize="9" fill="#94a3b8">{data[0]?.date}</text>
        <text x={W - pad} y={H - 2} fontSize="9" fill="#94a3b8" textAnchor="end">{data[data.length - 1]?.date}</text>
      </svg>
      <p className="mt-1 text-right text-xs text-slate-400">peak {max}</p>
    </div>
  );
}

export function AdminAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  if (err) return <div className="card text-sm text-slate-500">You don’t have permission to view analytics, or it failed to load.</div>;
  if (!data) return <p className="text-sm text-slate-500">Loading analytics…</p>;

  const { kpis, series } = data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Active today (DAU)" value={kpis.dau} />
        <Kpi label="Active this week (WAU)" value={kpis.wau} />
        <Kpi label="Active this month (MAU)" value={kpis.mau} />
        <Kpi label="Total users" value={kpis.totalUsers} sub={`${kpis.newUsers30d} new in 30d`} />
        <Kpi label="Active subscriptions" value={kpis.activeSubs} />
        <Kpi label="Canceled (30d)" value={kpis.canceled30d} />
        <Kpi label="Churn rate (30d)" value={`${kpis.churnRatePct}%`} />
        <Kpi label="Stickiness (DAU/MAU)" value={kpis.mau ? `${Math.round((kpis.dau / kpis.mau) * 100)}%` : '—'} />
      </div>
      <BarChart data={series} accessor={(p) => p.signups} color="#b45309" label="New sign-ups per day (30d)" />
      <BarChart data={series} accessor={(p) => p.activeUsers} color="#0ea5e9" label="Active users per day (30d)" />
      <p className="text-xs text-slate-400">
        Active-user counts are derived from successful sign-ins. No private data is used.
      </p>
    </div>
  );
}
