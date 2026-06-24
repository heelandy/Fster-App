'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';

/**
 * Signs the user out after a period of inactivity (no mouse/keyboard/scroll/touch
 * activity). A warning banner appears in the final seconds with a "Stay signed in"
 * button. Mounted in the authenticated areas (dashboard, agency portal, admin).
 *
 * Note: this is a client-side convenience timeout. The JWT session still has its
 * own server-side maxAge; this just enforces a much shorter idle window in the UI.
 */
const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes idle
const WARN_MS = 20 * 1000; // warn in the final 20s

export function IdleLogout() {
  const deadline = useRef(Date.now() + TIMEOUT_MS);
  const lastReset = useRef(0);
  const [remaining, setRemaining] = useState<number | null>(null); // seconds left, only while warning

  useEffect(() => {
    let loggedOut = false;

    const reset = () => {
      const now = Date.now();
      if (now - lastReset.current < 1000) return; // throttle resets to once/sec
      lastReset.current = now;
      deadline.current = now + TIMEOUT_MS;
      setRemaining((prev) => (prev === null ? prev : null));
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    const tick = setInterval(() => {
      const left = deadline.current - Date.now();
      if (left <= 0) {
        if (!loggedOut) {
          loggedOut = true;
          void signOut({ callbackUrl: '/login?reason=timeout' });
        }
        return;
      }
      const next = left <= WARN_MS ? Math.ceil(left / 1000) : null;
      setRemaining((prev) => (prev === next ? prev : next));
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearInterval(tick);
    };
  }, []);

  function stay() {
    deadline.current = Date.now() + TIMEOUT_MS;
    lastReset.current = Date.now();
    setRemaining(null);
  }

  if (remaining === null) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
      <p className="text-sm text-amber-800">
        Signing you out in <span className="font-semibold">{remaining}s</span> for inactivity.
      </p>
      <button onClick={stay} className="btn-primary text-sm">Stay signed in</button>
    </div>
  );
}
