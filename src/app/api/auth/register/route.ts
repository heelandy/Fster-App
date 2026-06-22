import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { registerSchema } from '@/lib/validation';
import { handle, json, Errors } from '@/lib/http';
import { readJson, enforceRateLimit, enforceDistributedLimit } from '@/lib/api';
import { getClientInfo } from '@/lib/request';
import { logSecurity } from '@/lib/audit';
import { notifyAdmins } from '@/lib/notify';
import { issueEmailVerification } from '@/lib/email-verification';
import { RateLimits } from '@/lib/rate-limit';
import { isFlagOn } from '@/lib/settings';
import { verifyCaptcha } from '@/lib/captcha';

export const runtime = 'nodejs';

export function POST(req: Request) {
  return handle(async () => {
    const info = getClientInfo();
    enforceRateLimit(`register:${info.ip}`, RateLimits.auth);
    await enforceDistributedLimit(`register:${info.ip}`, RateLimits.auth);

    if (!(await isFlagOn('signupEnabled'))) {
      throw Errors.badRequest('New sign-ups are currently disabled. Please check back later.');
    }

    const data = await readJson(req, registerSchema);

    // Bot protection — no-op unless Turnstile is configured.
    if (!(await verifyCaptcha(data.captchaToken, info.ip))) {
      throw Errors.badRequest('CAPTCHA verification failed. Please try again.');
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      // Do not reveal which emails are registered — return a generic conflict.
      throw Errors.conflict('Unable to create an account with those details.');
    }

    const passwordHash = await hashPassword(data.password);

    // Create the user plus EITHER a foster household (with owner membership + a FREE
    // subscription) OR an agency the user becomes the first admin of — atomically.
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email: data.email, name: data.name, passwordHash },
      });
      if (data.role === 'AGENCY') {
        const agency = await tx.agency.create({ data: { name: data.agencyName! } });
        await tx.agencyMember.create({ data: { agencyId: agency.id, userId: u.id, role: 'AGENCY_ADMIN' } });
      } else {
        const household = await tx.household.create({
          data: { name: data.householdName!, ownerId: u.id },
        });
        await tx.householdMember.create({
          data: {
            householdId: household.id,
            userId: u.id,
            role: 'FOSTER_PARENT',
            acceptedAt: new Date(),
          },
        });
        await tx.subscription.create({
          data: { householdId: household.id, tier: 'FREE', status: 'ACTIVE' },
        });
      }
      return u;
    });

    await logSecurity({ actorId: user.id, event: 'REGISTERED', ip: info.ip, metadata: { email: data.email, role: data.role } });
    await notifyAdmins({ type: 'NEW_USER', message: `New ${data.role === 'AGENCY' ? 'agency' : 'foster parent'} sign-up: ${data.email}`, metadata: { userId: user.id } });

    // Send a verification email (best-effort — never block registration on it).
    try {
      await issueEmailVerification(user.id, data.email);
    } catch (err) {
      console.error('[register] verification email failed:', err);
    }

    return json({ ok: true, role: data.role }, 201);
  });
}
