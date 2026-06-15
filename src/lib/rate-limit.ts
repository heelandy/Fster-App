/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * Suitable for a single-instance deployment and for blunting brute-force and
 * abusive clients. For multi-instance/serverless production, swap the Map for a
 * shared store (Redis / Upstash) — the `rateLimit` interface stays the same.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically evict expired buckets so the Map cannot grow unbounded.
const SWEEP_INTERVAL = 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

/**
 * @param key   Unique identifier for the caller+route (e.g. `login:1.2.3.4`).
 * @param limit Max requests allowed within the window.
 * @param windowMs Window length in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, limit, resetAt };
  }

  existing.count += 1;
  const success = existing.count <= limit;
  return {
    success,
    remaining: Math.max(0, limit - existing.count),
    limit,
    resetAt: existing.resetAt,
  };
}

/** Common presets. */
export const RateLimits = {
  auth: { limit: 5, windowMs: 60_000 }, // 5 registration attempts per minute / IP
  // Login is higher: no human logs in 20×/min, but it still blunts automated
  // credential-stuffing floods. Per-account lockout is the primary brute-force defense.
  login: { limit: 20, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 }, // 60 mutations per minute
  read: { limit: 240, windowMs: 60_000 },
  upload: { limit: 20, windowMs: 60_000 },
  webhook: { limit: 120, windowMs: 60_000 },
};
