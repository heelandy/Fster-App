import { requireHousehold, can } from '@/lib/authz';
import { CrudResource } from '@/components/crud-resource';
import { courtFields, courtColumns } from '@/components/resource-configs';
import { AccessDenied } from '@/components/feature-locked';

export default async function CourtPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'court:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Court Hearings"
      endpoint="/api/court-hearings"
      fields={courtFields}
      columns={courtColumns}
      canWrite={can(ctx, 'court:write')}
      emptyText="No hearings logged yet. Track permanency, review and adoption hearings with judge, attorney and outcome."
    />
  );
}
