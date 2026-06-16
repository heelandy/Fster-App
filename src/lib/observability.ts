import { env } from './env';

/**
 * Central error reporting. Always logs to the server console; additionally POSTs
 * a sanitized JSON payload to ERROR_WEBHOOK_URL when configured (Slack/Discord/
 * Sentry-relay/custom). Pluggable and dependency-free — swap the transport here
 * to adopt a full APM later. Never throws (reporting must not break a request).
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  const scope = context?.scope ? String(context.scope) : 'app';
  console.error(`[error:${scope}]`, error);

  if (!env.ERROR_WEBHOOK_URL) return;
  try {
    const payload = {
      app: 'foster-care-hms',
      env: process.env.NODE_ENV ?? 'unknown',
      at: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
    };
    // Fire-and-forget — do not await or surface failures.
    void fetch(env.ERROR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // never throw from the reporter
  }
}
