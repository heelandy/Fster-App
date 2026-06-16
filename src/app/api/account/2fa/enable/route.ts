import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { twoFactorVerifySchema } from '@/lib/validation';
import { verifyTotp } from '@/lib/totp';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

/** Human-friendly one-time backup codes, e.g. "k7p2-9qm4". */
function generateBackupCodes(count = 10): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const hex = randomBytes(4).toString('hex'); // 8 chars
    out.push(`${hex.slice(0, 4)}-${hex.slice(4)}`);
  }
  return out;
}

/** Confirm a TOTP code and activate 2FA, returning one-time backup codes. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('2fa-enable', user.id, RateLimits.write);
    const { code } = await readJson(req, twoFactorVerifySchema);

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorSecret: true },
    });
    if (!row?.twoFactorSecret) throw Errors.badRequest('Start two-factor setup first.');
    if (!verifyTotp(row.twoFactorSecret, code)) throw Errors.badRequest('That code is incorrect. Try again.');

    const backupCodes = generateBackupCodes();
    const hashed = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabledAt: new Date(), twoFactorBackupCodes: hashed },
    });
    await logSecurity({ actorId: user.id, event: 'TWO_FACTOR_ENABLED' });

    return json({ ok: true, backupCodes });
  });
}
