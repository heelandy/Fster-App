import { requireHousehold, can } from '@/lib/authz';
import { CrudResource } from '@/components/crud-resource';
import { behaviorFields, behaviorColumns } from '@/components/resource-configs';
import { AccessDenied } from '@/components/feature-locked';

export default async function BehaviorPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'behaviorLogs:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Behavior & Trauma Tracking"
      endpoint="/api/behavior-logs"
      fields={behaviorFields}
      columns={behaviorColumns}
      canWrite={can(ctx, 'behaviorLogs:write')}
      emptyText="No entries yet. Track triggers, coping strategies and what helps — trauma-informed (TBRI)."
    />
  );
}
