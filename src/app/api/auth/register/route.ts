import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { registerSchema } from '@/lib/validation';
import { handle, json, Errors } from '@/lib/http';
import { readJson, enforceRateLimit } from '@/lib/api';
import { getClientInfo } from '@/lib/request';
import { logSecurity } from '@/lib/audit';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export function POST(req: Request) {
  return handle(async () => {
    const info = getClientInfo();
    enforceRateLimit(`register:${info.ip}`, RateLimits.auth);

    const data = await readJson(req, registerSchema);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      // Do not reveal which emails are registered — return a generic conflict.
      throw Errors.conflict('Unable to create an account with those details.');
    }

    const passwordHash = await hashPassword(data.password);

    // Create the user, their first household, owner membership, and a FREE
    // subscription atomically.
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email: data.email, name: data.name, passwordHash },
      });
      const household = await tx.household.create({
        data: { name: data.householdName, ownerId: u.id },
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
      return u;
    });

    await logSecurity({ actorId: user.id, event: 'REGISTERED', ip: info.ip, metadata: { email: data.email } });

    return json({ ok: true }, 201);
  });
}
