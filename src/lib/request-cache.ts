import { cache as reactCache } from 'react';

/**
 * React's `cache()` deduplicates a function's result within a single server request
 * (RSC / route handler), so repeated calls across the layout, page, and components
 * share one execution. It only exists in the React Server Components runtime; under
 * plain Node (e.g. Vitest) the import is `undefined`, so we fall back to an identity
 * wrapper — no per-request dedupe is needed in unit tests.
 */
export const requestCache = (
  typeof reactCache === 'function' ? reactCache : <T>(fn: T): T => fn
) as <T>(fn: T) => T;
