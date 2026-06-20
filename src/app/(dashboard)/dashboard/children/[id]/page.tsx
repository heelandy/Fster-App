import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireHousehold, requireCapability, can, sanitizeChildForRole } from '@/lib/authz';
import { planHasFeature } from '@/lib/plans';
import { prisma } from '@/lib/prisma';
import { ChildTabs, type ChildPerms } from '@/components/child-tabs';

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  );
}

export default async function ChildDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireHousehold();
  requireCapability(ctx, 'children:read');

  const raw = await prisma.childProfile.findFirst({
    where: { id: params.id, householdId: ctx.householdId },
  });
  if (!raw) notFound();
  const child = sanitizeChildForRole(raw, ctx.role);

  const perms: ChildPerms = {
    appointments: can(ctx, 'appointments:read'),
    appointmentsWrite: can(ctx, 'appointments:write'),
    careLogs: can(ctx, 'careLogs:read') && planHasFeature(ctx.tier, 'careLogs'),
    careLogsWrite: can(ctx, 'careLogs:write') && planHasFeature(ctx.tier, 'careLogs'),
    medications: can(ctx, 'medications:read') && planHasFeature(ctx.tier, 'medications'),
    medicationsWrite: can(ctx, 'medications:write') && planHasFeature(ctx.tier, 'medications'),
    documents: can(ctx, 'documents:read') && planHasFeature(ctx.tier, 'documents'),
    documentsWrite: can(ctx, 'documents:write') && planHasFeature(ctx.tier, 'documents'),
    expenses: can(ctx, 'expenses:read') && planHasFeature(ctx.tier, 'expenses'),
    expensesWrite: can(ctx, 'expenses:write') && planHasFeature(ctx.tier, 'expenses'),
    contacts: can(ctx, 'contacts:read'),
    contactsWrite: can(ctx, 'contacts:write'),
    routines: can(ctx, 'routines:read'),
    routinesWrite: can(ctx, 'routines:write'),
  };

  // Per-child cost report (spending attributed to this child).
  let spendMonth = 0;
  let spendTotal = 0;
  if (perms.expenses) {
    const now = new Date();
    const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [m, t] = await Promise.all([
      prisma.expense.aggregate({ where: { householdId: ctx.householdId, childId: child.id, spentAt: { gte: startMonth } }, _sum: { amountCents: true } }),
      prisma.expense.aggregate({ where: { householdId: ctx.householdId, childId: child.id }, _sum: { amountCents: true } }),
    ]);
    spendMonth = m._sum.amountCents ?? 0;
    spendTotal = t._sum.amountCents ?? 0;
  }

  const name = child.preferredName || child.firstName;
  const dob = child.dateOfBirth ? new Date(child.dateOfBirth).toLocaleDateString(undefined, { timeZone: 'UTC' }) : null;

  return (
    <div>
      <Link href="/dashboard/children" className="text-sm text-slate-500 hover:text-slate-800">
        ← All children
      </Link>

      <div className="card mt-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
            <span className="badge mt-1 bg-brand-100 text-brand-800">
              {child.placementStatus.replaceAll('_', ' ')}
            </span>
          </div>
          {ctx.role !== 'BABYSITTER' && (
            <a href={`/api/children/${child.id}/report/pdf`} className="btn-secondary shrink-0 text-sm">Court report (PDF)</a>
          )}
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="First name" value={child.firstName} />
          <Field label="Last name" value={child.lastName} />
          <Field label="Date of birth" value={dob} />
          <Field label="School" value={child.school} />
          <Field label="Doctor" value={child.doctorName} />
          <Field label="Case number" value={child.caseNumber} />
          <Field label="Caseworker" value={child.caseworkerName} />
          <Field label="Emergency contact" value={child.emergencyContactName} />
          <Field label="Emergency phone" value={child.emergencyContactPhone} />
          <Field label="Allergies" value={child.allergies} />
          <Field label="Important notes" value={child.importantNotes} />
        </dl>
      </div>

      {perms.expenses && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="card">
            <p className="text-xs uppercase text-slate-500">Spent on {name} this month</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">${(spendMonth / 100).toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-xs uppercase text-slate-500">Total spent on {name}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">${(spendTotal / 100).toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="mt-6">
        <ChildTabs childId={child.id} perms={perms} />
      </div>
    </div>
  );
}
