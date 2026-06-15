import { headers } from 'next/headers';
import { allowedOrigins } from './env';
import { Errors } from './http';

/** Best-effort client IP + user-agent for audit logging and rate-limit keys. */
export function getClientInfo() {
  const h = headers();
  const fwd = h.get('x-forwarded-for');
  const ip = (fwd ? fwd.split(',')[0] : h.get('x-real-ip')) ?? 'unknown';
  return {
    ip: ip.trim(),
    userAgent: h.get('user-agent') ?? 'unknown',
    path: h.get('x-invoke-path') ?? undefined,
  };
}

/**
 * CSRF defence for state-changing requests. NextAuth already protects its own
 * endpoints with a CSRF token; for our JSON APIs we additionally verify the
 * request Origin matches an allow-listed origin. Same-origin browser fetches send
 * Origin automatically; cross-site forged form posts cannot set it.
 */
export function assertSameOrigin() {
  const h = headers();
  const origin = h.get('origin');
  // Same-origin GET/navigations may omit Origin; only enforce when present.
  if (!origin) return;
  if (!allowedOrigins.includes(origin)) {
    throw Errors.forbidden();
  }
}
