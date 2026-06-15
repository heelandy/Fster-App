import Link from 'next/link';

export function FeatureLocked({ feature }: { feature: string }) {
  return (
    <div className="card text-center">
      <p className="text-2xl">🔒</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">{feature} is a paid feature</h2>
      <p className="mt-1 text-sm text-slate-600">
        Upgrade your plan to unlock {feature.toLowerCase()}.
      </p>
      <Link href="/billing" className="btn-primary mt-4 inline-flex">View plans</Link>
    </div>
  );
}

export function AccessDenied() {
  return (
    <div className="card text-center">
      <p className="text-2xl">⛔</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">You don’t have access to this area</h2>
      <p className="mt-1 text-sm text-slate-600">Ask your household’s foster parent for access.</p>
    </div>
  );
}
