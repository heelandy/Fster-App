import { requireHousehold, can } from '@/lib/authz';
import { ChecklistClient } from '@/components/checklist-client';
import { AccessDenied } from '@/components/feature-locked';

export default async function ChecklistsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'routines:read')) return <AccessDenied />;
  return (
    <ChecklistClient
      title="Checklists"
      endpoint="/api/checklists"
      itemToggleEndpoint="/api/checklist-items"
      itemsKey="items"
      canWrite={can(ctx, 'routines:write')}
    />
  );
}
