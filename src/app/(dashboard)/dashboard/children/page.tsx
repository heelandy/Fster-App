import { requireHousehold, can } from '@/lib/authz';
import { PLACEMENT_STATUS, toOptions } from '@/lib/enums';
import { CrudResource, type FieldDef, type ColumnDef } from '@/components/crud-resource';
import { AccessDenied } from '@/components/feature-locked';

const fields: FieldDef[] = [
  { name: 'firstName', label: 'First name', type: 'text', required: true },
  { name: 'preferredName', label: 'Preferred name', type: 'text' },
  { name: 'lastName', label: 'Last name', type: 'text' },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  { name: 'placementStatus', label: 'Placement status', type: 'select', options: toOptions(PLACEMENT_STATUS) },
  { name: 'caseNumber', label: 'Case number', type: 'text' },
  { name: 'caseworkerName', label: 'Caseworker', type: 'text' },
  { name: 'school', label: 'School', type: 'text' },
  { name: 'doctorName', label: 'Doctor', type: 'text' },
  { name: 'emergencyContactName', label: 'Emergency contact', type: 'text' },
  { name: 'emergencyContactPhone', label: 'Emergency phone', type: 'text' },
  { name: 'allergies', label: 'Allergies', type: 'textarea' },
  { name: 'importantNotes', label: 'Important notes', type: 'textarea' },
];

const columns: ColumnDef[] = [
  { key: 'preferredName', label: 'Preferred' },
  { key: 'firstName', label: 'First name' },
  { key: 'placementStatus', label: 'Status', kind: 'enum' },
  { key: 'school', label: 'School' },
  { key: 'dateOfBirth', label: 'DOB', kind: 'date' },
];

export default async function ChildrenPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'children:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Child Profiles"
      endpoint="/api/children"
      fields={fields}
      columns={columns}
      canWrite={can(ctx, 'children:write')}
      rowLinkBase="/dashboard/children"
      emptyText="No child profiles yet. Add your first placement."
    />
  );
}
