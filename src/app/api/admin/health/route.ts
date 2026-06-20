import { promises as fs, constants as fsConstants } from 'fs';
import path from 'path';
import os from 'os';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { env } from '@/lib/env';
import { isStripeConfigured, isEmailConfigured } from '@/lib/config';
import { getConfigWarnings, getIntegrationWarnings } from '@/lib/config-check';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

// Safety bounds so a huge/deep upload store can't make this health probe slow.
const MAX_MEASURED_FILES = 20_000;
const MAX_MEASURED_DEPTH = 12;

/** Measure a directory's file count and total bytes (best-effort, bounded, parallel). */
async function measureDir(
  dir: string,
): Promise<{ files: number; bytes: number; writable: boolean; capped: boolean }> {
  let writable = false;
  try {
    await fs.access(dir);
  } catch {
    // dir doesn't exist yet — created on first upload
    return { files: 0, bytes: 0, writable: false, capped: false };
  }
  await fs.access(dir, fsConstants.W_OK).then(() => { writable = true; }).catch(() => {});

  // Collect file paths breadth-bounded, then stat them in parallel.
  const filePaths: string[] = [];
  const walk = async (d: string, depth: number): Promise<void> => {
    if (depth > MAX_MEASURED_DEPTH || filePaths.length >= MAX_MEASURED_FILES) return;
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    const subdirs: string[] = [];
    for (const e of entries) {
      if (filePaths.length >= MAX_MEASURED_FILES) break;
      const full = path.join(d, e.name);
      if (e.isDirectory()) subdirs.push(full);
      else filePaths.push(full);
    }
    await Promise.all(subdirs.map((s) => walk(s, depth + 1)));
  };
  await walk(dir, 0);

  const sizes = await Promise.all(
    filePaths.map(async (f) => {
      try {
        return (await fs.stat(f)).size;
      } catch {
        return 0;
      }
    }),
  );
  const bytes = sizes.reduce((a, b) => a + b, 0);
  return { files: filePaths.length, bytes, writable, capped: filePaths.length >= MAX_MEASURED_FILES };
}

/** Detailed system health for the admin console (DB, storage, memory, config). */
export function GET() {
  return handle(async () => {
    await requireAdminPermission('system.view');

    const dbStart = Date.now();
    let dbOk = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }
    const dbLatencyMs = Date.now() - dbStart;

    const storage = await measureDir(path.resolve(env.FILE_STORAGE_DIR));
    const mem = process.memoryUsage();

    // Process CPU usage sampled over a short window → rough percent of one core.
    const cpuStart = process.cpuUsage();
    const tStart = Date.now();
    await new Promise((r) => setTimeout(r, 100));
    const cpuDelta = process.cpuUsage(cpuStart);
    const elapsedUs = Math.max(1, (Date.now() - tStart) * 1000);
    const cpuPercent = Math.round(((cpuDelta.user + cpuDelta.system) / elapsedUs) * 100);

    const [openTickets, unreadNotifs, stripeOk, emailOk, integrationWarnings] = await Promise.all([
      prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'PENDING'] } } }),
      prisma.notification.count({ where: { isRead: false } }),
      isStripeConfigured(),
      isEmailConfigured(),
      getIntegrationWarnings(),
    ]);

    return json({
      db: { ok: dbOk, latencyMs: dbLatencyMs },
      storage: {
        dir: env.FILE_STORAGE_DIR,
        files: storage.files,
        bytes: storage.bytes,
        writable: storage.writable,
        capped: storage.capped,
        maxUploadBytes: env.MAX_UPLOAD_BYTES,
      },
      runtime: {
        node: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        cpuPercent,
        cpuCores: os.cpus().length,
        loadAvg1m: Math.round(os.loadavg()[0] * 100) / 100, // 0 on Windows
        platform: process.platform,
        env: process.env.NODE_ENV ?? 'unknown',
      },
      integrations: {
        stripe: stripeOk,
        email: emailOk,
        cronConfigured: env.CRON_SECRET.length > 0,
      },
      queues: { openTickets, unreadNotifications: unreadNotifs },
      configWarnings: [...getConfigWarnings(), ...integrationWarnings],
      checkedAt: new Date().toISOString(),
    });
  });
}
