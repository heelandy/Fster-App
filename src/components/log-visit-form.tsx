'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ChildOpt { id: string; name: string }

/**
 * Foster-parent form to log an (often unscheduled) visit. "Who visited" and the
 * reason are required; date defaults to today. Posts to the household-scoped
 * /api/visits route, then refreshes the server-rendered list.
 */
export function LogVisitForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<ChildOpt[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!open || children.length) return;
    fetch('/api/children')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Record<string, unknown>[]) =>
        setChildren(rows.map((c) => ({ id: String(c.id), name: String(c.preferredName || c.firstName || 'Child') }))),
      )
      .catch(() => {});
  }, [open, children.length]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      visitDate: String(fd.get('visitDate')),
      visitor: String(fd.get('visitor')),
      summary: String(fd.get('summary')),
    };
    const visitType = String(fd.get('visitType') || '');
    const childId = String(fd.get('childId') || '');
    if (visitType) payload.visitType = visitType;
    if (childId) payload.childId = childId;

    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const fieldErr = d?.fields ? Object.values(d.fields).flat()[0] : null;
      setError((fieldErr as string) || d?.error || 'Could not save the visit.');
      return;
    }
    (e.target as HTMLFormElement).reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mb-6">
      <button className="btn-primary" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : '+ Log a visit'}
      </button>
      {open && (
        <form onSubmit={onSubmit} className="card mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="visitor">Who visited <span className="text-red-500">*</span></label>
            <input id="visitor" name="visitor" required className="input" placeholder="e.g. Caseworker Jane Doe" />
          </div>
          <div>
            <label className="label" htmlFor="visitDate">Date <span className="text-red-500">*</span></label>
            <input id="visitDate" name="visitDate" type="date" required defaultValue={today} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="visitType">Type</label>
            <select id="visitType" name="visitType" className="input" defaultValue="">
              <option value="">— Select —</option>
              <option value="Caseworker visit">Caseworker visit</option>
              <option value="Biological family">Biological family</option>
              <option value="Therapist">Therapist</option>
              <option value="School">School</option>
              <option value="Medical">Medical</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="childId">Child (optional)</label>
            <select id="childId" name="childId" className="input" defaultValue="">
              <option value="">— None —</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="summary">Reason for visit <span className="text-red-500">*</span></label>
            <textarea id="summary" name="summary" rows={3} required className="input" placeholder="Why did they visit? What happened?" />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving…' : 'Save visit'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
