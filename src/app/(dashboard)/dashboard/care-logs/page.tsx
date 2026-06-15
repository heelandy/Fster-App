import { requireHousehold, can } from '@/lib/authz';
import { planHasFeature } from '@/lib/plans';
import { CrudResource, type FieldDef, type ColumnDef } from '@/components/crud-resource';
import { AccessDenied, FeatureLocked } from '@/components/feature-locked';

const fields: FieldDef[] = [
  { name: 'childId', label: 'Child', type: 'childSelect', required: true },
  { name: 'logDate', label: 'Date', type: 'date', required: true },
  { name: 'mood', label: 'Mood', type: 'text' },
  { name: 'meals', label: 'Meals', type: 'textarea' },
  { name: 'sleep', label: 'Sleep', type: 'textarea' },
  { name: 'behavior', label: 'Behavior', type: 'textarea' },
  { name: 'schoolUpdate', label: 'School update', type: 'textarea' },
  { name: 'visits', label: 'Visits', type: 'textarea' },
  { name: 'medicalConcerns', label: 'Medical concerns', type: 'textarea' },
  { name: 'incidents', label: 'Incidents', type: 'textarea' },
  { name: 'milestones', label: 'Milestones', type: 'textarea' },
  { name: 'generalNotes', label: 'General notes', type: 'textarea' },
];

const columns: ColumnDef[] = [
  { key: 'logDate', label: 'Date', kind: 'date' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'mood', label: 'Mood' },
  { key: 'behavior', label: 'Behavior' },
];

export default async function CareLogsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'careLogs:read')) return <AccessDenied />;
  if (!planHasFeature(ctx.tier, 'careLogs')) return <FeatureLocked feature="Daily Care Logs" />;
  return (
    <CrudResource
      title="Daily Care Logs"
      endpoint="/api/care-logs"
      fields={fields}
      columns={columns}
      canWrite={can(ctx, 'careLogs:write')}
      emptyText="No care logs yet. Add today’s log."
    />
  );
}
