import { prisma } from '@/lib/prisma';
import { handle, json } from '@/lib/http';
import { readJson, enforceRateLimit, enforceDistributedLimit } from '@/lib/api';
import { getClientInfo } from '@/lib/request';
import { forgotPasswordSchema } from '@/lib/validation';
import { RateLimits } from '@/lib/rate-limit';
import { generateToken } from '@/lib/tokens';
import { sendPasswordReset } from '@/lib/email';
import { logSecurity } from '@/lib/audit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export function POST(req: Request) {
  return handle(async () => {
    const info = getClientInfo();
    enforceRateLimit(`forgot:${info.ip}`, RateLimits.auth);
    await enforceDistributedLimit(`forgot:${info.ip}`, RateLimits.auth);

    const { email } = await readJson(req, forgotPasswordSchema);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true, isBanned: true } });

    // Only act for a real, usable account — but ALWAYS return the same response
    // so the endpoint cannot be used to discover which emails are registered.
    if (user && user.isActive && !user.isBanned) {
      const { raw, hash } = generateToken();
      // Invalidate any earlier outstanding tokens for this user.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + EXPIRY_MS) },
      });
      const link = `${env.APP_URL}/reset-password?token=${raw}`;
      await sendPasswordReset(user.email, link);
      await logSecurity({ actorId: user.id, event: 'PASSWORD_RESET_REQUESTED', ip: info.ip, metadata: { email } });
    }

    return json({ ok: true });
  });
}
