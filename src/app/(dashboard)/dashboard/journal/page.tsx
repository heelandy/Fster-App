import { requireHousehold, can } from '@/lib/authz';
import { CrudResource } from '@/components/crud-resource';
import { journalFields, journalColumns } from '@/components/resource-configs';
import { AccessDenied } from '@/components/feature-locked';

export default async function JournalPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'journal:read')) return <AccessDenied />;
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <a href="/api/journal/pdf" className="btn-secondary text-sm">Download keepsake (PDF)</a>
      </div>
      <CrudResource
        title="Child Story & Success Journal"
        endpoint="/api/journal"
        fields={journalFields}
        columns={journalColumns}
        canWrite={can(ctx, 'journal:write')}
        emptyText="No journal entries yet. Capture milestones, first days and happy memories — a keepsake at adoption."
      />
    </div>
  );
}
