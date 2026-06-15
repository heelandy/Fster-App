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
