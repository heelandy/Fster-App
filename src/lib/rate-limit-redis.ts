import { env, redisConfigured } from './env';
import type { RateLimitResult } from './rate-limit';

/**
 * Distributed fixed-window rate limiter backed by Upstash Redis (REST API) —
 * dependency-free (a single fetch). Used for credential-sensitive endpoints so
 * the limit holds ACROSS instances / serverless invocations, where the in-memory
 * limiter (which is per-process) would not. Falls back to "allow" if Redis is
 * unreachable, so an outage degrades to the in-memory limiter rather than locking
 * everyone out (those callers run the in-memory check too).
 */

export { redisConfigured };

export async function rateLimitRedis(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + windowMs;
  try {
    // Pipeline: INCR the counter, and set the window expiry (PEXPIRE) on it.
    const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', `rl:${key}`],
        ['PEXPIRE', `rl:${key}`, String(windowMs), 'NX'],
      ]),
    });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    const data = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(data[0]?.result ?? 0);
    const success = count <= limit;
    return { success, remaining: Math.max(0, limit - count), limit, resetAt };
  } catch (err) {
    console.error('[rate-limit] redis error, allowing (in-memory limit still applies):', err);
    return { success: true, remaining: limit, limit, resetAt };
  }
}
