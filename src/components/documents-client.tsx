'use client';

import { useEffect, useState } from 'react';
import { DOCUMENT_CATEGORY } from '@/lib/enums';

interface Doc {
  id: string;
  title: string;
  category: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
}

const CATEGORIES = DOCUMENT_CATEGORY;

export function DocumentsClient({ canWrite, fixedChildId }: { canWrite: boolean; fixedChildId?: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const listUrl = fixedChildId ? `/api/documents?childId=${encodeURIComponent(fixedChildId)}` : '/api/documents';

  async function load() {
    setLoading(true);
    const res = await fetch(listUrl);
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listUrl]);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (fixedChildId) fd.set('childId', fixedChildId);
    const res = await fetch('/api/documents', { method: 'POST', body: fd });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || 'Upload failed.');
      return;
    }
    (e.target as HTMLFormElement).reset();
    await load();
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) setDocs((p) => p.filter((d) => d.id !== id));
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Documents</h1>
      {canWrite && (
        <form onSubmit={onUpload} className="card mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="title">Title *</label>
            <input id="title" name="title" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" name="category" className="input" defaultValue="OTHER">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="file">File (PDF, image, or document, max 10MB) *</label>
            <input id="file" name="file" type="file" required className="input" />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Uploading…' : 'Upload securely'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No documents uploaded yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{d.title}</td>
                  <td className="px-4 py-3 text-slate-600">{d.category.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <a href={`/api/files/${d.id}`} className="text-brand-700 hover:underline">
                      {d.originalName}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{(d.sizeBytes / 1024).toFixed(0)} KB</td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <button onClick={() => onDelete(d.id)} className="text-xs text-red-600 hover:underline">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
