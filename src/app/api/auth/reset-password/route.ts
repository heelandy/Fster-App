import { prisma } from '@/lib/prisma';
import { handle, json, Errors } from '@/lib/http';
import { readJson, enforceRateLimit, enforceDistributedLimit } from '@/lib/api';
import { getClientInfo } from '@/lib/request';
import { resetPasswordSchema } from '@/lib/validation';
import { RateLimits } from '@/lib/rate-limit';
import { hashToken } from '@/lib/tokens';
import { hashPassword } from '@/lib/auth';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

export function POST(req: Request) {
  return handle(async () => {
    const info = getClientInfo();
    enforceRateLimit(`reset:${info.ip}`, RateLimits.auth);
    await enforceDistributedLimit(`reset:${info.ip}`, RateLimits.auth);

    const { token, password } = await readJson(req, resetPasswordSchema);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, isActive: true, isBanned: true } } },
    });

    if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive || record.user.isBanned) {
      throw Errors.badRequest('This reset link is invalid or has expired. Please request a new one.');
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          failedLogins: 0,
          lockedUntil: null,
          // Invalidate every existing session for this account (forced logout).
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    await logSecurity({ actorId: record.userId, event: 'PASSWORD_RESET', ip: info.ip });
    return json({ ok: true });
  });
}
