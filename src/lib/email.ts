import { getResendApiKey, getEmailFrom } from './config';

/**
 * Pluggable transactional email.
 *
 * - If `RESEND_API_KEY` is set, messages are sent via the Resend HTTP API
 *   (no SDK dependency — a single `fetch`).
 * - Otherwise (dev / unconfigured) the message is logged to the server console
 *   so password-reset and invite links are usable locally without a provider.
 *
 * Swapping providers means changing only `deliver()` below; every caller uses
 * the high-level helpers (`sendPasswordReset`, `sendInvite`, …).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  ok: boolean;
  provider: 'resend' | 'log';
  error?: string; // human-readable reason when ok === false (e.g. Resend's message)
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escape values interpolated into email HTML. Field values (household names,
 * appointment titles, locations) are user-controlled, so without this they could
 * inject markup/links into a message that appears to come from us (phishing).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wrap body content in a minimal, email-client-safe HTML shell. */
export function emailLayout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
    <p style="font-weight:700;color:#b45309;margin:0 0 16px">🏠 Foster Care HMS</p>
    <h1 style="font-size:18px;margin:0 0 12px">${heading}</h1>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="font-size:12px;color:#64748b;margin:0">This is an automated message from Foster Care HMS. If you weren’t expecting it, you can ignore it.</p>
  </div>
</body></html>`;
}

async function deliver(msg: EmailMessage): Promise<SendResult> {
  const text = msg.text ?? stripHtml(msg.html);
  const apiKey = await getResendApiKey();

  if (!apiKey) {
    // Dev / unconfigured mode: surface the content (incl. any link) in the server log.
    console.info(
      `\n[email:dev] no Resend API key set — not sent.\n  To:      ${msg.to}\n  Subject: ${msg.subject}\n  Body:    ${text}\n`,
    );
    return { ok: true, provider: 'log' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: await getEmailFrom(),
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] provider returned', res.status, body);
      // Resend errors are JSON like {"message":"…","name":"validation_error"}.
      let reason = `Resend returned ${res.status}`;
      try {
        const j = JSON.parse(body) as { message?: string; error?: string };
        if (j.message || j.error) reason = j.message || j.error!;
      } catch { /* non-JSON body */ }
      return { ok: false, provider: 'resend', error: reason };
    }
    return { ok: true, provider: 'resend' };
  } catch (err) {
    console.error('[email] send failed:', err);
    return { ok: false, provider: 'resend', error: 'Network error reaching Resend.' };
  }
}

/** Generic sender (used by the helpers below and by reminder/notification flows). */
export function sendEmail(msg: EmailMessage): Promise<SendResult> {
  return deliver(msg);
}

// ───────────────────────────── Typed helpers ─────────────────────────────

export function sendPasswordReset(to: string, link: string): Promise<SendResult> {
  const safeLink = escapeHtml(link);
  return deliver({
    to,
    subject: 'Reset your Foster Care HMS password',
    html: emailLayout(
      'Reset your password',
      `<p style="font-size:14px;line-height:1.6">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour and can be used once.</p>
       <p style="margin:24px 0"><a href="${safeLink}" style="background:#b45309;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block">Reset password</a></p>
       <p style="font-size:12px;color:#64748b;word-break:break-all">Or paste this link into your browser:<br/>${safeLink}</p>`,
    ),
  });
}

export function sendInvite(to: string, householdName: string, link: string): Promise<SendResult> {
  const safeName = escapeHtml(householdName);
  const safeLink = escapeHtml(link);
  return deliver({
    to,
    // Subject is plain text (JSON field, not rendered as HTML) — no escaping needed.
    subject: `You've been invited to ${householdName} on Foster Care HMS`,
    html: emailLayout(
      `Join ${safeName}`,
      `<p style="font-size:14px;line-height:1.6">You’ve been invited to help manage <strong>${safeName}</strong> in Foster Care HMS. Click below to accept — you’ll create an account (or sign in) and be added automatically. This invite expires in 7 days.</p>
       <p style="margin:24px 0"><a href="${safeLink}" style="background:#b45309;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block">Accept invitation</a></p>
       <p style="font-size:12px;color:#64748b;word-break:break-all">Or paste this link into your browser:<br/>${safeLink}</p>`,
    ),
  });
}

/** Sent when an admin provisions a new account: the user sets their own password. */
export function sendAccountSetup(to: string, link: string): Promise<SendResult> {
  const safeLink = escapeHtml(link);
  return deliver({
    to,
    subject: 'Set up your Foster Care HMS account',
    html: emailLayout(
      'Welcome — set your password',
      `<p style="font-size:14px;line-height:1.6">An account has been created for you on Foster Care HMS. Click below to choose a password and finish setting up. This link expires in 24 hours.</p>
       <p style="margin:24px 0"><a href="${safeLink}" style="background:#b45309;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block">Set my password</a></p>
       <p style="font-size:12px;color:#64748b;word-break:break-all">Or paste this link into your browser:<br/>${safeLink}</p>`,
    ),
  });
}

export function sendVerificationEmail(to: string, link: string): Promise<SendResult> {
  const safeLink = escapeHtml(link);
  return deliver({
    to,
    subject: 'Confirm your Foster Care HMS email',
    html: emailLayout(
      'Confirm your email',
      `<p style="font-size:14px;line-height:1.6">Thanks for signing up. Please confirm this email address to finish setting up your account. This link expires in 24 hours.</p>
       <p style="margin:24px 0"><a href="${safeLink}" style="background:#b45309;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block">Confirm email</a></p>
       <p style="font-size:12px;color:#64748b;word-break:break-all">Or paste this link into your browser:<br/>${safeLink}</p>`,
    ),
  });
}

/** Sent to the household owner when their subscription plan changes (up/down/cancel). */
export function sendPlanChanged(to: string, fromTier: string, toTier: string): Promise<SendResult> {
  const toFree = toTier === 'FREE';
  const heading = toFree ? 'Your subscription was canceled' : `You’re now on the ${toTier} plan`;
  const body = toFree
    ? `<p style="font-size:14px;line-height:1.6">Your plan changed from <strong>${escapeHtml(fromTier)}</strong> to <strong>Free</strong>. You can re-subscribe anytime from the Billing page.</p>`
    : `<p style="font-size:14px;line-height:1.6">Your plan changed from <strong>${escapeHtml(fromTier)}</strong> to <strong>${escapeHtml(toTier)}</strong> — thank you! You can manage your subscription anytime from the Billing page.</p>`;
  return deliver({ to, subject: heading, html: emailLayout(heading, body) });
}

export function sendReminder(to: string, title: string, whenLabel: string, detail: string): Promise<SendResult> {
  return deliver({
    to,
    subject: `Reminder: ${title}`,
    html: emailLayout(
      escapeHtml(title),
      `<p style="font-size:14px;line-height:1.6"><strong>${escapeHtml(whenLabel)}</strong></p>
       <p style="font-size:14px;line-height:1.6">${escapeHtml(detail)}</p>`,
    ),
  });
}
