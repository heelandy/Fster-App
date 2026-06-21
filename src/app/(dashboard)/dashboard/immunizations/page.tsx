import { requireHousehold, can } from '@/lib/authz';
import { CrudResource } from '@/components/crud-resource';
import { immunizationFields, immunizationColumns } from '@/components/resource-configs';
import { AccessDenied } from '@/components/feature-locked';

export default async function ImmunizationsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'medical:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Immunizations"
      endpoint="/api/immunizations"
      fields={immunizationFields}
      columns={immunizationColumns}
      canWrite={can(ctx, 'medical:write')}
      emptyText="No immunizations recorded yet. Track each vaccine, the date given and the next dose due."
    />
  );
}
