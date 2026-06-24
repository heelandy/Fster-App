import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { agencyRegisterSchema } from '@/lib/validation';
import { handle, json, Errors } from '@/lib/http';
import { readJson, enforceRateLimit, enforceDistributedLimit } from '@/lib/api';
import { getClientInfo } from '@/lib/request';
import { logSecurity } from '@/lib/audit';
import { notifyAdmins } from '@/lib/notify';
import { issueEmailVerification } from '@/lib/email-verification';
import { RateLimits } from '@/lib/rate-limit';
import { isFlagOn } from '@/lib/settings';
import { verifyCaptcha } from '@/lib/captcha';
import { runFreeChecks, allFreeChecksPass } from '@/lib/agency-verification';

export const runtime = 'nodejs';

/**
 * Dedicated agency sign-up. Unlike the foster-parent register flow, this captures
 * the legitimacy details (legal name, EIN, US state, address, license) up front
 * and creates the agency in PENDING verification. A platform admin reviews it
 * before any oversight features unlock — see lib/agency requireVerifiedAgency.
 */
export function POST(req: Request) {
  return handle(async () => {
    const info = getClientInfo();
    enforceRateLimit(`register:${info.ip}`, RateLimits.auth);
    await enforceDistributedLimit(`register:${info.ip}`, RateLimits.auth);

    if (!(await isFlagOn('signupEnabled'))) {
      throw Errors.badRequest('New sign-ups are currently disabled. Please check back later.');
    }

    const data = await readJson(req, agencyRegisterSchema);

    if (!(await verifyCaptcha(data.captchaToken, info.ip))) {
      throw Errors.badRequest('CAPTCHA verification failed. Please try again.');
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      // Do not reveal which emails are registered — return a generic conflict.
      throw Errors.conflict('Unable to create an account with those details.');
    }

    const passwordHash = await hashPassword(data.password);
    const checks = runFreeChecks(data);

    // Create the user + the agency (PENDING review) + the AGENCY_ADMIN membership
    // atomically. No household and no subscription — an agency is not a home.
    const { user, agency } = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email: data.email, name: data.name, passwordHash } });
      const a = await tx.agency.create({
        data: {
          name: data.agencyName,
          displayName: data.agencyName,
          verificationStatus: 'PENDING',
          submittedAt: new Date(),
          legalName: data.legalName,
          ein: data.ein,
          npi: data.npi ?? null,
          usState: data.usState,
          licenseNumber: data.licenseNumber ?? null,
          phone: data.phone ?? null,
          addressLine: data.addressLine,
          city: data.city,
          postalCode: data.postalCode,
          website: data.website ?? null,
        },
      });
      await tx.agencyMember.create({ data: { agencyId: a.id, userId: u.id, role: 'AGENCY_ADMIN' } });
      return { user: u, agency: a };
    });

    await logSecurity({
      actorId: user.id,
      event: 'AGENCY_REGISTERED',
      ip: info.ip,
      metadata: { email: data.email, agencyId: agency.id, freeChecksPass: allFreeChecksPass(checks) },
    });
    await notifyAdmins({
      type: 'AGENCY_VERIFICATION',
      level: allFreeChecksPass(checks) ? 'info' : 'warning',
      message: `Agency awaiting verification: ${data.agencyName} (${data.usState})${allFreeChecksPass(checks) ? '' : ' — automatic checks flagged issues'}`,
      metadata: { agencyId: agency.id },
    });

    try {
      await issueEmailVerification(user.id, data.email);
    } catch (err) {
      console.error('[register-agency] verification email failed:', err);
    }

    return json({ ok: true, role: 'AGENCY' }, 201);
  });
}
