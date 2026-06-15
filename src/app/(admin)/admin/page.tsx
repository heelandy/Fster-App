import { requireAdmin } from '@/lib/authz';
import { AdminClient } from '@/components/admin-client';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireAdmin();
  return <AdminClient />;
}
