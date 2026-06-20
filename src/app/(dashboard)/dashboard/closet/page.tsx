import { requireHousehold, can } from '@/lib/authz';
import { CrudResource } from '@/components/crud-resource';
import { inventoryFields, inventoryColumns } from '@/components/resource-configs';
import { AccessDenied } from '@/components/feature-locked';

export default async function ClosetPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'inventory:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Foster Closet & Inventory"
      endpoint="/api/inventory"
      fields={inventoryFields}
      columns={inventoryColumns}
      canWrite={can(ctx, 'inventory:write')}
      emptyText="No items yet. Track clothing sizes, supplies and what needs restocking."
    />
  );
}
