import { prisma } from './prisma';

/**
 * System settings, stored as key/value rows and overlaid on these defaults.
 * Booleans are stored as the strings "true"/"false".
 */
export const SETTING_DEFAULTS: Record<string, string> = {
  appName: 'Foster Care HMS',
  maintenanceMode: 'false',
  signupEnabled: 'true',
  emailVerificationRequired: 'false',
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const merged = { ...SETTING_DEFAULTS };
  for (const r of rows) merged[r.key] = r.value;
  return merged;
}

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key];
}

export async function isFlagOn(key: SettingKey): Promise<boolean> {
  return (await getSetting(key)) === 'true';
}

export async function setSetting(key: string, value: string, updatedBy?: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value, updatedBy },
    create: { key, value, updatedBy },
  });
}
