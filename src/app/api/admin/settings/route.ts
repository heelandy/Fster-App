import { z } from 'zod';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { getSettings, setSetting, SETTING_DEFAULTS } from '@/lib/settings';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

const patchSchema = z.object({
  key: z.enum(Object.keys(SETTING_DEFAULTS) as [string, ...string[]]),
  value: z.string().max(500),
});

export function GET() {
  return handle(async () => {
    await requireAdminPermission('settings.update');
    return json(await getSettings());
  });
}

export function PATCH(req: Request) {
  return handle(async () => {
    const admin = await requireAdminPermission('settings.update');
    mutationGuard('admin-settings', admin.id, RateLimits.write);
    const { key, value } = await readJson(req, patchSchema);
    await setSetting(key, value, admin.id);
    await logAdmin({
      actorId: admin.id,
      action: 'SETTING_UPDATED',
      targetType: 'Setting',
      targetId: key,
      metadata: { key, value },
    });
    return json(await getSettings());
  });
}
