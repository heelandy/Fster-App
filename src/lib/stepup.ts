import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { env } from './env';
import { Errors } from './http';

/**
 * Step-up authentication: after a SuperAdmin re-verifies their TOTP code, we set
 * a short-lived, HMAC-signed cookie that gates the most sensitive admin actions
 * (live Stripe keys / webhook config). The signature uses NEXTAUTH_SECRET so the
 * cookie can't be forged, and it is bound to the user id and an expiry.
 */

const COOKIE = 'fc_stepup';
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function sign(payload: string): string {
  return createHmac('sha256', env.NEXTAUTH_SECRET).update(payload).digest('base64url');
}

/** Issue a step-up cookie for the user (called after a successful TOTP check). */
export function issueStepUp(userId: string): void {
  const payload = `${userId}:${Date.now() + TTL_MS}`;
  const token = `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(TTL_MS / 1000),
  });
}

export function clearStepUp(): void {
  cookies().delete(COOKIE);
}

/** True if a valid, unexpired step-up cookie exists for this user. */
export function hasStepUp(userId: string): boolean {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return false;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return false;
  const b64 = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);

  let payload: string;
  try {
    payload = Buffer.from(b64, 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const [uid, expStr] = payload.split(':');
  const exp = Number(expStr);
  return uid === userId && Number.isFinite(exp) && exp > Date.now();
}

/** Throw 403 unless the user has a current step-up verification. */
export function requireStepUp(userId: string): void {
  if (!hasStepUp(userId)) throw Errors.forbidden();
}
