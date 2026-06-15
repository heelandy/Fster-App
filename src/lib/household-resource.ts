import type { ZodSchema } from 'zod';
import { prisma } from './prisma';
import { handle, json, Errors } from './http';
import { readJson, mutationGuard } from './api';
import { RateLimits } from './rate-limit';
import { assertChildInHousehold } from './scope';
import {
  requireHousehold,
  requireCapability,
  requireFeature,
  type Capability,
  type HouseholdContext,
} from './authz';
import { withinLimit, planLimit, type FeatureKey, type PlanFeatures } from './plans';

/**
 * Generic household-scoped CRUD factory.
 *
 * Every generated handler:
 *  - requires an authenticated household member,
 *  - enforces the read/write capability for the caller's role,
 *  - enforces the plan feature gate (if any),
 *  - scopes ALL queries by `householdId` (IDOR-safe),
 *  - validates input with Zod,
 *  - validates any referenced `childId` belongs to the same household.
 */

// Loose delegate shape shared by all Prisma models we use it with.
interface Delegate {
  findMany: (args: unknown) => Promise<unknown[]>;
  findFirst: (args: unknown) => Promise<unknown>;
  count: (args: unknown) => Promise<number>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
}

export interface ResourceConfig<T> {
  delegate: Delegate;
  scope: string;
  readCap: Capability;
  writeCap: Capability;
  feature?: FeatureKey;
  schema: ZodSchema<T>;
  childField?: 'required' | 'optional';
  include?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** Enforce a plan row-count limit on create (e.g. FREE maxAppointments). */
  limit?: keyof PlanFeatures['limits'];
  /** Extra fields injected on create (e.g. authorId, createdById). */
  stamp?: (ctx: HouseholdContext) => Record<string, unknown>;
  /** Extra WHERE conditions applied to list reads (e.g. hide legal rows from babysitters). */
  listWhere?: (ctx: HouseholdContext) => Record<string, unknown>;
  /** Transform validated input before create (e.g. derive a flag from the body). */
  transform?: (data: Record<string, unknown>, ctx: HouseholdContext) => Record<string, unknown>;
}

function guard(ctx: HouseholdContext, cap: Capability, feature?: FeatureKey) {
  requireCapability(ctx, cap);
  if (feature) requireFeature(ctx, feature);
}

export function collection<T extends Record<string, unknown>>(cfg: ResourceConfig<T>) {
  const GET = () =>
    handle(async () => {
      const ctx = await requireHousehold();
      guard(ctx, cfg.readCap, cfg.feature);
      const rows = await cfg.delegate.findMany({
        where: { householdId: ctx.householdId, ...(cfg.listWhere?.(ctx) ?? {}) },
        include: cfg.include,
        orderBy: cfg.orderBy ?? { createdAt: 'desc' },
      });
      return json(rows);
    });

  const POST = (req: Request) =>
    handle(async () => {
      const ctx = await requireHousehold();
      guard(ctx, cfg.writeCap, cfg.feature);
      mutationGuard(cfg.scope, ctx.userId, RateLimits.write);

      if (cfg.limit) {
        const current = await cfg.delegate.count({ where: { householdId: ctx.householdId } });
        if (!withinLimit(ctx.tier, cfg.limit, current)) {
          throw Errors.payment(
            `Your ${ctx.tier} plan allows up to ${planLimit(ctx.tier, cfg.limit)}. Upgrade to add more.`,
          );
        }
      }

      const data = (await readJson(req, cfg.schema)) as Record<string, unknown>;

      if (cfg.childField && typeof data.childId === 'string') {
        await assertChildInHousehold(ctx, data.childId);
      } else if (cfg.childField === 'required' && !data.childId) {
        throw Errors.badRequest('A child must be selected.');
      }

      const shaped = cfg.transform ? cfg.transform(data, ctx) : data;
      const row = await cfg.delegate.create({
        data: { ...shaped, ...(cfg.stamp?.(ctx) ?? {}), householdId: ctx.householdId },
        include: cfg.include,
      });
      return json(row, 201);
    });

  return { GET, POST };
}

export function item<T extends Record<string, unknown>>(cfg: ResourceConfig<T>) {
  const load = async (ctx: HouseholdContext, id: string) => {
    const row = await cfg.delegate.findFirst({ where: { id, householdId: ctx.householdId } });
    if (!row) throw Errors.notFound();
    return row;
  };

  const PATCH = (req: Request, { params }: { params: { id: string } }) =>
    handle(async () => {
      const ctx = await requireHousehold();
      guard(ctx, cfg.writeCap, cfg.feature);
      mutationGuard(cfg.scope, ctx.userId, RateLimits.write);
      await load(ctx, params.id);
      const data = (await readJson(
        req,
        (cfg.schema as unknown as { partial: () => ZodSchema<Partial<T>> }).partial(),
      )) as Record<string, unknown>;
      if (cfg.childField && typeof data.childId === 'string') {
        await assertChildInHousehold(ctx, data.childId);
      }
      // Re-derive computed fields on edit too (e.g. contact.isLegal from role),
      // otherwise an edit could leave a stale flag and defeat access filters.
      const shaped = cfg.transform ? cfg.transform(data, ctx) : data;
      const row = await cfg.delegate.update({
        where: { id: params.id },
        data: shaped,
        include: cfg.include,
      });
      return json(row);
    });

  const DELETE = (_req: Request, { params }: { params: { id: string } }) =>
    handle(async () => {
      const ctx = await requireHousehold();
      guard(ctx, cfg.writeCap, cfg.feature);
      mutationGuard(cfg.scope, ctx.userId, RateLimits.write);
      await load(ctx, params.id);
      await cfg.delegate.delete({ where: { id: params.id } });
      return json({ ok: true });
    });

  return { PATCH, DELETE };
}
