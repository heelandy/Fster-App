import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { env } from './env';
import { logSecurity } from './audit';
import { rateLimit, RateLimits } from './rate-limit';
import { rateLimitRedis, redisConfigured } from './rate-limit-redis';
import { getClientInfo } from './request';
import { verifyTotp } from './totp';
import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Optional second factor: a 6-digit TOTP code or a one-time backup code.
  // Only consulted when the account has 2FA enabled.
  totp: z.string().optional(),
  backupCode: z.string().optional(),
});

/**
 * When 2FA is enabled, require a valid TOTP code OR a one-time backup code.
 * A consumed backup code is removed from the account. Returns true if the second
 * factor is satisfied.
 */
async function secondFactorOk(
  user: { id: string; twoFactorSecret: string | null; twoFactorBackupCodes: unknown },
  totp: string | undefined,
  backupCode: string | undefined,
): Promise<boolean> {
  if (totp && user.twoFactorSecret && verifyTotp(user.twoFactorSecret, totp)) return true;

  const codes = Array.isArray(user.twoFactorBackupCodes)
    ? (user.twoFactorBackupCodes as string[])
    : [];
  if (backupCode && codes.length > 0) {
    for (let i = 0; i < codes.length; i++) {
      if (await bcrypt.compare(backupCode.trim(), codes[i])) {
        const remaining = codes.filter((_, idx) => idx !== i);
        await prisma.user.update({ where: { id: user.id }, data: { twoFactorBackupCodes: remaining } });
        await logSecurity({ actorId: user.id, event: 'TWO_FACTOR_BACKUP_USED', metadata: { remaining: remaining.length } });
        return true;
      }
    }
  }
  return false;
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/**
 * Record a failed authentication attempt against the account and lock it after
 * MAX_FAILED. Used for BOTH wrong-password and wrong-second-factor failures, so
 * the 2FA step is brute-force-throttled by the same per-account lockout (not just
 * the best-effort per-IP limit).
 */
async function registerFailedLogin(
  user: { id: string; failedLogins: number },
  email: string,
  reason: string,
) {
  const failedLogins = user.failedLogins + 1;
  const lock = failedLogins >= MAX_FAILED;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLogins,
      lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
    },
  });
  await logSecurity({
    actorId: user.id,
    event: lock ? 'ACCOUNT_LOCKED' : reason,
    metadata: { email, failedLogins },
  });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 /* 8h */ },
  secret: env.NEXTAUTH_SECRET,
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase().trim();
        const { password, totp, backupCode } = parsed.data;

        // Per-IP rate limit on login attempts (parity with registration). Blunts
        // distributed credential-stuffing that spreads guesses across many emails.
        // Only applied when we actually have a distinct client IP: without a
        // forwarded IP (e.g. a direct localhost connection) every caller would
        // collapse into one shared bucket and lock each other out. Per-account
        // lockout below still protects each account regardless.
        let ip = 'unknown';
        try {
          ip = getClientInfo().ip;
        } catch {
          // headers() unavailable in this context.
        }
        if (ip !== 'unknown') {
          const rl = rateLimit(`login:${ip}`, RateLimits.login.limit, RateLimits.login.windowMs);
          if (!rl.success) {
            await logSecurity({ event: 'RATE_LIMITED', ip, path: '/api/auth/callback/credentials' });
            return null;
          }
          // Distributed limit (cross-instance) when Redis is configured.
          if (redisConfigured) {
            const rlr = await rateLimitRedis(`login:${ip}`, RateLimits.login.limit, RateLimits.login.windowMs);
            if (!rlr.success) {
              await logSecurity({ event: 'RATE_LIMITED', ip, path: '/api/auth/callback/credentials' });
              return null;
            }
          }
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Always run a bcrypt compare to avoid user-enumeration via timing.
        const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvaliduO';
        const valid = await bcrypt.compare(password, hash);

        if (!user || !user.isActive) {
          await logSecurity({ event: 'LOGIN_FAILED', metadata: { email, reason: 'no_user_or_inactive' } });
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await logSecurity({ actorId: user.id, event: 'LOGIN_BLOCKED_LOCKED', metadata: { email } });
          return null;
        }

        if (!valid) {
          await registerFailedLogin(user, email, 'LOGIN_FAILED');
          return null;
        }

        // Password correct — enforce the second factor when 2FA is enabled. A wrong
        // code counts toward the same lockout so the factor can't be brute-forced.
        if (user.twoFactorEnabledAt) {
          const ok = await secondFactorOk(user, totp, backupCode);
          if (!ok) {
            await registerFailedLogin(user, email, 'TWO_FACTOR_FAILED');
            return null;
          }
        }

        // Success — reset counters.
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        await logSecurity({ actorId: user.id, event: 'LOGIN_SUCCESS', metadata: { email } });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.globalRole as 'USER' | 'ADMIN',
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.role = (user as { role: 'USER' | 'ADMIN' }).role;
        token.tv = (user as { tokenVersion: number }).tokenVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as 'USER' | 'ADMIN';
        session.user.tokenVersion = (token.tv as number) ?? 0;
      }
      return session;
    },
  },
};

export async function auth() {
  return getServerSession(authOptions);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
