import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability, requireFeature } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { deleteStoredFile } from '@/lib/storage';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

export function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'documents:write');
    requireFeature(ctx, 'documents');
    mutationGuard('documents', ctx.userId, RateLimits.write);

    const doc = await prisma.document.findFirst({
      where: { id: params.id, householdId: ctx.householdId },
      select: { id: true, storageKey: true },
    });
    if (!doc) throw Errors.notFound();

    await prisma.document.delete({ where: { id: doc.id } });
    await deleteStoredFile(doc.storageKey);
    await logAdmin({ actorId: ctx.userId, action: 'DOCUMENT_DELETE', targetType: 'Document', targetId: doc.id });
    return json({ ok: true });
  });
}
