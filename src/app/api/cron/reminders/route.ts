import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { handle, json, Errors, HttpError } from '@/lib/http';
import { sendReminder } from '@/lib/email';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * Fire due appointment reminders. Designed to be called on a schedule (Vercel
 * Cron, a Windows Task, GitHub Actions, cron-job.org…) with:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Idempotent: each appointment is marked `reminderSent` so repeated calls won't
 * re-send. If CRON_SECRET is unset the endpoint is disabled (503) so it can't be
 * triggered anonymously in production.
 */

function authorize(req: Request) {
  if (!env.CRON_SECRET) throw new HttpError(503, 'Reminder cron is not configured.');
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.CRON_SECRET}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw Errors.unauthorized();
}

async function run() {
  const now = new Date();
  const due = await prisma.appointment.findMany({
    where: { reminderSent: false, reminderAt: { not: null, lte: now } },
    take: 200,
    select: {
      id: true, title: true, startsAt: true, location: true, householdId: true,
      household: {
        select: {
          name: true,
          members: {
            where: { role: { in: ['FOSTER_PARENT', 'CO_PARENT'] } },
            select: { user: { select: { email: true } } },
          },
        },
      },
    },
  });

  let sent = 0;
  const doneIds: string[] = [];
  for (const appt of due) {
    const recipients = appt.household.members.map((m) => m.user.email).filter(Boolean);
    const whenLabel = appt.startsAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
    const detail = appt.location ? `Location: ${appt.location}` : 'See the app for details.';
    await Promise.all(
      recipients.map(async (to) => {
        const res = await sendReminder(to, appt.title, whenLabel, detail);
        if (res.ok) sent++;
      }),
    );
    doneIds.push(appt.id);
  }

  if (doneIds.length > 0) {
    await prisma.appointment.updateMany({ where: { id: { in: doneIds } }, data: { reminderSent: true } });
  }

  return { processed: due.length, emailsSent: sent, at: now.toISOString() };
}

export function POST(req: Request) {
  return handle(async () => {
    authorize(req);
    return json(await run());
  });
}

// Allow GET too, for schedulers that only issue GET requests.
export function GET(req: Request) {
  return handle(async () => {
    authorize(req);
    return json(await run());
  });
}
