import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { changePasswordSchema } from '@/lib/validation';
import { hashPassword } from '@/lib/auth';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

/** Change password for the signed-in user (requires the current password). */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('password', user.id, RateLimits.write);
    const { currentPassword, newPassword } = await readJson(req, changePasswordSchema);

    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!row || !(await bcrypt.compare(currentPassword, row.passwordHash))) {
      throw Errors.badRequest('Your current password is incorrect.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await logSecurity({ actorId: user.id, event: 'PASSWORD_CHANGED' });

    return json({ ok: true });
  });
}
