'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X, ShieldCheck, ShieldAlert, Clock, Building2 } from 'lucide-react';

interface Check {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}
interface AgencyRow {
  id: string;
  name: string;
  displayName: string | null;
  status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  submittedAt: string | null;
  verifiedAt: string | null;
  reviewNote: string | null;
  members: number;
  homes: number;
  details: {
    legalName: string | null;
    ein: string | null;
    npi: string | null;
    usState: string | null;
    licenseNumber: string | null;
    phone: string | null;
    addressLine: string | null;
    city: string | null;
    postalCode: string | null;
    website: string | null;
  };
  checks: Check[];
  npiLookup: NpiLookup | null;
}
interface NpiLookup {
  found: boolean;
  number?: string;
  type?: string;
  name?: string;
  state?: string;
  city?: string;
  status?: string;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-700',
  UNVERIFIED: 'bg-slate-100 text-slate-600',
};
const FILTERS = ['PENDING', 'VERIFIED', 'REJECTED', 'all'] as const;

export function AdminAgencies() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('PENDING');
  const [rows, setRows] = useState<AgencyRow[] | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    const r = await fetch(`/api/admin/agencies?status=${filter}`);
    if (r.ok) {
      const d = await r.json();
      setRows(d.agencies);
      setProviderConfigured(d.externalProviderConfigured);
    } else {
      setRows([]);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    let note: string | undefined;
    if (action === 'reject') {
      const r = prompt('Reason for rejection (shown to the agency so they can fix it):');
      if (r === null) return;
      note = r;
    } else if (!confirm('Approve this agency? Its oversight features unlock immediately.')) {
      return;
    }
    setBusy(id);
    const res = await fetch(`/api/admin/agencies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d?.error || 'Action failed.');
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Building2 className="h-5 w-5 text-brand-600" /> Agency verification
          </h2>
          <p className="text-sm text-slate-600">
            Confirm each agency is a real, licensed US organisation before it can oversee foster homes.
          </p>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === f ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Automatic provider check: {providerConfigured ? 'configured (runs on approval)' : 'not configured — manual review only'}.
      </p>

      {rows === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card text-sm text-slate-500">No agencies in this view.</div>
      ) : (
        rows.map((a) => (
          <div key={a.id} className="card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  {a.status === 'VERIFIED' ? <ShieldCheck className="h-4 w-4 text-green-600" /> : a.status === 'REJECTED' ? <ShieldAlert className="h-4 w-4 text-red-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
                  {a.displayName || a.name}
                  <span className={`badge ${STATUS_BADGE[a.status]}`}>{a.status.toLowerCase()}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {a.members} staff · {a.homes} {a.homes === 1 ? 'home' : 'homes'}
                  {a.submittedAt ? ` · submitted ${new Date(a.submittedAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              {a.status !== 'VERIFIED' && (
                <div className="flex gap-2">
                  <button onClick={() => decide(a.id, 'approve')} disabled={busy === a.id} className="btn-primary inline-flex items-center gap-1 text-sm">
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button onClick={() => decide(a.id, 'reject')} disabled={busy === a.id} className="btn-secondary inline-flex items-center gap-1 text-sm text-red-600">
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              )}
              {a.status === 'VERIFIED' && (
                <button onClick={() => decide(a.id, 'reject')} disabled={busy === a.id} className="btn-secondary inline-flex items-center gap-1 text-sm text-red-600">
                  <X className="h-4 w-4" /> Revoke
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <dl className="space-y-1 text-sm">
                <Detail label="Legal name" value={a.details.legalName} />
                <Detail label="EIN" value={a.details.ein} />
                <Detail label="NPI" value={a.details.npi} />
                <Detail label="State" value={a.details.usState} />
                <Detail label="License #" value={a.details.licenseNumber} />
                <Detail label="Address" value={[a.details.addressLine, a.details.city, a.details.postalCode].filter(Boolean).join(', ') || null} />
                <Detail label="Phone" value={a.details.phone} />
                <Detail
                  label="Website"
                  value={a.details.website}
                  href={a.details.website || undefined}
                />
              </dl>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Automatic checks</p>
                <ul className="space-y-1 text-sm">
                  {a.checks.map((c) => (
                    <li key={c.key} className="flex items-start gap-2">
                      {c.pass ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                      <span className={c.pass ? 'text-slate-700' : 'text-red-600'}>
                        {c.label}
                        <span className="text-slate-400"> — {c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {a.details.npi && (
              <div className={`rounded-lg border p-3 text-sm ${a.npiLookup?.found ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {a.npiLookup?.found ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
                  NPI registry (NPPES)
                </p>
                {a.npiLookup?.found ? (
                  <p className="mt-1 text-slate-700">
                    <span className="font-medium">{a.npiLookup.name || 'Registered'}</span>
                    {a.npiLookup.type ? ` · ${a.npiLookup.type === 'NPI-2' ? 'organization' : 'individual'}` : ''}
                    {a.npiLookup.city || a.npiLookup.state ? ` · ${[a.npiLookup.city, a.npiLookup.state].filter(Boolean).join(', ')}` : ''}
                    {a.npiLookup.status ? ` · status ${a.npiLookup.status === 'A' ? 'active' : a.npiLookup.status}` : ''}
                    {a.npiLookup.state && a.details.usState && a.npiLookup.state !== a.details.usState && (
                      <span className="ml-1 font-medium text-amber-700">(state differs from submitted {a.details.usState})</span>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-amber-700">Not found in the NPPES registry — verify manually.</p>
                )}
              </div>
            )}

            {a.reviewNote && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium">Review note:</span> {a.reviewNote}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function Detail({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">{value}</a>
          ) : (
            value
          )
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </dd>
    </div>
  );
}
