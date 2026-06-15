import { requireHousehold, can } from '@/lib/authz';
import { CONTACT_ROLE, toOptions } from '@/lib/enums';
import { CrudResource, type FieldDef, type ColumnDef } from '@/components/crud-resource';
import { AccessDenied } from '@/components/feature-locked';

const fields: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'role', label: 'Role', type: 'select', options: toOptions(CONTACT_ROLE) },
  { name: 'childId', label: 'Child (optional)', type: 'childSelect' },
  { name: 'phone', label: 'Phone', type: 'text' },
  { name: 'email', label: 'Email', type: 'text' },
  { name: 'agency', label: 'Agency', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

const columns: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role', kind: 'enum' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'agency', label: 'Agency' },
];

export default async function ContactsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'contacts:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Contacts"
      endpoint="/api/contacts"
      fields={fields}
      columns={columns}
      canWrite={can(ctx, 'contacts:write')}
      emptyText="No contacts saved yet."
    />
  );
}
