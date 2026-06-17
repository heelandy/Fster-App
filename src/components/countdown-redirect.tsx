'use client';

import { useEffect, useState } from 'react';

/**
 * Shows a short countdown, then navigates to `to`. Used for the post-payment
 * "automatic return" so the user sees confirmation before being sent on.
 */
export function CountdownRedirect({ to, seconds = 5, message }: { to: string; seconds?: number; message?: string }) {
  const [n, setN] = useState(seconds);

  useEffect(() => {
    if (n <= 0) {
      window.location.href = to;
      return;
    }
    const id = window.setTimeout(() => setN((v) => v - 1), 1000);
    return () => window.clearTimeout(id);
  }, [n, to]);

  return (
    <span>
      {message ?? 'Returning to your dashboard'} in <strong>{n}</strong>s…{' '}
      <button onClick={() => { window.location.href = to; }} className="font-medium underline">Go now</button>
    </span>
  );
}
