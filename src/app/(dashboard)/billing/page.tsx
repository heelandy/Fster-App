import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/plans';
import { reconcileFromStripe } from '@/lib/billing-sync';
import { BillingClient } from '@/components/billing-client';
import { AccessDenied } from '@/components/feature-locked';

export default async function BillingPage({ searchParams }: { searchParams: { status?: string } }) {
  let ctx = await requireHousehold();
  if (!can(ctx, 'billing:manage')) return <AccessDenied />;

  const justPaid = searchParams?.status === 'success';
  const cancelled = searchParams?.status === 'cancelled';

  // Returning from checkout — pull the latest subscription straight from Stripe so
  // the upgrade applies even without a webhook, then re-read the context.
  if (justPaid) {
    try { await reconcileFromStripe(ctx.householdId); } catch { /* poll/webhook will catch up */ }
    ctx = await requireHousehold();
  }

  const household = await prisma.household.findUnique({
    where: { id: ctx.householdId },
    select: {
      stripeCustomerId: true,
      subscription: {
        select: {
          status: true,
          interval: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          trialEndsAt: true,
        },
      },
    },
  });
  const sub = household?.subscription ?? null;

  const invoices = await prisma.invoice.findMany({
    where: { subscription: { householdId: ctx.householdId } },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });

  const plans = Object.values(PLANS).map((p) => ({
    tier: p.tier,
    name: p.name,
    description: p.description,
    priceMonthly: p.priceCentsMonthly,
    priceAnnual: p.priceCentsAnnual,
  }));

  return (
    <div>
      {justPaid && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✅ Payment received — thank you! Your plan updates here within a few seconds (refresh if needed).
          You can safely <strong>close this tab</strong> and return to the app.{' '}
          <a href="/dashboard" className="font-medium underline">Go to dashboard</a>
        </div>
      )}
      {cancelled && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Checkout cancelled — no charge was made. You can choose a plan again whenever you’re ready.
        </div>
      )}
      <BillingClient
        currentTier={ctx.tier}
        status={sub?.status ?? 'ACTIVE'}
        interval={sub?.interval ?? 'MONTHLY'}
        currentPeriodEnd={sub?.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null}
        cancelAtPeriodEnd={sub?.cancelAtPeriodEnd ?? false}
        trialEndsAt={sub?.trialEndsAt ? sub.trialEndsAt.toISOString() : null}
        plans={plans}
        hasCustomer={Boolean(household?.stripeCustomerId)}
      />

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Invoices &amp; receipts</h2>
        <div className="card p-0">
          {invoices.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No invoices yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-700">{inv.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-700">${(inv.amountPaidCents / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.status}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.hostedInvoiceUrl && (
                        <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:underline">
                          View / receipt
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
