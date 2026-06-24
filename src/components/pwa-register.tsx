'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (production only) so the app is installable as a
 * PWA. The worker itself is a no-op passthrough (see public/sw.js) — registration
 * is best-effort and never blocks rendering.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
