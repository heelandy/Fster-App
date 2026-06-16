import type { PlanTier, BillingInterval } from '@prisma/client';
import { env } from './env';
import { getSettingValue, setSetting, getSecret, setSecret } from './settings';

/**
 * Runtime integration config (Stripe + email), resolved DB-first with an
 * environment-variable fallback. This lets a SuperAdmin configure live keys and
 * the Stripe webhook from the admin UI without editing env or redeploying, while
 * existing env-based deployments keep working unchanged. Secret values are stored
 * encrypted at rest (see lib/settings `setSecret`/`getSecret`).
 */

export const CONFIG_KEYS = {
  stripeSecretKey: 'integration.stripe.secretKey', // secret
  stripePublishableKey: 'integration.stripe.publishableKey',
  stripeWebhookSecret: 'integration.stripe.webhookSecret', // secret
  stripeWebhookEndpointId: 'integration.stripe.webhookEndpointId',
  resendApiKey: 'integration.email.resendApiKey', // secret
  emailFrom: 'integration.email.from',
} as const;

function priceKey(tier: PlanTier, interval: BillingInterval): string {
  return `integration.stripe.price.${tier}.${interval}`;
}

const ENV_PRICE: Record<string, string> = {
  'FAMILY.MONTHLY': env.STRIPE_PRICE_FAMILY_MONTHLY,
  'FAMILY.ANNUAL': env.STRIPE_PRICE_FAMILY_ANNUAL,
  'PRO.MONTHLY': env.STRIPE_PRICE_PRO_MONTHLY,
  'PRO.ANNUAL': env.STRIPE_PRICE_PRO_ANNUAL,
  'AGENCY.MONTHLY': env.STRIPE_PRICE_AGENCY_MONTHLY,
  'AGENCY.ANNUAL': env.STRIPE_PRICE_AGENCY_ANNUAL,
};

// ───────────────────────────── Stripe getters ─────────────────────────────

export async function getStripeSecretKey(): Promise<string> {
  return (await getSecret(CONFIG_KEYS.stripeSecretKey)) || env.STRIPE_SECRET_KEY || '';
}

export async function getStripePublishableKey(): Promise<string> {
  return (await getSettingValue(CONFIG_KEYS.stripePublishableKey)) || env.STRIPE_PUBLISHABLE_KEY || '';
}

export async function getStripeWebhookSecret(): Promise<string> {
  return (await getSecret(CONFIG_KEYS.stripeWebhookSecret)) || env.STRIPE_WEBHOOK_SECRET || '';
}

export async function getStripePriceId(tier: PlanTier, interval: BillingInterval): Promise<string> {
  const fromDb = await getSettingValue(priceKey(tier, interval));
  return fromDb || ENV_PRICE[`${tier}.${interval}`] || '';
}

export async function isStripeConfigured(): Promise<boolean> {
  return (await getStripeSecretKey()).startsWith('sk_');
}

// ───────────────────────────── Email getters ─────────────────────────────

export async function getResendApiKey(): Promise<string> {
  return (await getSecret(CONFIG_KEYS.resendApiKey)) || env.RESEND_API_KEY || '';
}

export async function getEmailFrom(): Promise<string> {
  return (await getSettingValue(CONFIG_KEYS.emailFrom)) || env.EMAIL_FROM;
}

export async function isEmailConfigured(): Promise<boolean> {
  return (await getResendApiKey()).length > 0;
}

// ───────────────────────────── Setters (admin UI) ─────────────────────────────

export async function setStripeSecretKey(v: string, by?: string) { await setSecret(CONFIG_KEYS.stripeSecretKey, v.trim(), by); }
export async function setStripePublishableKey(v: string, by?: string) { await setSetting(CONFIG_KEYS.stripePublishableKey, v.trim(), by); }
export async function setStripeWebhookSecret(v: string, by?: string) { await setSecret(CONFIG_KEYS.stripeWebhookSecret, v.trim(), by); }
export async function setStripeWebhookEndpointId(v: string, by?: string) { await setSetting(CONFIG_KEYS.stripeWebhookEndpointId, v.trim(), by); }
export async function setStripePriceId(tier: PlanTier, interval: BillingInterval, v: string, by?: string) {
  await setSetting(priceKey(tier, interval), v.trim(), by);
}
export async function setResendApiKey(v: string, by?: string) { await setSecret(CONFIG_KEYS.resendApiKey, v.trim(), by); }
export async function setEmailFrom(v: string, by?: string) { await setSetting(CONFIG_KEYS.emailFrom, v.trim(), by); }

// ───────────────────────────── Status (UI, no secret reveal) ─────────────────────────────

function mask(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '••••';
  return `${secret.slice(0, 3)}…${secret.slice(-4)}`;
}

const PAID_TIERS: PlanTier[] = ['FAMILY', 'PRO', 'AGENCY'];
const INTERVALS: BillingInterval[] = ['MONTHLY', 'ANNUAL'];

/** Summary for the SuperAdmin Integrations page — never returns raw secrets. */
export async function getIntegrationStatus() {
  const [dbSecret, dbWebhook, dbResend] = await Promise.all([
    getSecret(CONFIG_KEYS.stripeSecretKey),
    getSecret(CONFIG_KEYS.stripeWebhookSecret),
    getSecret(CONFIG_KEYS.resendApiKey),
  ]);
  const secretKey = await getStripeSecretKey();
  const webhookSecret = await getStripeWebhookSecret();
  const resendKey = await getResendApiKey();

  const prices: Record<string, string> = {};
  for (const t of PAID_TIERS) {
    for (const i of INTERVALS) prices[`${t}.${i}`] = await getStripePriceId(t, i);
  }

  return {
    stripe: {
      secretKeySet: secretKey.startsWith('sk_'),
      secretKeyMasked: mask(secretKey),
      secretKeySource: dbSecret ? 'db' : env.STRIPE_SECRET_KEY ? 'env' : 'unset',
      livemode: secretKey.startsWith('sk_live_'),
      publishableKey: await getStripePublishableKey(),
      webhookSecretSet: webhookSecret.length > 0,
      webhookSecretSource: dbWebhook ? 'db' : env.STRIPE_WEBHOOK_SECRET ? 'env' : 'unset',
      webhookEndpointId: (await getSettingValue(CONFIG_KEYS.stripeWebhookEndpointId)) ?? '',
      prices,
    },
    email: {
      apiKeySet: resendKey.length > 0,
      apiKeyMasked: mask(resendKey),
      apiKeySource: dbResend ? 'db' : env.RESEND_API_KEY ? 'env' : 'unset',
      from: await getEmailFrom(),
    },
  };
}

export type IntegrationStatus = Awaited<ReturnType<typeof getIntegrationStatus>>;
