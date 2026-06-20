import { requireHousehold, can } from '@/lib/authz';
import { CrudResource } from '@/components/crud-resource';
import { communicationFields, communicationColumns } from '@/components/resource-configs';
import { AccessDenied } from '@/components/feature-locked';

export default async function CommunicationPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'communications:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Communication Log"
      endpoint="/api/communications"
      fields={communicationFields}
      columns={communicationColumns}
      canWrite={can(ctx, 'communications:write')}
      emptyText="No entries yet. Log calls, emails and meetings with the child's team and family."
    />
  );
}
