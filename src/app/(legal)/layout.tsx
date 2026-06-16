import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/" className="mb-6 block text-lg font-bold text-brand-700">🏠 Foster Care HMS</Link>
        <div className="mb-6 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Draft template — not legal advice.</strong> These pages are a starting point and must be
          reviewed and completed by a qualified attorney before public launch. Bracketed items like
          <code className="mx-1">[Company Name]</code> are placeholders to fill in.
        </div>
        <article className="card prose-sm space-y-4 text-sm leading-relaxed text-slate-700">{children}</article>
        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/privacy" className="hover:underline">Privacy</Link> ·{' '}
          <Link href="/terms" className="hover:underline">Terms</Link>
        </p>
      </div>
    </main>
  );
}
