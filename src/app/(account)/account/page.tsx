import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { AccountSecurity } from '@/components/account-security';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await requireUser();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { twoFactorEnabledAt: true },
  });
  const twoFactorEnabled = Boolean(row?.twoFactorEnabledAt);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Account &amp; security</h1>
      <p className="mb-6 text-sm text-slate-600">
        Manage your password, two-factor authentication, and active sessions.
      </p>
      <AccountSecurity email={user.email ?? ''} twoFactorEnabled={twoFactorEnabled} />
    </div>
  );
}
