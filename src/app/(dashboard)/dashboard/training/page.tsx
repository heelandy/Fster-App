import { requireHousehold, can } from '@/lib/authz';
import { CrudResource } from '@/components/crud-resource';
import { trainingFields, trainingColumns } from '@/components/resource-configs';
import { AccessDenied } from '@/components/feature-locked';

export default async function TrainingPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'training:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Training & Certifications"
      endpoint="/api/training"
      fields={trainingFields}
      columns={trainingColumns}
      canWrite={can(ctx, 'training:write')}
      emptyText="No training logged yet. Track orientation, annual hours, CPR / First Aid and trauma-informed certificates with renewal dates."
    />
  );
}
