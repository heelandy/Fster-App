import { prisma } from './prisma';
import { generateToken } from './tokens';
import { sendVerificationEmail } from './email';
import { env } from './env';

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create a fresh single-use email-verification token and email the link.
 * Best-effort: callers (register/resend) should not fail if email sending fails.
 */
export async function issueEmailVerification(userId: string, email: string): Promise<void> {
  const { raw, hash } = generateToken();
  await prisma.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + EXPIRY_MS) },
  });
  await sendVerificationEmail(email, `${env.APP_URL}/verify-email?token=${raw}`);
}
