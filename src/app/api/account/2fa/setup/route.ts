import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { generateTotpSecret, otpauthUri } from '@/lib/totp';
import { qrSvgDataUrl } from '@/lib/qr';

export const runtime = 'nodejs';

/**
 * Begin 2FA enrollment: generate a fresh secret and persist it (encrypted at
 * rest) but DO NOT enable 2FA yet — enabling requires confirming a valid code at
 * /api/account/2fa/enable. Returns the secret + otpauth URI for the QR code.
 */
export function POST() {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('2fa-setup', user.id, RateLimits.write);

    // Refuse to re-key while 2FA is active: rekeying here would clear
    // twoFactorEnabledAt and effectively disable 2FA without the password step
    // that /2fa/disable enforces. The user must disable first.
    const current = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabledAt: true },
    });
    if (current?.twoFactorEnabledAt) {
      throw Errors.badRequest('Two-factor is already enabled. Disable it first to set it up again.');
    }

    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      // Store the candidate secret; enabledAt stays null until confirmed.
      data: { twoFactorSecret: secret, twoFactorEnabledAt: null },
    });

    const uri = otpauthUri(secret, user.email ?? user.id);
    return json({ secret, otpauthUri: uri, qrDataUrl: qrSvgDataUrl(uri) });
  });
}
