import type { PlanTier, BillingInterval } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { integrationConfigSchema } from '@/lib/validation';
import { hasStepUp, requireStepUp } from '@/lib/stepup';
import { logAdmin } from '@/lib/audit';
import {
  getIntegrationStatus, setStripePriceId, setStripePaymentLink, setEmailFrom,
} from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Read integration status. Requires the `admins.manage` permission (SuperAdmin)
 * AND a current step-up (authenticator) verification before any config — even
 * masked — is returned. The response tells the UI whether to prompt for 2FA
 * enrollment or for a step-up code.
 */
export function GET() {
  return handle(async () => {
    const admin = await requireAdminPermission('admins.manage');
    const me = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { twoFactorEnabledAt: true },
    });
    const twoFactorEnabled = Boolean(me?.twoFactorEnabledAt);
    if (!twoFactorEnabled) return json({ twoFactorEnabled: false, stepUpRequired: true });
    if (!hasStepUp(admin.id)) return json({ twoFactorEnabled: true, stepUpRequired: true });
    return json({ twoFactorEnabled: true, stepUpRequired: false, status: await getIntegrationStatus() });
  });
}

/** Save integration config. SuperAdmin + step-up required. */
export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdminPermission('admins.manage');
    mutationGuard('integrations', admin.id, RateLimits.write);
    requireStepUp(admin.id);

    const data = await readJson(req, integrationConfigSchema);
    const changed: string[] = [];

    // Secret keys (Stripe secret, webhook signing secret, Resend key) are NOT
    // settable here — they live in environment variables only, so the app never
    // exposes a way to enter or read them. Only non-secret config is editable.
    if (data.emailFrom !== undefined) { await setEmailFrom(data.emailFrom, admin.id); changed.push('emailFrom'); }
    if (data.prices) {
      for (const [tier, intervals] of Object.entries(data.prices)) {
        for (const [interval, value] of Object.entries(intervals ?? {})) {
          if (value !== undefined) {
            await setStripePriceId(tier as PlanTier, interval as BillingInterval, value, admin.id);
            changed.push(`price.${tier}.${interval}`);
          }
        }
      }
    }
    if (data.paymentLinks) {
      for (const [tier, intervals] of Object.entries(data.paymentLinks)) {
        for (const [interval, value] of Object.entries(intervals ?? {})) {
          if (value !== undefined) {
            await setStripePaymentLink(tier as PlanTier, interval as BillingInterval, value, admin.id);
            changed.push(`paymentLink.${tier}.${interval}`);
          }
        }
      }
    }

    // Audit which keys changed — never the values (they're secrets).
    await logAdmin({ actorId: admin.id, action: 'INTEGRATIONS_UPDATED', metadata: { changed } });
    return json({ ok: true, status: await getIntegrationStatus() });
  });
}
