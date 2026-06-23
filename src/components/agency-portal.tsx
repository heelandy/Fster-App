'use client';

import { useCallback, useEffect, useState } from 'react';

type Tab = 'overview' | 'homes' | 'staff' | 'incidents' | 'announcements' | 'reports';

interface Totals { homes: number; staff: number; children: number; complianceAlerts: number; activePlacements: number; pendingPlacements: number; availableHomes: number; openIncidents: number }
interface HomeRow { id: string; name: string; fosterStatus: string; ownerName: string | null; ownerEmail: string; children: number; complianceAlerts: number }
interface StaffRow { id: string; role: string; name: string | null; email: string; isYou: boolean }
interface IncidentRow { id: string; title: string; description: string | null; severity: string; status: string; resolution: string | null; createdAt: string; household: { id: string; name: string } }
interface AnnouncementRow { id: string; title: string; body: string | null; createdAt: string }
interface ReportData {
  placementsByStatus: Record<string, number>;
  incidentsByStatus: Record<string, number>;
  goalsByStatus: Record<string, number>;
  visits: { scheduled: number; completed: number };
  complianceAlerts: number;
  staffPerformance: { name: string; role: string; placements: number; visits: number }[];
}
interface HomeDetail {
  home: { id: string; name: string; fosterStatus: string; ownerName: string | null; ownerEmail: string | null };
  children: { id: string; firstName: string; preferredName: string | null; placementStatus: string; dateOfBirth: string | null; school: string | null; caseNumber: string | null; caseworkerName: string | null }[];
  placements: { id: string; status: string; placementDate: string; endDate: string | null; child: { firstName: string; preferredName: string | null } }[];
  licensing: { id: string; name: string; status: string; dueDate: string | null }[];
  visits: { id: string; visitDate: string; visitType: string | null; summary: string | null; status: string }[];
  goals: { id: string; title: string; description: string | null; status: string; targetDate: string | null }[];
  trainingHours: { totalHours: number; count: number };
  upcomingAppointments: number;
}

const ROLE_LABEL: Record<string, string> = { AGENCY_ADMIN: 'Agency admin', CASE_WORKER: 'Case worker', AGENCY_VIEWER: 'Viewer' };
const STATUS_BADGE: Record<string, string> = { APPROVED: 'bg-green-100 text-green-800', PENDING: 'bg-amber-100 text-amber-800', SUSPENDED: 'bg-red-100 text-red-800' };

