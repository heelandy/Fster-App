'use client';

import { useCallback, useEffect, useState } from 'react';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'datetime' | 'number' | 'money' | 'select' | 'childSelect';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface ColumnDef {
  key: string;
  label: string;
  kind?: 'text' | 'date' | 'datetime' | 'money' | 'enum' | 'childName';
}

interface Props {
  title: string;
  endpoint: string; // e.g. /api/children
  fields: FieldDef[];
  columns: ColumnDef[];
  canWrite: boolean;
  emptyText?: string;
}

type Row = Record<string, unknown>;

function formatCell(row: Row, col: ColumnDef): string {
  const v = row[col.key];
  if (v == null || v === '') return '—';
  switch (col.kind) {
    case 'date':
      // Date-only values are stored as UTC midnight; format in UTC so they show
      // the calendar date the user entered (not shifted a day in other zones).
      return new Date(String(v)).toLocaleDateString(undefined, { timeZone: 'UTC' });
    case 'datetime':
      return new Date(String(v)).toLocaleString();
    case 'money':
      return `$${(Number(v) / 100).toFixed(2)}`;
    case 'enum':
      return String(v).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    case 'childName': {
      const child = row['child'] as { preferredName?: string; firstName?: string } | null;
      return child ? child.preferredName || child.firstName || '—' : '—';
    }
    default:
      return String(v);
  }
}

export function CrudResource({ title, endpoint, fields, columns, canWrite, emptyText }: Props) {
  const [items, setItems] = useState<Row[]>([]);
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(endpoint);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [endpoint]);

  useEffect(() => {
    load();
    if (fields.some((f) => f.type === 'childSelect')) {
      fetch('/api/children')
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: Row[]) =>
          setChildren(
            rows.map((c) => ({
              id: String(c.id),
              name: String(c.preferredName || c.firstName || 'Child'),
            })),
          ),
        )
        .catch(() => {});
    }
  }, [load, fields]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = fd.get(f.name);
      if (raw == null || raw === '') continue;
      if (f.type === 'money') payload[f.name] = Math.round(Number(raw) * 100);
      else if (f.type === 'number') payload[f.name] = Number(raw);
      else payload[f.name] = String(raw);
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const fieldErr = d?.fields ? Object.values(d.fields).flat()[0] : null;
      setError((fieldErr as string) || d?.error || 'Could not save.');
      return;
    }
    (e.target as HTMLFormElement).reset();
    setShowForm(false);
    await load();
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {canWrite && (
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Close' : `+ New`}
          </button>
        )}
      </div>

      {showForm && canWrite && (
        <form onSubmit={onSubmit} className="card mb-6 grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <label className="label" htmlFor={f.name}>
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea id={f.name} name={f.name} rows={3} className="input" placeholder={f.placeholder} />
              ) : f.type === 'select' ? (
                <select id={f.name} name={f.name} className="input" defaultValue="">
                  <option value="" disabled={f.required}>Select…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === 'childSelect' ? (
                <select id={f.name} name={f.name} className="input" defaultValue="" required={f.required}>
                  <option value="">{f.required ? 'Select a child…' : '— None —'}</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={f.name}
                  name={f.name}
                  type={
                    f.type === 'money' || f.type === 'number'
                      ? 'number'
                      : f.type === 'date'
                        ? 'date'
                        : f.type === 'datetime'
                          ? 'datetime-local'
                          : 'text'
                  }
                  step={f.type === 'money' ? '0.01' : undefined}
                  required={f.required}
                  placeholder={f.placeholder}
                  className="input"
                />
              )}
            </div>
          ))}
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{emptyText || 'Nothing here yet.'}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>
                ))}
                {canWrite && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={String(row.id)} className="border-b border-slate-100 last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-slate-700">{formatCell(row, c)}</td>
                  ))}
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onDelete(String(row.id))} className="text-xs text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
