import { requireHousehold, can } from '@/lib/authz';
import { planHasFeature } from '@/lib/plans';
import { DocumentsClient } from '@/components/documents-client';
import { AccessDenied, FeatureLocked } from '@/components/feature-locked';

export default async function DocumentsPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'documents:read')) return <AccessDenied />;
  if (!planHasFeature(ctx.tier, 'documents')) return <FeatureLocked feature="Document Storage" />;
  return <DocumentsClient canWrite={can(ctx, 'documents:write')} />;
}
