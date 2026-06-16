import { env } from './env';

/**
 * Pre-flight configuration checks for production readiness. Pure + side-effect
 * free (no throw) so it's safe to call during build and at runtime; results are
 * surfaced in the admin System tab. Catches the insecure defaults that are easy
 * to forget when going live.
 */

export interface ConfigWarning {
  level: 'critical' | 'warning';
  message: string;
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
