'use client';

import { useState } from 'react';

interface Expense {
  category: string;
  description: string;
  amountCents: number;
  spentAt: string;
}

/**
 * Presentational summary — totals are computed on the server and passed in, so
 * this does NOT refetch the expense list (the sibling table already fetches it).
 * The CSV export fetches on demand only when the button is clicked.
 */
export function ExpenseSummary({ monthCents, yearCents }: { monthCents: number; yearCents: number }) {
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch('/api/expenses');
      if (!res.ok) return;
      const rows: Expense[] = await res.json();
      const header = 'Date,Category,Description,Amount\n';
      const body = rows
        .map((r) =>
          [
            new Date(r.spentAt).toISOString().slice(0, 10),
            r.category,
            `"${r.description.replaceAll('"', '""')}"`,
            (r.amountCents / 100).toFixed(2),
          ].join(','),
        )
        .join('\n');
      const blob = new Blob([header + body], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses-${new Date().getFullYear()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <div className="card">
        <p className="text-xs uppercase text-slate-500">This month</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">${(monthCents / 100).toFixed(2)}</p>
      </div>
      <div className="card">
        <p className="text-xs uppercase text-slate-500">This year</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">${(yearCents / 100).toFixed(2)}</p>
      </div>
      <div className="card flex items-center justify-center">
        <button onClick={exportCsv} disabled={exporting} className="btn-secondary">
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </button>
      </div>
    </div>
  );
}
