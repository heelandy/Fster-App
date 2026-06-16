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
 * request comes from an allow-listed origin.
 *
 * This is only called on mutations (POST/PATCH/DELETE via mutationGuard, plus a
 * few admin routes), which browsers always send an `Origin` for. We require a
 * trusted `Origin` OR, if absent, a trusted `Referer` origin — and reject when
 * neither is present, rather than failing open. (Public auth routes like
 * register/forgot-password don't call this; they are IP rate-limited instead.)
 */
export function assertSameOrigin() {
  const h = headers();

  const origin = h.get('origin');
  if (origin) {
    if (!allowedOrigins.includes(origin)) throw Errors.forbidden();
    return;
  }

  // No Origin header — fall back to the Referer's origin.
  const referer = h.get('referer');
  if (referer) {
    let refererOrigin: string;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      throw Errors.forbidden();
    }
    if (!allowedOrigins.includes(refererOrigin)) throw Errors.forbidden();
    return;
  }

  // Neither Origin nor Referer on a state-changing request — refuse.
  throw Errors.forbidden();
}
