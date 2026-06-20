import { z } from 'zod';

/**
 * Centralised, validated environment access. Secrets are read ONLY here and on
 * the server. Importing this in a client component will fail the build, which is
 * intentional — it keeps secrets out of the browser bundle.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET must be at least 16 chars'),
  // Key for AES-256-GCM field/file encryption at rest. Any string ≥16 chars; it is
  // hashed to a 32-byte key. MUST be stable and backed up — losing it makes
  // encrypted data unrecoverable.
  ENCRYPTION_KEY: z.string().min(16, 'ENCRYPTION_KEY must be at least 16 chars'),
  NEXTAUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url().default('http://localhost:3000'),

  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PRICE_FAMILY_MONTHLY: z.string().default(''),
  STRIPE_PRICE_FAMILY_ANNUAL: z.string().default(''),
  STRIPE_PRICE_PRO_MONTHLY: z.string().default(''),
  STRIPE_PRICE_PRO_ANNUAL: z.string().default(''),
  STRIPE_PRICE_AGENCY_MONTHLY: z.string().default(''),
  STRIPE_PRICE_AGENCY_ANNUAL: z.string().default(''),

  FILE_STORAGE_DIR: z.string().default('./storage/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10_485_760),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Storage backend: "local" (default, private disk) or "s3" (S3/Cloudflare R2).
  // On serverless/multi-instance hosts the local disk is ephemeral — use "s3".
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_S3_ENDPOINT: z.string().default(''), // e.g. https://<acct>.r2.cloudflarestorage.com
  STORAGE_S3_REGION: z.string().default('auto'),
  STORAGE_S3_BUCKET: z.string().default(''),
  STORAGE_S3_ACCESS_KEY_ID: z.string().default(''),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().default(''),

  // Transactional email (Resend HTTP API). Unset = dev mode: messages are logged
  // to the server console (so reset/invite links are usable locally) but not sent.
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('Foster Care HMS <onboarding@resend.dev>'),

  // Shared secret guarding the reminder cron endpoint (Bearer token). Unset =
  // the endpoint is disabled (returns 503) so it cannot be triggered anonymously.
  CRON_SECRET: z.string().default(''),

  // Optional Upstash Redis (REST) for DISTRIBUTED rate limiting of credential
  // endpoints across instances/serverless. Unset = per-instance in-memory only.
  UPSTASH_REDIS_REST_URL: z.string().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(''),

  // Optional error-reporting webhook (Slack/Discord/Sentry-relay/custom). When set,
  // unhandled server errors are POSTed here as JSON. Unset = console logging only.
  ERROR_WEBHOOK_URL: z.string().default(''),

  // Stripe Tax (automatic sales tax / VAT / GST). Off by default — only enable
  // AFTER activating Stripe Tax in the Dashboard, or checkout will error.
  STRIPE_TAX_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),

  // Optional malware/AV scan endpoint for uploads. When set, uploaded files are
  // POSTed here and rejected unless the scanner reports them clean. Unset = skip.
  AV_SCAN_URL: z.string().default(''),

  // Optional Cloudflare Turnstile (CAPTCHA) on registration. Set BOTH to enable;
  // unset = no CAPTCHA. The site key is also read client-side via NEXT_PUBLIC_*.
  TURNSTILE_SECRET_KEY: z.string().default(''),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().default(''),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Do not print values — only the names of missing/invalid vars.
  const issues = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
  throw new Error(`Invalid or missing environment variables: ${issues}`);
}

export const env = parsed.data;

export const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const stripeConfigured = env.STRIPE_SECRET_KEY.startsWith('sk_');
export const emailConfigured = env.RESEND_API_KEY.length > 0;
export const redisConfigured =
  env.UPSTASH_REDIS_REST_URL.length > 0 && env.UPSTASH_REDIS_REST_TOKEN.length > 0;
export const avScanConfigured = env.AV_SCAN_URL.length > 0;
export const captchaConfigured =
  env.TURNSTILE_SECRET_KEY.length > 0 && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY.length > 0;