export function AgencyPortal({ role, agencyName }: { role: string; agencyName: string }) {
  const isAdmin = role === 'AGENCY_ADMIN';
  const canAssign = isAdmin || role === 'CASE_WORKER';
  const [tab, setTab] = useState<Tab>('overview');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [homes, setHomes] = useState<HomeRow[] | null>(null);
  const [requests, setRequests] = useState<{ id: string; status: string; homeName: string; ownerName: string | null; ownerEmail: string }[] | null>(null);
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [incidents, setIncidents] = useState<IncidentRow[] | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[] | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [detail, setDetail] = useState<HomeDetail | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const r = await fetch('/api/agency'); if (r.ok) setTotals((await r.json()).totals);
  }, []);
  const loadHomes = useCallback(async () => {
    const r = await fetch('/api/agency/homes'); if (r.ok) setHomes(await r.json());
  }, []);
  const loadRequests = useCallback(async () => {
    const r = await fetch('/api/agency/oversight-requests'); if (r.ok) setRequests(await r.json());
  }, []);
  const loadStaff = useCallback(async () => {
    const r = await fetch('/api/agency/staff'); if (r.ok) setStaff(await r.json());
  }, []);
  const loadIncidents = useCallback(async () => {
    const r = await fetch('/api/agency/incidents'); if (r.ok) setIncidents(await r.json());
  }, []);
  const loadAnnouncements = useCallback(async () => {
    const r = await fetch('/api/agency/announcements'); if (r.ok) setAnnouncements(await r.json());
  }, []);
  const loadReport = useCallback(async () => {
    const r = await fetch('/api/agency/report'); if (r.ok) setReport(await r.json());
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => {
    if (tab === 'homes' && !homes) void loadHomes();
    if (tab === 'homes' && !requests) void loadRequests();
    if (tab === 'staff' && !staff) void loadStaff();
    if (tab === 'incidents' && !incidents) void loadIncidents();
    if (tab === 'announcements' && !announcements) void loadAnnouncements();
    if (tab === 'reports' && !report) void loadReport();
  }, [tab, homes, requests, staff, incidents, announcements, report, loadHomes, loadRequests, loadStaff, loadIncidents, loadAnnouncements, loadReport]);

  async function openHome(id: string) {
    setDetail(null);
    const r = await fetch(`/api/agency/homes/${id}`);
    if (r.ok) setDetail(await r.json());
  }
  async function requestOversight(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(null); setNotice(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email'));
    const r = await fetch('/api/agency/homes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d?.error || 'Could not send the request.'); return; }
    setNotice(`Request sent to ${email} — awaiting the foster parent's approval.`);
    (e.target as HTMLFormElement).reset(); setRequests(null); await loadRequests(); await loadOverview();
  }
  async function unlinkHome(id: string) {
    if (!confirm('Stop overseeing this home? The foster parent keeps it.')) return;
    await fetch(`/api/agency/homes/${id}`, { method: 'DELETE' });
    setDetail(null); setHomes(null); await loadHomes(); await loadOverview();
  }
  async function createHome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(null);
    const fd = new FormData(e.currentTarget);
    const r = await fetch('/api/agency/homes/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeName: String(fd.get('homeName')), fosterParentEmail: String(fd.get('fosterParentEmail')) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d?.error || 'Could not create the home.'); return; }
    (e.target as HTMLFormElement).reset(); setHomes(null); await loadHomes(); await loadOverview();
  }
  async function addStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(null); setNotice(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email'));
    const r = await fetch('/api/agency/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role: String(fd.get('role')) }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d?.error || 'Could not add staff.'); return; }
    setNotice(d?.invited ? `Invitation emailed to ${email}.` : `${email} added to your staff.`);
    (e.target as HTMLFormElement).reset(); setStaff(null); await loadStaff(); await loadOverview();
  }
  async function removeStaff(id: string) {
    if (!confirm('Remove this staff member from the agency?')) return;
    await fetch(`/api/agency/staff/${id}`, { method: 'DELETE' });
    setStaff(null); await loadStaff(); await loadOverview();
  }
  async function setHomeStatus(id: string, fosterStatus: string) {
    const r = await fetch(`/api/agency/homes/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fosterStatus }) });
    if (!r.ok) { setMsg('Could not update the home status.'); return; }
    setHomes(null); await loadHomes(); await openHome(id);
  }
  async function transferChild(fromHomeId: string, childId: string, toHomeId: string) {
    const r = await fetch(`/api/agency/homes/${fromHomeId}/transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ childId, toHomeId }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d?.error || 'Could not transfer the child.'); return; }
    setHomes(null); await loadHomes(); await openHome(fromHomeId); await loadOverview();
  }
  async function updateIncident(id: string, status: string, resolution?: string) {
    const r = await fetch(`/api/agency/incidents/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...(resolution !== undefined ? { resolution } : {}) }) });
    if (!r.ok) { setMsg('Could not update the incident.'); return; }
    setIncidents(null); await loadIncidents(); await loadOverview();
  }
  async function createAnnouncement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(null);
    const fd = new FormData(e.currentTarget);
    const r = await fetch('/api/agency/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: String(fd.get('title')), body: String(fd.get('body') || '') }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d?.error || 'Could not post the announcement.'); return; }
    (e.target as HTMLFormElement).reset(); setAnnouncements(null); await loadAnnouncements();
  }

  const tabBtn = (k: Tab, label: string) => (
    <button onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
  );

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{agencyName}</h1>
        <span className="badge bg-brand-100 text-brand-800">{ROLE_LABEL[role] ?? role}</span>
      </div>
      <p className="mb-4 text-sm text-slate-600">Oversight across your agency’s foster homes. You only see homes linked to this agency.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabBtn('overview', 'Overview')}
        {tabBtn('homes', 'Homes')}
        {canAssign && tabBtn('incidents', 'Incidents')}
        {tabBtn('announcements', 'Announcements')}
        {tabBtn('reports', 'Reports')}
        {isAdmin && tabBtn('staff', 'Staff')}
      </div>
      {msg && <p className="mb-3 text-sm text-red-600">{msg}</p>}
      {notice && <p className="mb-3 text-sm text-green-700">{notice}</p>}

      {tab === 'overview' && (
        totals ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Foster homes" value={totals.homes} />
            <Stat label="Available homes" value={totals.availableHomes} />
            <Stat label="Children" value={totals.children} />
            <Stat label="Active placements" value={totals.activePlacements} />
            <Stat label="Placement requests" value={totals.pendingPlacements} alert={totals.pendingPlacements > 0} />
            <Stat label="Open incidents" value={totals.openIncidents} alert={totals.openIncidents > 0} />
            <Stat label="Staff" value={totals.staff} />
            <Stat label="Compliance alerts" value={totals.complianceAlerts} alert={totals.complianceAlerts > 0} />
          </div>
        ) : <p className="text-sm text-slate-500">Loading…</p>
      )}

      {tab === 'homes' && (
        <div className="space-y-4">
          {canAssign && (
            <form onSubmit={createHome} className="card flex flex-wrap items-end gap-2">
              <div>
                <label className="label">Create a foster home</label>
                <input name="homeName" required placeholder="home name" className="input max-w-xs" />
              </div>
              <input name="fosterParentEmail" type="email" required placeholder="foster parent’s email (required)" className="input max-w-xs" />
              <button className="btn-secondary">Create home</button>
            </form>
          )}
          {isAdmin && (
            <form onSubmit={requestOversight} className="card flex flex-wrap items-end gap-2">
              <div>
                <label className="label">Or request oversight of an existing home</label>
                <input name="email" type="email" required placeholder="foster parent’s email" className="input max-w-xs" />
                <p className="mt-1 text-xs text-slate-400">The foster parent must approve before you can see their home.</p>
              </div>
              <button className="btn-secondary">Send request</button>
            </form>
          )}
          {isAdmin && requests && requests.length > 0 && (
            <div className="card p-0">
              <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Oversight requests</p>
              <ul className="divide-y divide-slate-100">
                {requests.map((rq) => (
                  <li key={rq.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="text-slate-700">
                      <span className="font-medium text-slate-900">{rq.homeName}</span>
                      <span className="text-slate-500"> · {rq.ownerName || rq.ownerEmail}</span>
                    </span>
                    {rq.status === 'PENDING'
                      ? <span className="badge bg-amber-100 text-amber-800">Awaiting approval</span>
                      : <span className="badge bg-slate-200 text-slate-600">Declined</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {homes === null ? <p className="text-sm text-slate-500">Loading…</p> : homes.length === 0 ? (
            <div className="card text-sm text-slate-500">No homes linked yet.{isAdmin ? ' Request one by the foster parent’s email above.' : ''}</div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Home</th><th className="px-4 py-3">Foster parent</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Children</th><th className="px-4 py-3">Alerts</th><th className="px-4 py-3" /></tr>
                </thead>
                <tbody>
                  {homes.map((h) => (
                    <tr key={h.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-800">{h.name}</td>
                      <td className="px-4 py-3 text-slate-600">{h.ownerName || h.ownerEmail}</td>
                      <td className="px-4 py-3"><span className={`badge ${STATUS_BADGE[h.fosterStatus] ?? 'bg-slate-100 text-slate-600'}`}>{h.fosterStatus.toLowerCase()}</span></td>
                      <td className="px-4 py-3 text-slate-600">{h.children}</td>
                      <td className={`px-4 py-3 ${h.complianceAlerts > 0 ? 'font-semibold text-red-600' : 'text-slate-600'}`}>{h.complianceAlerts}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openHome(h.id)} className="text-xs text-brand-700 hover:underline">View</button>
                        {isAdmin && <button onClick={() => unlinkHome(h.id)} className="ml-3 text-xs text-red-600 hover:underline">Unlink</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detail && (
            <HomeDetailPanel
              detail={detail}
              canAssign={canAssign}
              isAdmin={isAdmin}
              homes={homes ?? []}
              onClose={() => setDetail(null)}
              onAssigned={() => openHome(detail.home.id)}
              onStatus={setHomeStatus}
              onTransfer={transferChild}
            />
          )}
        </div>
      )}

      {tab === 'staff' && (
        <div className="space-y-4">
          {isAdmin && (
            <form onSubmit={addStaff} className="card flex flex-wrap items-end gap-2">
              <div>
                <label className="label">Invite staff by email</label>
                <input name="email" type="email" required placeholder="email" className="input max-w-xs" />
                <p className="mt-1 text-xs text-slate-400">Existing users are added instantly; new emails get an invite link.</p>
              </div>
              <select name="role" defaultValue="CASE_WORKER" className="input max-w-[12rem]">
                <option value="AGENCY_ADMIN">Agency admin</option>
                <option value="CASE_WORKER">Case worker</option>
                <option value="AGENCY_VIEWER">Viewer</option>
              </select>
              <button className="btn-secondary">Invite</button>
            </form>
          )}
          {staff === null ? <p className="text-sm text-slate-500">Loading…</p> : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3" /></tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-800">{s.name || '—'}{s.isYou && <span className="ml-2 badge bg-slate-100 text-slate-600">you</span>}</td>
                      <td className="px-4 py-3 text-slate-600">{s.email}</td>
                      <td className="px-4 py-3 text-slate-600">{ROLE_LABEL[s.role] ?? s.role}</td>
                      <td className="px-4 py-3 text-right">{isAdmin && !s.isYou && <button onClick={() => removeStaff(s.id)} className="text-xs text-red-600 hover:underline">Remove</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'incidents' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Incidents foster parents reported across your homes. Review, escalate, or resolve each one.</p>
          {incidents === null ? <p className="text-sm text-slate-500">Loading…</p> : incidents.length === 0 ? (
            <div className="card text-sm text-slate-500">No incidents reported.</div>
          ) : incidents.map((i) => (
            <div key={i.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{i.title} <span className={`ml-1 badge ${i.severity === 'HIGH' ? 'bg-red-100 text-red-800' : i.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{i.severity.toLowerCase()}</span></p>
                  <p className="text-xs text-slate-500">{i.household.name} · reported {new Date(i.createdAt).toLocaleDateString()}</p>
                  {i.description && <p className="mt-1 text-sm text-slate-700">{i.description}</p>}
                  {i.resolution && <p className="mt-1 text-sm text-slate-500"><span className="font-medium">Resolution:</span> {i.resolution}</p>}
                </div>
                <span className="badge bg-brand-100 text-brand-800">{i.status.replaceAll('_', ' ').toLowerCase()}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {i.status === 'REPORTED' && <button onClick={() => updateIncident(i.id, 'UNDER_REVIEW')} className="btn-secondary text-xs">Start review</button>}
                {!['ESCALATED', 'RESOLVED', 'CLOSED'].includes(i.status) && <button onClick={() => updateIncident(i.id, 'ESCALATED')} className="btn-secondary text-xs">Escalate</button>}
                {!['RESOLVED', 'CLOSED'].includes(i.status) && (
                  <button onClick={() => { const r = prompt('Resolution note (optional):') ?? undefined; updateIncident(i.id, 'RESOLVED', r); }} className="btn-secondary text-xs">Resolve</button>
                )}
                {i.status !== 'CLOSED' && <button onClick={() => updateIncident(i.id, 'CLOSED')} className="btn-secondary text-xs">Close</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'announcements' && (
        <div className="space-y-4">
          {isAdmin && (
            <form onSubmit={createAnnouncement} className="card space-y-2">
              <label className="label">Post an announcement to your homes</label>
              <input name="title" required placeholder="Title" className="input" />
              <textarea name="body" placeholder="Message (optional)" rows={2} className="input" />
              <button className="btn-secondary">Post announcement</button>
            </form>
          )}
          {announcements === null ? <p className="text-sm text-slate-500">Loading…</p> : announcements.length === 0 ? (
            <div className="card text-sm text-slate-500">No announcements yet.</div>
          ) : announcements.map((a) => (
            <div key={a.id} className="card">
              <p className="font-semibold text-slate-900">{a.title}</p>
              <p className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleDateString()}</p>
              {a.body && <p className="mt-1 text-sm text-slate-700">{a.body}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'reports' && (
        report === null ? <p className="text-sm text-slate-500">Loading…</p> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Agency report</h2>
              <a href="/api/agency/report?format=csv" className="btn-secondary text-sm">Download staff CSV</a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Breakdown title="Placements by status" data={report.placementsByStatus} />
              <Breakdown title="Incidents by status" data={report.incidentsByStatus} />
              <Breakdown title="Goals by status" data={report.goalsByStatus} />
              <Breakdown title="Visits" data={{ scheduled: report.visits.scheduled, completed: report.visits.completed, 'compliance alerts': report.complianceAlerts }} />
            </div>
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Placements</th><th className="px-4 py-3">Visits</th></tr>
                </thead>
                <tbody>
                  {report.staffPerformance.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                      <td className="px-4 py-3 text-slate-600">{ROLE_LABEL[s.role] ?? s.role}</td>
                      <td className="px-4 py-3 text-slate-600">{s.placements}</td>
                      <td className="px-4 py-3 text-slate-600">{s.visits}</td>
                    </tr>
                  ))}
                  {report.staffPerformance.length === 0 && <tr><td colSpan={4} className="px-4 py-3 text-slate-400">No staff yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      {entries.length === 0 ? <p className="mt-2 text-sm text-slate-400">None</p> : (
        <ul className="mt-2 space-y-1 text-sm">
          {entries.map(([k, v]) => (
            <li key={k} className="flex justify-between"><span className="text-slate-600">{k.replaceAll('_', ' ').toLowerCase()}</span><span className="font-semibold text-slate-800">{v}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function HomeDetailPanel({ detail, canAssign, isAdmin, homes, onClose, onAssigned, onStatus, onTransfer }: {
  detail: HomeDetail;
  canAssign: boolean;
  isAdmin: boolean;
  homes: HomeRow[];
  onClose: () => void;
  onAssigned: () => void;
  onStatus: (id: string, status: string) => void;
  onTransfer: (fromHomeId: string, childId: string, toHomeId: string) => void;
}) {
  const d = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { timeZone: 'UTC' }) : '—');
  const otherHomes = homes.filter((h) => h.id !== detail.home.id);
  const [assigning, setAssigning] = useState(false);
  const [licensingOpen, setLicensingOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [thread, setThread] = useState<{ id: string; body: string; fromAgency: boolean; createdAt: string }[] | null>(null);

  const loadThread = useCallback(async () => {
    const r = await fetch(`/api/agency/homes/${detail.home.id}/messages`);
    if (r.ok) setThread(await r.json());
  }, [detail.home.id]);
  useEffect(() => {
    let active = true;
    setThread(null);
    void (async () => {
      const r = await fetch(`/api/agency/homes/${detail.home.id}/messages`);
      if (active && r.ok) setThread(await r.json());
    })();
    return () => { active = false; };
  }, [detail.home.id]);

  async function assign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { firstName: String(fd.get('firstName')) };
    for (const k of ['lastName', 'dateOfBirth', 'caseNumber', 'caseworkerName', 'school', 'trialEndDate']) {
      const v = String(fd.get(k) || '').trim(); if (v) body[k] = v;
    }
    const res = await fetch(`/api/agency/homes/${detail.home.id}/children`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) { const x = await res.json().catch(() => ({})); setErr(x?.error || 'Could not assign the child.'); return; }
    setAssigning(false);
    onAssigned();
  }

  async function reunify(placementId: string) {
    if (!confirm('Mark this placement as reunified (child returned)?')) return;
    await fetch(`/api/agency/placements/${placementId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'REUNIFIED' }),
    });
    onAssigned();
  }

  async function override(placementId: string) {
    if (!confirm('Override: force this placement to ACTIVE, bypassing the foster parent’s accept/deny?')) return;
    await fetch(`/api/agency/placements/${placementId}/override`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ACTIVE' }),
    });
    onAssigned();
  }

  async function completeVisit(visitId: string) {
    await fetch(`/api/agency/visits/${visitId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'COMPLETED' }),
    });
    onAssigned();
  }

  async function addGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { title: String(fd.get('title')) };
    for (const k of ['description', 'targetDate']) { const v = String(fd.get(k) || '').trim(); if (v) body[k] = v; }
    const res = await fetch(`/api/agency/homes/${detail.home.id}/goals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) { const x = await res.json().catch(() => ({})); setErr(x?.error || 'Could not add the goal.'); return; }
    setGoalOpen(false);
    onAssigned();
  }

  async function setGoalStatus(goalId: string, status: string) {
    await fetch(`/api/agency/goals/${goalId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    onAssigned();
  }

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get('body') || '').trim();
    if (!body) return;
    const res = await fetch(`/api/agency/homes/${detail.home.id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
    });
    if (res.ok) { (e.target as HTMLFormElement).reset(); await loadThread(); }
  }

  async function submitLicensing(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { name: String(fd.get('name')) };
    for (const k of ['category', 'dueDate']) { const v = String(fd.get(k) || '').trim(); if (v) body[k] = v; }
    const res = await fetch(`/api/agency/homes/${detail.home.id}/licensing`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) { const x = await res.json().catch(() => ({})); setErr(x?.error || 'Could not submit the requirement.'); return; }
    setLicensingOpen(false);
    onAssigned();
  }

  async function recordVisit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { visitDate: String(fd.get('visitDate')) };
    for (const k of ['visitType', 'summary']) { const v = String(fd.get(k) || '').trim(); if (v) body[k] = v; }
    const res = await fetch(`/api/agency/homes/${detail.home.id}/visits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) { const x = await res.json().catch(() => ({})); setErr(x?.error || 'Could not record the visit.'); return; }
    setVisitOpen(false);
    onAssigned();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{detail.home.name} — oversight</h3>
        <button onClick={onClose} className="text-sm text-slate-500 hover:underline">Close</button>
      </div>
      <p className="text-xs text-slate-500">Foster parent: {detail.home.ownerName || detail.home.ownerEmail} · {detail.upcomingAppointments} upcoming appointments</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Home status:</span>
        <span className={`badge ${STATUS_BADGE[detail.home.fosterStatus] ?? 'bg-slate-100 text-slate-600'}`}>{detail.home.fosterStatus.toLowerCase()}</span>
        {isAdmin && detail.home.fosterStatus !== 'APPROVED' && <button onClick={() => onStatus(detail.home.id, 'APPROVED')} className="text-xs text-green-700 hover:underline">Approve</button>}
        {isAdmin && detail.home.fosterStatus !== 'SUSPENDED' && <button onClick={() => onStatus(detail.home.id, 'SUSPENDED')} className="text-xs text-red-600 hover:underline">Suspend</button>}
        {isAdmin && detail.home.fosterStatus !== 'PENDING' && <button onClick={() => onStatus(detail.home.id, 'PENDING')} className="text-xs text-amber-700 hover:underline">Mark pending</button>}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Children ({detail.children.length})</h4>
        {canAssign && !assigning && (
          <button onClick={() => setAssigning(true)} className="text-xs font-medium text-brand-700 hover:underline">+ Assign a child</button>
        )}
      </div>
      {assigning && (
        <form onSubmit={assign} className="mt-2 grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          <input name="firstName" required placeholder="First name *" className="input" />
          <input name="lastName" placeholder="Last name" className="input" />
          <input name="dateOfBirth" type="date" className="input" />
          <input name="caseNumber" placeholder="Case number" className="input" />
          <input name="caseworkerName" placeholder="Caseworker" className="input" />
          <input name="school" placeholder="School" className="input" />
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-500">Trial end date <span className="text-slate-400">(default 30 days; becomes a full placement after)</span></label>
            <input name="trialEndDate" type="date" className="input" />
          </div>
          {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Assigning…' : 'Assign child (trial)'}</button>
            <button type="button" onClick={() => setAssigning(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}
      <div className="mt-1 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-400"><tr><th className="py-1 pr-3">Name</th><th className="py-1 pr-3">Status</th><th className="py-1 pr-3">Case #</th><th className="py-1 pr-3">Caseworker</th><th className="py-1 pr-3">School</th>{canAssign && <th className="py-1 pr-3" />}</tr></thead>
          <tbody>
            {detail.children.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="py-1 pr-3 text-slate-800">{c.preferredName || c.firstName}</td>
                <td className="py-1 pr-3 text-slate-600">{c.placementStatus.replaceAll('_', ' ').toLowerCase()}</td>
                <td className="py-1 pr-3 text-slate-600">{c.caseNumber || '—'}</td>
                <td className="py-1 pr-3 text-slate-600">{c.caseworkerName || '—'}</td>
                <td className="py-1 pr-3 text-slate-600">{c.school || '—'}</td>
                {canAssign && (
                  <td className="py-1 pr-3 text-right">
                    {otherHomes.length > 0 ? (
                      <select
                        defaultValue=""
                        onChange={(e) => { const to = e.target.value; if (to && confirm('Move this child to the selected home? The new foster parent will be asked to accept.')) onTransfer(detail.home.id, c.id, to); e.currentTarget.value = ''; }}
                        className="rounded border border-slate-200 px-1 py-0.5 text-xs text-slate-600"
                      >
                        <option value="">Transfer to…</option>
                        {otherHomes.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    ) : null}
                  </td>
                )}
              </tr>
            ))}
            {detail.children.length === 0 && <tr><td colSpan={canAssign ? 6 : 5} className="py-2 text-slate-400">No children.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Licensing / compliance</h4>
        <span className="flex items-center gap-3">
          <a href={`/api/agency/homes/${detail.home.id}/licensing/pdf`} className="text-xs font-medium text-slate-600 hover:underline">Download PDF</a>
          {canAssign && !licensingOpen && (
            <button onClick={() => setLicensingOpen(true)} className="text-xs font-medium text-brand-700 hover:underline">+ Submit requirement</button>
          )}
        </span>
      </div>
      {licensingOpen && (
        <form onSubmit={submitLicensing} className="mt-2 grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
          <input name="name" required placeholder="Requirement (e.g. Fire inspection) *" className="input sm:col-span-2" />
          <input name="category" placeholder="Category" className="input" />
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-500">Due date</label>
            <input name="dueDate" type="date" className="input" />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Sending…' : 'Submit'}</button>
            <button type="button" onClick={() => setLicensingOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}
      <ul className="mt-1 space-y-1 text-sm">
        {detail.licensing.map((l) => (
          <li key={l.id} className="flex justify-between">
            <span className="text-slate-700">{l.name}</span>
            <span className={['DUE_SOON', 'EXPIRED'].includes(l.status) ? 'font-medium text-red-600' : 'text-slate-500'}>
              {l.status.replaceAll('_', ' ').toLowerCase()}{l.dueDate ? ` · due ${d(l.dueDate)}` : ''}
            </span>
          </li>
        ))}
        {detail.licensing.length === 0 && <li className="text-slate-400">No licensing items.</li>}
      </ul>

      <h4 className="mt-4 text-sm font-semibold text-slate-700">Placements ({detail.placements.length})</h4>
      <ul className="mt-1 space-y-1 text-sm">
        {detail.placements.map((p) => (
          <li key={p.id} className="flex items-center justify-between">
            <span className="text-slate-700">{p.child.preferredName || p.child.firstName}</span>
            <span className="flex items-center gap-3">
              <span className={p.status === 'PENDING' ? 'text-amber-600' : p.status === 'TRIAL_HOME_VISIT' ? 'text-amber-600' : 'text-slate-500'}>
                {p.status === 'PENDING' ? 'awaiting foster parent' : p.status === 'TRIAL_HOME_VISIT' ? `trial → ${d(p.endDate)}` : p.status.replaceAll('_', ' ').toLowerCase()}
              </span>
              {canAssign && !['REUNIFIED', 'ENDED', 'PENDING'].includes(p.status) && (
                <button onClick={() => reunify(p.id)} className="text-xs text-brand-700 hover:underline">Mark reunified</button>
              )}
              {isAdmin && p.status === 'PENDING' && (
                <button onClick={() => override(p.id)} className="text-xs text-amber-700 hover:underline">Override → active</button>
              )}
            </span>
          </li>
        ))}
        {detail.placements.length === 0 && <li className="text-slate-400">No placements recorded.</li>}
      </ul>

      <div className="mt-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Visits ({detail.visits.length})</h4>
        {canAssign && !visitOpen && (
          <button onClick={() => setVisitOpen(true)} className="text-xs font-medium text-brand-700 hover:underline">+ Record visit</button>
        )}
      </div>
      {visitOpen && (
        <form onSubmit={recordVisit} className="mt-2 grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-slate-500">Visit date *</label>
            <input name="visitDate" type="date" required className="input" />
          </div>
          <input name="visitType" placeholder="Type (home visit, court…)" className="input sm:col-span-2" />
          <textarea name="summary" placeholder="Summary / notes" className="input sm:col-span-3" rows={2} />
          <div className="flex items-end gap-2 sm:col-span-3">
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save visit'}</button>
            <button type="button" onClick={() => setVisitOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}
      <ul className="mt-1 space-y-1 text-sm">
        {detail.visits.map((v) => (
          <li key={v.id} className="flex justify-between gap-3">
            <span className="text-slate-700">
              {v.status === 'SCHEDULED' && <span className="mr-1 badge bg-amber-100 text-amber-800">scheduled</span>}
              {v.visitType || 'Visit'}{v.summary ? <span className="text-slate-500"> — {v.summary}</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-slate-500">
              {d(v.visitDate)}
              {canAssign && v.status === 'SCHEDULED' && <button onClick={() => completeVisit(v.id)} className="text-xs text-brand-700 hover:underline">Complete</button>}
            </span>
          </li>
        ))}
        {detail.visits.length === 0 && <li className="text-slate-400">No visits recorded.</li>}
      </ul>

      <div className="mt-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Case goals ({detail.goals.length})</h4>
        {canAssign && !goalOpen && (
          <button onClick={() => setGoalOpen(true)} className="text-xs font-medium text-brand-700 hover:underline">+ Add goal</button>
        )}
      </div>
      {goalOpen && (
        <form onSubmit={addGoal} className="mt-2 grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
          <input name="title" required placeholder="Goal (e.g. Reunification) *" className="input sm:col-span-2" />
          <div><label className="text-xs text-slate-500">Target date</label><input name="targetDate" type="date" className="input" /></div>
          <textarea name="description" placeholder="Details (optional)" rows={2} className="input sm:col-span-3" />
          <div className="flex items-end gap-2 sm:col-span-3">
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Add goal'}</button>
            <button type="button" onClick={() => setGoalOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}
      <ul className="mt-1 space-y-1 text-sm">
        {detail.goals.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-3">
            <span className="text-slate-700">{g.title}{g.targetDate ? <span className="text-slate-400"> · by {d(g.targetDate)}</span> : null}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="badge bg-slate-100 text-slate-600">{g.status.replaceAll('_', ' ').toLowerCase()}</span>
              {canAssign && g.status !== 'MET' && <button onClick={() => setGoalStatus(g.id, 'MET')} className="text-xs text-green-700 hover:underline">Met</button>}
              {canAssign && !['IN_PROGRESS', 'MET'].includes(g.status) && <button onClick={() => setGoalStatus(g.id, 'IN_PROGRESS')} className="text-xs text-brand-700 hover:underline">Start</button>}
            </span>
          </li>
        ))}
        {detail.goals.length === 0 && <li className="text-slate-400">No goals set.</li>}
      </ul>

      <p className="mt-4 text-sm text-slate-600"><span className="font-semibold text-slate-700">Training hours:</span> {detail.trainingHours.totalHours} ({detail.trainingHours.count} {detail.trainingHours.count === 1 ? 'entry' : 'entries'})</p>

      <h4 className="mt-4 text-sm font-semibold text-slate-700">Messages</h4>
      <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {thread === null ? <p className="text-sm text-slate-400">Loading…</p> : thread.length === 0 ? (
          <p className="text-sm text-slate-400">No messages yet.</p>
        ) : thread.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${m.fromAgency ? 'ml-auto bg-brand-100 text-brand-900' : 'bg-slate-100 text-slate-800'}`}>
            <p>{m.body}</p>
            <p className="text-[10px] text-slate-500">{m.fromAgency ? 'Agency' : 'Foster parent'} · {new Date(m.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="mt-2 flex gap-2">
        <input name="body" placeholder="Message the foster parent…" className="input flex-1" />
        <button className="btn-secondary">Send</button>
      </form>
    </div>
  );
}
