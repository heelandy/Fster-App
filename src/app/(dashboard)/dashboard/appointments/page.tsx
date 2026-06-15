import { requireHousehold, can } from '@/lib/authz';
import { APPOINTMENT_TYPE, toOptions } from '@/lib/enums';
import { CrudResource, type FieldDef, type ColumnDef } from '@/components/crud-resource';
import { AccessDenied } from '@/components/feature-locked';

const fields: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true },
  { name: 'type', label: 'Type', type: 'select', options: toOptions(APPOINTMENT_TYPE) },
  { name: 'childId', label: 'Child (optional)', type: 'childSelect' },
  { name: 'startsAt', label: 'Starts at', type: 'datetime', required: true },
  { name: 'endsAt', label: 'Ends at', type: 'datetime' },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'reminderAt', label: 'Reminder at', type: 'datetime' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

const columns: ColumnDef[] = [
  { key: 'startsAt', label: 'When', kind: 'datetime' },
  { key: 'title', label: 'Title' },
  { key: 'type', label: 'Type', kind: 'enum' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'location', label: 'Location' },
];

export default async function AppointmentsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'appointments:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Appointments & Calendar"
      endpoint="/api/appointments"
      fields={fields}
      columns={columns}
      canWrite={can(ctx, 'appointments:write')}
      emptyText="No appointments scheduled."
    />
  );
}
