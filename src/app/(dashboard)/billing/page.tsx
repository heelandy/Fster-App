import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/plans';
import { BillingClient } from '@/components/billing-client';
import { AccessDenied } from '@/components/feature-locked';

export default async function BillingPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'billing:manage')) return <AccessDenied />;

  const household = await prisma.household.findUnique({
    where: { id: ctx.householdId },
    select: { stripeCustomerId: true, subscription: { select: { status: true } } },
  });

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
      <BillingClient
        currentTier={ctx.tier}
        status={household?.subscription?.status ?? 'ACTIVE'}
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
