import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { findAgencyMembership } from '@/lib/agency';
import { AgencyCreate } from '@/components/agency-create';
import { AgencyPortal } from '@/components/agency-portal';
import { IdleLogout } from '@/components/idle-logout';

export const dynamic = 'force-dynamic';

// White-label tab icon: an agency's uploaded logo becomes the portal's favicon.
export async function generateMetadata(): Promise<Metadata> {
  try {
    const user = await requireUser();
    const m = await findAgencyMembership(user.id);
    if (m) {
      const a = await prisma.agency.findUnique({ where: { id: m.agencyId }, select: { logoStorageKey: true } });
      if (a?.logoStorageKey) return { icons: { icon: '/api/branding/logo', shortcut: '/api/branding/logo' } };
    }
  } catch {
    // Inherit the default icon.
  }
  return {};
}

export default async function AgencyPage() {
  const user = await requireUser();
  const member = await findAgencyMembership(user.id);
  if (!member) {
    return (
      <>
        <AgencyCreate />
        <IdleLogout />
      </>
    );
  }
  return (
    <>
      <AgencyPortal
        role={member.role}
        agencyName={member.agencyName}
        verificationStatus={member.verificationStatus}
      />
      <IdleLogout />
    </>
  );
}
