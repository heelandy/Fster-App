import { requireHousehold, can } from '@/lib/authz';
import { planHasFeature } from '@/lib/plans';
import { CrudResource, type FieldDef, type ColumnDef } from '@/components/crud-resource';
import { AccessDenied, FeatureLocked } from '@/components/feature-locked';

const fields: FieldDef[] = [
  { name: 'childId', label: 'Child', type: 'childSelect', required: true },
  { name: 'name', label: 'Medication name', type: 'text', required: true },
  { name: 'dosage', label: 'Dosage', type: 'text', placeholder: 'e.g. 5mg' },
  { name: 'schedule', label: 'Schedule', type: 'text', placeholder: 'e.g. Twice daily, 8am & 8pm' },
  { name: 'startDate', label: 'Start date', type: 'date' },
  { name: 'endDate', label: 'End date', type: 'date' },
  { name: 'prescribingDoctor', label: 'Prescribing doctor', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

const columns: ColumnDef[] = [
  { key: 'name', label: 'Medication' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'dosage', label: 'Dosage' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'prescribingDoctor', label: 'Doctor' },
];

export default async function MedicationsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'medications:read')) return <AccessDenied />;
  if (!planHasFeature(ctx.tier, 'medications')) return <FeatureLocked feature="Medication Tracking" />;
  return (
    <CrudResource
      title="Medications"
      endpoint="/api/medications"
      fields={fields}
      columns={columns}
      canWrite={can(ctx, 'medications:write')}
      emptyText="No medications tracked yet."
    />
  );
}
