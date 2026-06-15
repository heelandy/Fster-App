import { requireHousehold, can } from '@/lib/authz';
import { planHasFeature } from '@/lib/plans';
import { CrudResource } from '@/components/crud-resource';
import { careLogFields, careLogColumns } from '@/components/resource-configs';
import { AccessDenied, FeatureLocked } from '@/components/feature-locked';

export default async function CareLogsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'careLogs:read')) return <AccessDenied />;
  if (!planHasFeature(ctx.tier, 'careLogs')) return <FeatureLocked feature="Daily Care Logs" />;
  return (
    <CrudResource
      title="Daily Care Logs"
      endpoint="/api/care-logs"
      fields={careLogFields}
      columns={careLogColumns}
      canWrite={can(ctx, 'careLogs:write')}
      emptyText="No care logs yet. Add today’s log."
    />
  );
}
