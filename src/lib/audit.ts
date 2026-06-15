import { prisma } from './prisma';

/** Security-relevant events (logins, denials, downloads, rate-limits). */
export async function logSecurity(params: {
  actorId?: string | null;
  event: string;
  ip?: string | null;
  userAgent?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.securityAuditLog.create({
      data: {
        actorId: params.actorId ?? null,
        event: params.event,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        path: params.path ?? null,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    // Audit logging must never break the request path.
    console.error('[audit] failed to write security log:', err);
  }
}

/** Administrative actions (user management, settings changes, data access). */
export async function logAdmin(params: {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write admin log:', err);
  }
}
