import { isUsState } from './us-states';
import { env } from './env';

/**
 * Agency legitimacy checks ("is this a real USA agency?").
 *
 * Two layers:
 *  1. Free, deterministic checks on the submitted details (this file) — they flag
 *     obvious problems so a human reviewer can focus. They do NOT prove legitimacy.
 *  2. An OPTIONAL external provider hook (env-gated) for an automatic EIN lookup.
 *
 * The final decision is always a platform admin's manual approve/reject.
 */

export interface VerificationCheck {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface AgencyDetails {
  legalName?: string | null;
  ein?: string | null;
  npi?: string | null;
  usState?: string | null;
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
  website?: string | null;
}

/**
 * Validate a 10-digit NPI with the official check-digit algorithm: prefix the
 * first 9 digits with the NPI namespace "80840" and run Luhn against the 10th
 * digit. A real NPI always passes; a typo/fake almost never does.
 */
export function isValidNpi(npi: string | null | undefined): boolean {
  const d = (npi ?? '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(d)) return false;
  const base = `80840${d.slice(0, 9)}`;
  let sum = 0;
  let double = true; // start doubling from the rightmost digit of `base`
  for (let i = base.length - 1; i >= 0; i--) {
    let n = base.charCodeAt(i) - 48;
    if (double) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    double = !double;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === d.charCodeAt(9) - 48;
}

/** Run the free deterministic checks; deterministic from the stored fields. */
export function runFreeChecks(a: AgencyDetails): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  checks.push({
    key: 'usState',
    label: 'Registered in a US state',
    pass: isUsState(a.usState),
    detail: a.usState ? a.usState.toUpperCase() : 'no state provided',
  });

  const einOk = !!a.ein && /^\d{2}-\d{7}$/.test(a.ein);
  checks.push({
    key: 'ein',
    label: 'EIN format valid (NN-NNNNNNN)',
    pass: einOk,
    detail: a.ein || 'no EIN provided',
  });

  // NPI is optional; absent is fine, but a provided NPI must be valid.
  checks.push({
    key: 'npi',
    label: 'NPI check digit valid (if provided)',
    pass: !a.npi || isValidNpi(a.npi),
    detail: a.npi || 'not provided (optional)',
  });

  const hasAddress = !!(a.addressLine && a.city && a.postalCode);
  checks.push({
    key: 'address',
    label: 'Full US mailing address',
    pass: hasAddress,
    detail: hasAddress ? `${a.addressLine}, ${a.city} ${a.postalCode}` : 'incomplete address',
  });

  const zipOk = !!a.postalCode && /^\d{5}(-\d{4})?$/.test(a.postalCode.trim());
  checks.push({
    key: 'zip',
    label: 'US ZIP code format',
    pass: zipOk,
    detail: a.postalCode || 'no ZIP provided',
  });

  checks.push({
    key: 'legalName',
    label: 'Legal business name provided',
    pass: !!(a.legalName && a.legalName.trim().length >= 2),
    detail: a.legalName || 'none',
  });

  return checks;
}

export function allFreeChecksPass(checks: VerificationCheck[]): boolean {
  return checks.every((c) => c.pass);
}

// ── NPI registry lookup (free, keyless — CMS NPPES) ──
export interface NpiResult {
  found: boolean;
  number?: string;
  type?: string; // 'NPI-1' (individual) | 'NPI-2' (organization)
  name?: string;
  state?: string;
  city?: string;
  status?: string; // 'A' = active
}

interface NppesAddress { address_purpose?: string; state?: string; city?: string }
interface NppesResult {
  number?: number;
  enumeration_type?: string;
  basic?: { organization_name?: string; first_name?: string; last_name?: string; status?: string };
  addresses?: NppesAddress[];
}
interface NppesResponse { result_count?: number; results?: NppesResult[] }

/**
 * Look an NPI up in the public CMS NPPES registry — free, no API key. Returns the
 * registered organisation/person + state so an admin can confirm it matches what
 * the agency submitted. Best-effort: returns { found: false } on any failure.
 */
export async function lookupNpi(npi: string | null | undefined): Promise<NpiResult | null> {
  const d = (npi ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (!/^\d{10}$/.test(d)) return { found: false };
  try {
    const res = await fetch(`https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${d}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { found: false };
    const data = (await res.json()) as NppesResponse;
    const r = data.results?.[0];
    if (!data.result_count || !r) return { found: false };
    const loc = (r.addresses ?? []).find((x) => x.address_purpose === 'LOCATION') ?? r.addresses?.[0];
    const name =
      r.enumeration_type === 'NPI-2'
        ? r.basic?.organization_name
        : [r.basic?.first_name, r.basic?.last_name].filter(Boolean).join(' ');
    return {
      found: true,
      number: r.number ? String(r.number) : d,
      type: r.enumeration_type,
      name: name || undefined,
      state: loc?.state,
      city: loc?.city,
      status: r.basic?.status,
    };
  } catch {
    return { found: false };
  }
}

export const agencyVerifyApiConfigured =
  env.AGENCY_VERIFY_API_URL.length > 0 && env.AGENCY_VERIFY_API_KEY.length > 0;

/**
 * Optional external business-verification hook. No-op (returns null) unless BOTH
 * AGENCY_VERIFY_API_URL and AGENCY_VERIFY_API_KEY are set — keeping the platform
 * free and secret-less by default. When configured it POSTs the EIN/name/state to
 * the provider and returns its verdict; the admin decision is still final.
 */
export async function runExternalVerification(
  a: AgencyDetails,
): Promise<{ provider: string; ok: boolean; detail?: string } | null> {
  if (!agencyVerifyApiConfigured) return null;
  try {
    const res = await fetch(env.AGENCY_VERIFY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AGENCY_VERIFY_API_KEY}`,
      },
      body: JSON.stringify({ legalName: a.legalName, ein: a.ein, state: a.usState }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { provider: 'external', ok: false, detail: `provider returned ${res.status}` };
    const data = (await res.json().catch(() => ({}))) as {
      verified?: boolean;
      status?: string;
      detail?: string;
    };
    return {
      provider: 'external',
      ok: data.verified === true || data.status === 'verified',
      detail: data.detail,
    };
  } catch (err) {
    return { provider: 'external', ok: false, detail: err instanceof Error ? err.message : 'request failed' };
  }
}
