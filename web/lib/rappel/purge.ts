// web/lib/rappel/purge.ts
//
// FW-DELAI-RAPPEL, R915: unconfirmed reminder requests are purged ON THE
// ALERT FLOW'S SCHEDULE - the same PURGE_QUEUE pass, the same thirty days
// (PURGE_AFTER_DAYS, which /confidentialite interpolates) - so the notice's
// "au bout de 30 jours au plus tard" is performed by the job that performs
// the alert list's.
//
// R244's SHAPE: it reports what it considered and why it kept the rest, not
// merely that it ran. A count of zero is true of a healthy table and of a
// query that matches nothing, and only the census tells them apart.

import { prisma } from '@/lib/db/client';
import { PURGE_AFTER_DAYS } from '@/lib/alerts/lifetimes';
import { parisDayOf, toStoredDay } from '@/lib/entries/day';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReminderPurgeRun {
  readonly cutoff: string;
  /** Every unconfirmed request, whatever its age. */
  readonly considered: number;
  readonly deleted: number;
  /** Unconfirmed, still inside its thirty days. */
  readonly keptTooRecent: number;
  /** R916: rows of either kind whose date had passed, deleted unsent. */
  readonly lapsed: number;
}

/**
 * R916: delete every row whose date is before `today` (Paris, ISO), confirmed
 * or not - the reminder can no longer help, and the notice says the row goes
 * "une fois cette date passée". ONE IMPLEMENTATION (R206): the daily purge
 * calls it, so it holds even where the send queue is not scheduled, and the
 * reminder pass calls it before sending (lib/rappel/job.ts).
 */
export async function deleteLapsedReminders(today: string): Promise<number> {
  const { count } = await prisma.deadlineReminder.deleteMany({
    where: { deadline: { lt: toStoredDay(today) } },
  });

  return count;
}

/** Delete unconfirmed requests older than PURGE_AFTER_DAYS, on the instant `now`. */
export async function purgeUnconfirmedReminders(now: number = Date.now()): Promise<ReminderPurgeRun> {
  const cutoff = new Date(now - PURGE_AFTER_DAYS * DAY_MS);

  // Counted BEFORE the delete: afterwards the census would be of survivors.
  const [considered, keptTooRecent] = await Promise.all([
    prisma.deadlineReminder.count({ where: { confirmedAt: null } }),
    prisma.deadlineReminder.count({ where: { confirmedAt: null, createdAt: { gte: cutoff } } }),
  ]);

  const { count: deleted } = await prisma.deadlineReminder.deleteMany({
    where: { confirmedAt: null, createdAt: { lt: cutoff } },
  });
  const lapsed = await deleteLapsedReminders(parisDayOf(new Date(now)));

  return { cutoff: cutoff.toISOString(), considered, deleted, keptTooRecent, lapsed };
}

/** One line for a log, since nobody is watching when this runs. */
export function describeReminderPurge(run: ReminderPurgeRun): string {
  return (
    `[purge] deadline reminders unconfirmed for ${PURGE_AFTER_DAYS} days (${run.cutoff}): ` +
    `considered ${run.considered}, deleted ${run.deleted}, kept ${run.keptTooRecent} too recent; ` +
    `deleted ${run.lapsed} past their date`
  );
}
