import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { twoFactorVerifySchema } from '@/lib/validation';
import { verifyTotp } from '@/lib/totp';
import { issueStepUp } from '@/lib/stepup';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Re-verify the admin with their authenticator to unlock sensitive config
 * (the Integrations page). Requires 2FA to be enabled on the account.
 */
export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    mutationGuard('step-up', admin.id, RateLimits.login);
    const { code } = await readJson(req, twoFactorVerifySchema);

    const row = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { twoFactorSecret: true, twoFactorEnabledAt: true },
    });
    if (!row?.twoFactorEnabledAt || !row.twoFactorSecret) {
      throw Errors.badRequest('Enable two-factor authentication on your account first.');
    }
    if (!verifyTotp(row.twoFactorSecret, code)) {
      await logSecurity({ actorId: admin.id, event: 'STEP_UP_FAILED' });
      throw Errors.badRequest('That code is incorrect.');
    }

    issueStepUp(admin.id);
    await logSecurity({ actorId: admin.id, event: 'STEP_UP_OK' });
    return json({ ok: true });
  });
}
