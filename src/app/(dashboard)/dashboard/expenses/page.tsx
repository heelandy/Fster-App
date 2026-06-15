import { requireHousehold, can } from '@/lib/authz';
import { planHasFeature } from '@/lib/plans';
import { prisma } from '@/lib/prisma';
import { EXPENSE_CATEGORY, toOptions } from '@/lib/enums';
import { CrudResource, type FieldDef, type ColumnDef } from '@/components/crud-resource';
import { ExpenseSummary } from '@/components/expense-summary';
import { AccessDenied, FeatureLocked } from '@/components/feature-locked';

const fields: FieldDef[] = [
  { name: 'description', label: 'Description', type: 'text', required: true },
  { name: 'category', label: 'Category', type: 'select', options: toOptions(EXPENSE_CATEGORY) },
  { name: 'amountCents', label: 'Amount ($)', type: 'money', required: true },
  { name: 'spentAt', label: 'Date', type: 'date', required: true },
  { name: 'childId', label: 'Child (optional)', type: 'childSelect' },
];

const columns: ColumnDef[] = [
  { key: 'spentAt', label: 'Date', kind: 'date' },
  { key: 'category', label: 'Category', kind: 'enum' },
  { key: 'description', label: 'Description' },
  { key: 'amountCents', label: 'Amount', kind: 'money' },
  { key: 'child', label: 'Child', kind: 'childName' },
];

export default async function ExpensesPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'expenses:read')) return <AccessDenied />;
  if (!planHasFeature(ctx.tier, 'expenses')) return <FeatureLocked feature="Expense Tracking" />;

  // Compute summaries server-side so the summary widget doesn't refetch the list.
  const now = new Date();
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [monthAgg, yearAgg] = await Promise.all([
    prisma.expense.aggregate({
      where: { householdId: ctx.householdId, spentAt: { gte: startMonth } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: { householdId: ctx.householdId, spentAt: { gte: startYear } },
      _sum: { amountCents: true },
    }),
  ]);

  return (
    <div>
      <ExpenseSummary
        monthCents={monthAgg._sum.amountCents ?? 0}
        yearCents={yearAgg._sum.amountCents ?? 0}
      />
      <CrudResource
        title="Expenses"
        endpoint="/api/expenses"
        fields={fields}
        columns={columns}
        canWrite={can(ctx, 'expenses:write')}
        emptyText="No expenses logged yet."
      />
    </div>
  );
}
