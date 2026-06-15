import { requireHousehold, can } from '@/lib/authz';
import { CrudResource } from '@/components/crud-resource';
import { appointmentFields, appointmentColumns } from '@/components/resource-configs';
import { AccessDenied } from '@/components/feature-locked';

export default async function AppointmentsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'appointments:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Appointments & Calendar"
      endpoint="/api/appointments"
      fields={appointmentFields}
      columns={appointmentColumns}
      canWrite={can(ctx, 'appointments:write')}
      emptyText="No appointments scheduled."
    />
  );
}
