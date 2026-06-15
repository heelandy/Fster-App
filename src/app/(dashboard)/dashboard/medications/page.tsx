import { requireHousehold, can } from '@/lib/authz';
import { planHasFeature } from '@/lib/plans';
import { CrudResource } from '@/components/crud-resource';
import { medicationFields, medicationColumns } from '@/components/resource-configs';
import { AccessDenied, FeatureLocked } from '@/components/feature-locked';

export default async function MedicationsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'medications:read')) return <AccessDenied />;
  if (!planHasFeature(ctx.tier, 'medications')) return <FeatureLocked feature="Medication Tracking" />;
  return (
    <CrudResource
      title="Medications"
      endpoint="/api/medications"
      fields={medicationFields}
      columns={medicationColumns}
      canWrite={can(ctx, 'medications:write')}
      emptyText="No medications tracked yet."
    />
  );
}
