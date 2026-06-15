import { requireHousehold, can } from '@/lib/authz';
import { CrudResource } from '@/components/crud-resource';
import { contactFields, contactColumns } from '@/components/resource-configs';
import { AccessDenied } from '@/components/feature-locked';

export default async function ContactsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'contacts:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Contacts"
      endpoint="/api/contacts"
      fields={contactFields}
      columns={contactColumns}
      canWrite={can(ctx, 'contacts:write')}
      emptyText="No contacts saved yet."
    />
  );
}
