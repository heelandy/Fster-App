import { requireHousehold, can } from '@/lib/authz';
import { CrudResource } from '@/components/crud-resource';
import { educationFields, educationColumns } from '@/components/resource-configs';
import { AccessDenied } from '@/components/feature-locked';

export default async function EducationPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'education:read')) return <AccessDenied />;
  return (
    <CrudResource
      title="Education Records"
      endpoint="/api/education-records"
      fields={educationFields}
      columns={educationColumns}
      canWrite={can(ctx, 'education:write')}
      emptyText="No education records yet. Track enrollment, IEPs, grades, attendance and school meetings."
    />
  );
}
