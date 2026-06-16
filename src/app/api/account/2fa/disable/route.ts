import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { twoFactorDisableSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

/** Turn off 2FA. Requires the account password to prevent hijack of an open session. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('2fa-disable', user.id, RateLimits.write);
    const { password } = await readJson(req, twoFactorDisableSchema);

    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!row || !(await bcrypt.compare(password, row.passwordHash))) {
      throw Errors.badRequest('Incorrect password.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: null, twoFactorEnabledAt: null, twoFactorBackupCodes: Prisma.DbNull },
    });
    await logSecurity({ actorId: user.id, event: 'TWO_FACTOR_DISABLED' });

    return json({ ok: true });
  });
}
