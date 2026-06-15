import { requireHousehold, can } from '@/lib/authz';
import { ChecklistClient } from '@/components/checklist-client';
import { AccessDenied } from '@/components/feature-locked';

export default async function RoutinesPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'routines:read')) return <AccessDenied />;
  return (
    <ChecklistClient
      title="Routines"
      endpoint="/api/routines"
      itemToggleEndpoint="/api/routine-tasks"
      itemsKey="tasks"
      canWrite={can(ctx, 'routines:write')}
    />
  );
}
