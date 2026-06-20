import { requireUser } from '@/lib/authz';
import { findAgencyMembership } from '@/lib/agency';
import { AgencyCreate } from '@/components/agency-create';
import { AgencyPortal } from '@/components/agency-portal';

export const dynamic = 'force-dynamic';

export default async function AgencyPage() {
  const user = await requireUser();
  const member = await findAgencyMembership(user.id);
  if (!member) return <AgencyCreate />;
  return <AgencyPortal role={member.role} agencyName={member.agencyName} />;
}
