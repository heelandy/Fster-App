import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

/**
 * Recent payments for the admin finance view. Returns billing metadata only —
 * never card data (which never touches this server). Used to drive refunds and
 * account credits. Gated by `payments.view`.
 */
export function GET() {
  return handle(async () => {
    await requireAdminPermission('payments.view');
    const rows = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        subscription: {
          select: {
            tier: true,
            stripeCustomerId: true,
            household: {
              select: { id: true, name: true, stripeCustomerId: true, owner: { select: { email: true } } },
            },
          },
        },
      },
    });
    const payments = rows.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      refundable: !!p.stripePaymentId && p.status === 'succeeded',
      tier: p.subscription.tier,
      householdId: p.subscription.household?.id ?? null,
      householdName: p.subscription.household?.name ?? null,
      ownerEmail: p.subscription.household?.owner?.email ?? null,
      stripeCustomerId: p.subscription.stripeCustomerId ?? p.subscription.household?.stripeCustomerId ?? null,
    }));
    return json(payments);
  });
}
