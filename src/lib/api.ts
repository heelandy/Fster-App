import type { ZodSchema } from 'zod';
import { Errors } from './http';
import { rateLimit, type RateLimits } from './rate-limit';
import { rateLimitRedis, redisConfigured } from './rate-limit-redis';
import { assertSameOrigin, getClientInfo } from './request';

/** Parse and validate a JSON request body, throwing a ZodError on failure. */
export async function readJson<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw Errors.badRequest('Request body must be valid JSON.');
  }
  return schema.parse(body);
}

/** Apply a rate-limit preset keyed by an identifier; throws 429 when exceeded. */
export function enforceRateLimit(key: string, preset: (typeof RateLimits)[keyof typeof RateLimits]) {
  const result = rateLimit(key, preset.limit, preset.windowMs);
  if (!result.success) throw Errors.rateLimited();
  return result;
}

/**
 * Additional DISTRIBUTED (cross-instance) rate-limit check, for credential-
 * sensitive endpoints. No-op unless Upstash Redis is configured — callers always
 * run the synchronous in-memory `enforceRateLimit` too, so this only adds a
 * shared-store layer for multi-instance/serverless deployments. Async by nature
 * (Redis is over HTTP); kept separate from the synchronous CSRF/in-memory guard
 * so those can never accidentally fail open.
 */
export async function enforceDistributedLimit(key: string, preset: (typeof RateLimits)[keyof typeof RateLimits]) {
  if (!redisConfigured) return;
  const result = await rateLimitRedis(key, preset.limit, preset.windowMs);
  if (!result.success) throw Errors.rateLimited();
}

/**
 * Standard guard for state-changing API routes: verifies request origin (CSRF)
 * and applies a per-client rate limit. Returns client info for audit logging.
 */
export function mutationGuard(scope: string, userId: string, preset: (typeof RateLimits)[keyof typeof RateLimits]) {
  assertSameOrigin();
  const info = getClientInfo();
  enforceRateLimit(`${scope}:${userId}:${info.ip}`, preset);
  return info;
}
