'use client';

import { useEffect, useState } from 'react';
import { ROUTINE_TYPE } from '@/lib/enums';

interface SubItem {
  id: string;
  title: string;
  isDone: boolean;
}
interface Parent {
  id: string;
  name: string;
  type: string;
  items: SubItem[];
}

const TYPES = ROUTINE_TYPE;

interface Props {
  title: string;
  endpoint: string; // /api/routines or /api/checklists
  itemToggleEndpoint: string; // /api/routine-tasks or /api/checklist-items
  itemsKey: 'tasks' | 'items'; // payload key + response key for sub-items
  canWrite: boolean;
  /** When set, scopes the list + create to a single child (per-child view). */
  fixedChildId?: string;
}

export function ChecklistClient({ title, endpoint, itemToggleEndpoint, itemsKey, canWrite, fixedChildId }: Props) {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const listUrl = fixedChildId ? `${endpoint}?childId=${encodeURIComponent(fixedChildId)}` : endpoint;

  function normalize(rows: Record<string, unknown>[]): Parent[] {
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      type: String(r.type),
      items: ((r[itemsKey] as SubItem[]) ?? []).map((i) => ({ id: i.id, title: i.title, isDone: i.isDone })),
    }));
  }

  async function load() {
    setLoading(true);
    const res = await fetch(listUrl);
    if (res.ok) setParents(normalize(await res.json()));
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listUrl]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const itemLines = String(fd.get('items') || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload: Record<string, unknown> = {
      name: String(fd.get('name')),
      type: String(fd.get('type')),
      [itemsKey]: itemLines,
    };
    if (fixedChildId) payload.childId = fixedChildId;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || 'Could not save.');
      return;
    }
    (e.target as HTMLFormElement).reset();
    setShowForm(false);
    await load();
  }

  async function toggle(parentId: string, item: SubItem) {
    const res = await fetch(`${itemToggleEndpoint}/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone: !item.isDone }),
    });
    if (res.ok) {
      setParents((prev) =>
        prev.map((p) =>
          p.id === parentId
            ? { ...p, items: p.items.map((i) => (i.id === item.id ? { ...i, isDone: !i.isDone } : i)) }
            : p,
        ),
      );
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this?')) return;
    const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE' });
    if (res.ok) setParents((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {canWrite && (
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Close' : '+ New'}
          </button>
        )}
      </div>

      {showForm && canWrite && (
        <form onSubmit={onCreate} className="card mb-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Name *</label>
              <input id="name" name="name" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="type">Type</label>
              <select id="type" name="type" className="input" defaultValue="CUSTOM">
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="items">Items (one per line)</label>
            <textarea id="items" name="items" rows={5} className="input" placeholder={'Brush teeth\nPack backpack\nLay out clothes'} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : parents.length === 0 ? (
        <div className="card text-sm text-slate-500">Nothing here yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {parents.map((p) => {
            const done = p.items.filter((i) => i.isDone).length;
            return (
              <div key={p.id} className="card">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <span className="badge bg-slate-100 text-slate-600">{p.type.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">{done}/{p.items.length}</span>
                    {canWrite && (
                      <button onClick={() => onDelete(p.id)} className="ml-3 text-xs text-red-600 hover:underline">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <ul className="space-y-2">
                  {p.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={i.isDone}
                        disabled={!canWrite}
                        onChange={() => toggle(p.id, i)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className={i.isDone ? 'text-sm text-slate-400 line-through' : 'text-sm text-slate-700'}>
                        {i.title}
                      </span>
                    </li>
                  ))}
                  {p.items.length === 0 && <li className="text-sm text-slate-400">No items.</li>}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
