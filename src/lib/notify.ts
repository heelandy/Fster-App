import { prisma } from './prisma';

/** Create an admin-facing notification (best-effort; never breaks the caller). */
export async function notifyAdmins(params: {
  type: string;
  message: string;
  level?: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.notification.create({
      data: {
        type: params.type,
        message: params.message,
        level: params.level ?? 'info',
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    console.error('[notify] failed to create notification:', err);
  }
}
