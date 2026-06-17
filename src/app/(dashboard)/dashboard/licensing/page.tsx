import { requireHousehold, can } from '@/lib/authz';
import { planHasFeature } from '@/lib/plans';
import { LICENSING_STATUS, toOptions } from '@/lib/enums';
import { CrudResource, type FieldDef, type ColumnDef } from '@/components/crud-resource';
import { AccessDenied, FeatureLocked } from '@/components/feature-locked';

const fields: FieldDef[] = [
  { name: 'name', label: 'Requirement', type: 'text', required: true, placeholder: 'e.g. Fire inspection, CPR/First Aid' },
  { name: 'category', label: 'Category', type: 'text', placeholder: 'Training, Background, Home study…' },
  { name: 'status', label: 'Status', type: 'select', options: toOptions(LICENSING_STATUS) },
  { name: 'dueDate', label: 'Due date', type: 'date' },
  { name: 'completedAt', label: 'Completed on', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

const columns: ColumnDef[] = [
  { key: 'name', label: 'Requirement' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status', kind: 'enum' },
  { key: 'dueDate', label: 'Due', kind: 'date', proximity: true },
];

export default async function LicensingPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'licensing:read')) return <AccessDenied />;
  if (!planHasFeature(ctx.tier, 'licensingTracker')) return <FeatureLocked feature="Licensing Tracker" />;
  return (
    <CrudResource
      title="Licensing & Compliance"
      endpoint="/api/licensing"
      fields={fields}
      columns={columns}
      canWrite={can(ctx, 'licensing:write')}
      emptyText="No licensing requirements tracked yet."
    />
  );
}
