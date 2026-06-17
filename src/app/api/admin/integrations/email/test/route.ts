import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { requireStepUp } from '@/lib/stepup';
import { sendEmail, emailLayout } from '@/lib/email';
import { isEmailConfigured } from '@/lib/config';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  to: z.string().email().max(200).optional(),
});

/**
 * Send a test email using the currently-saved email config, so the admin can
 * verify delivery before going live. The recipient defaults to the admin's own
 * email but can be overridden — useful when the From is `onboarding@resend.dev`,
 * which Resend only delivers to your own Resend-account address. Returns the
 * provider used ('resend' = sent, 'log' = dev-log/unconfigured) and, on failure,
 * Resend's actual reason. SuperAdmin + step-up required.
 */
export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdminPermission('admins.manage');
    mutationGuard('integrations-email-test', admin.id, RateLimits.write);
    requireStepUp(admin.id);

    const { to } = await readJson(req, bodySchema);
    const me = await prisma.user.findUnique({ where: { id: admin.id }, select: { email: true } });
    const recipient = to || me?.email;
    if (!recipient) throw Errors.badRequest('No recipient — your account has no email address.');

    const configured = await isEmailConfigured();
    const result = await sendEmail({
      to: recipient,
      subject: 'Foster Care HMS — test email',
      html: emailLayout(
        'Test email',
        `<p style="font-size:14px;line-height:1.6">This is a test message from your Integrations page. If it reached your inbox, transactional email is working and password-reset, verification, invite and reminder emails will send.</p>`,
      ),
    });

    await logAdmin({
      actorId: admin.id,
      action: 'EMAIL_TEST_SENT',
      metadata: { to: recipient, provider: result.provider, ok: result.ok },
    });
    return json({ ok: result.ok, provider: result.provider, to: recipient, configured, error: result.error });
  });
}
