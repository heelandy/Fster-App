import { env } from './env';
import {
  getStripeSecretKey, getStripeWebhookSecret, getResendApiKey, getEmailFrom,
} from './config';

/**
 * Pre-flight configuration checks for production readiness. `getConfigWarnings`
 * is pure + side-effect free (env only) so it's safe at build time;
 * `getIntegrationWarnings` is async (reads the DB-resolved Stripe/email config)
 * and runtime-only. Both feed the admin System tab. They catch the insecure
 * defaults and placeholder keys that are easy to forget when going live.
 */

export interface ConfigWarning {
  level: 'critical' | 'warning';
  message: string;
}

/** True for an obviously-placeholder value (example text rather than a real key). */
function looksPlaceholder(v: string): boolean {
  return /placeholder|xxx|changeme|example|replace-with/i.test(v);
}

const PLACEHOLDER_SECRET = 'replace-with-a-long-random-secret';
const PLACEHOLDER_KEY = 'replace-with-a-long-random-encryption-key';

export function getConfigWarnings(): ConfigWarning[] {
  const w: ConfigWarning[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  if (env.NEXTAUTH_SECRET === PLACEHOLDER_SECRET) {
    w.push({ level: 'critical', message: 'NEXTAUTH_SECRET is the example placeholder — set a strong random secret.' });
  } else if (env.NEXTAUTH_SECRET.length < 32) {
    w.push({ level: 'warning', message: 'NEXTAUTH_SECRET is shorter than 32 characters.' });
  }
  if (env.ENCRYPTION_KEY === PLACEHOLDER_KEY) {
    w.push({ level: 'critical', message: 'ENCRYPTION_KEY is the example placeholder — set a strong random key and back it up (losing it makes encrypted data unrecoverable).' });
  }

  if (isProd) {
    if (env.APP_URL.includes('localhost')) {
      w.push({ level: 'warning', message: 'APP_URL still points at localhost in production.' });
    }
    if (env.ALLOWED_ORIGINS.includes('localhost')) {
      w.push({ level: 'warning', message: 'ALLOWED_ORIGINS still includes localhost in production.' });
    }
    if (env.STORAGE_DRIVER === 'local') {
      w.push({ level: 'warning', message: 'STORAGE_DRIVER is "local": uploads are lost on serverless/ephemeral hosts — use "s3" or a persistent disk.' });
    }
    if (!env.CRON_SECRET) {
      w.push({ level: 'warning', message: 'CRON_SECRET is unset — appointment reminders will not send.' });
    }
  }
  return w;
}

/**
 * Runtime checks on the DB-resolved Stripe + email config. Flags keys that are
 * SET but look like placeholders or are otherwise invalid — the silent
 * misconfigurations that make billing/email "look configured" but fail. (An
 * UNSET key isn't flagged: those features just degrade gracefully.)
 */
export async function getIntegrationWarnings(): Promise<ConfigWarning[]> {
  const w: ConfigWarning[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  const sk = await getStripeSecretKey();
  if (sk) {
    if (!sk.startsWith('sk_')) {
      w.push({ level: 'critical', message: 'Stripe secret key is set but is not a valid Stripe key (must start with "sk_").' });
    } else if (looksPlaceholder(sk) || sk.length < 30) {
      w.push({ level: 'critical', message: 'Stripe secret key looks like a placeholder — billing will fail. Set your real sk_… key.' });
    } else {
      const wh = await getStripeWebhookSecret();
      if (!wh || looksPlaceholder(wh) || wh.length < 30) {
        w.push({ level: 'warning', message: 'Stripe key is set but the webhook signing secret is missing/placeholder — Stripe events (renewals, cancellations, failed payments) won’t sync automatically. (The billing-page reconcile still applies changes on visit.)' });
      }
      if (isProd && sk.startsWith('sk_test_')) {
        w.push({ level: 'warning', message: 'Stripe is in TEST mode (sk_test_…) in production — switch to live keys to take real payments.' });
      }
    }
  }

  const resend = await getResendApiKey();
  if (resend) {
    if (!resend.startsWith('re_') || looksPlaceholder(resend)) {
      w.push({ level: 'warning', message: 'Resend API key looks invalid/placeholder — transactional emails may not send.' });
    } else if (isProd && /onboarding@resend\.dev/i.test(await getEmailFrom())) {
      w.push({ level: 'warning', message: 'EMAIL_FROM uses onboarding@resend.dev, which only delivers to your own Resend account — use a verified domain in production.' });
    }
  } else if (isProd) {
    w.push({ level: 'warning', message: 'No email provider configured — password-reset, verification and invite emails won’t send.' });
  }

  return w;
}
