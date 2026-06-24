import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { Heart } from 'lucide-react';
import { resolvePlanCatalogue } from '@/lib/plan-catalogue';

// The plan catalogue rarely changes but is read on every anonymous landing-page
// hit. Cache it (revalidated every 5 min, and busted immediately when an admin
// edits a plan via revalidateTag('plans')) so the marketing page isn't gated on a
// DB round-trip. The page stays dynamic for the CSP nonce; only this read is cached.
const getCachedPlans = unstable_cache(() => resolvePlanCatalogue(), ['landing-plan-catalogue'], {
  revalidate: 300,
  tags: ['plans'],
});

// Rendered per-request so the nonce-based CSP (set in middleware) is applied to
// the page's scripts; a static page would carry no matching nonce and its
// scripts would be blocked by the CSP.
export const dynamic = 'force-dynamic';

const FEATURES = [
  ['Child profiles', 'Securely store names, DOB, case info, allergies, doctors and emergency contacts.'],
  ['Appointments', 'Track doctor, therapy, dental, court, school and caseworker visits with reminders.'],
  ['Documents', 'Private, access-controlled storage for placement, medical, school and court paperwork.'],
  ['Daily care logs', 'Record meals, sleep, mood, behavior, incidents and milestones day by day.'],
  ['Medications', 'Track dosage, schedule, prescribers and a full give/miss log.'],
  ['Expenses', 'Log foster-care spending by category with receipts and monthly summaries.'],
  ['Contacts', 'Keep caseworkers, GAL, attorneys, therapists and teachers in one place.'],
  ['Routines & checklists', 'Reusable morning, bedtime, visit-day and intake checklists.'],
  ['Licensing tracker', 'Stay ahead of training hours, inspections and renewal deadlines.'],
];

function price(cents: number) {
  return cents === 0 ? 'Free' : `$${(cents / 100).toFixed(0)}/mo`;
}

export default async function HomePage() {
  // Admin-editable commercial fields (name/price/description); inactive plans hidden.
  const plans = (await getCachedPlans()).filter((p) => p.isActive);
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-lg font-bold text-brand-700">
          <Heart className="h-5 w-5" fill="currentColor" /> Foster Care HMS
        </span>
        <nav className="flex gap-3">
          <Link href="/login" className="btn-secondary">Log in</Link>
          <Link href="/register" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <section className="mt-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Everything for foster care, in one secure place
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Manage placements, appointments, documents, medications, expenses, contacts, routines and
          licensing — designed for real foster parent daily use, built privacy-first.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary">Create your household</Link>
          <Link href="#pricing" className="btn-secondary">See pricing</Link>
        </div>
      </section>

      <section className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([title, desc]) => (
          <div key={title} className="card">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{desc}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="mt-24">
        <h2 className="text-center text-3xl font-bold text-slate-900">Plans for every household</h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.tier} className="card flex flex-col">
              <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
              <p className="mt-2 text-2xl font-bold text-brand-700">{price(plan.priceCentsMonthly)}</p>
              <p className="mt-2 flex-1 text-sm text-slate-600">{plan.description}</p>
              <Link href="/register" className="btn-primary mt-4">
                {plan.tier === 'FREE' ? 'Start free' : 'Choose plan'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-24 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
        <p>
          Are you a foster agency?{' '}
          <Link href="/register/agency" className="font-medium text-brand-700 hover:underline">
            Register your agency →
          </Link>
        </p>
        <p className="mt-3">
          Built privacy-first. Sensitive foster care data is encrypted in transit, access-controlled,
          and never exposed to unauthorized users.
        </p>
      </footer>
    </main>
  );
}
