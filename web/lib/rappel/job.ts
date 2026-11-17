// web/lib/rappel/job.ts
//
// FW-DELAI-RAPPEL, R916: ONE REMINDER, FOURTEEN DAYS BEFORE, THEN THE ROW IS
// GONE. The pass the scheduler runs (lib/scheduler/jobs.ts, DEADLINE_QUEUE).
//
// A SWEEP, NOT A JOB PER ROW. The schedule's payload is null, so no address
// and no date is ever copied into pg-boss's job table, where a completed job
// can outlive the row it was about; the pass reads the table it is about, and
// the table is the only place the address lives.
//
// THE DELETE IS THE CLAIM, AND IT IS THE SAME UNIT OF WORK AS THE SEND. For
// each due row, one transaction deletes the row and then sends; a send that
// fails throws, the transaction rolls back and the row is there for the next
// attempt. Every replica runs its own scheduler (lib/scheduler/instance.ts):
// a second pass reaching the same row blocks on the first one's row lock and
// then deletes nothing, so it sends nothing. One reminder, whatever the
// replica count.
//
// THE DELETE LINK IN THE REMINDER (R916, R917). Before the transaction, the
// row's delete hash is rotated to a fresh token - committed - and that token
// is the message's link. If the send then reports failure after the message
// went out anyway, the row survives with THAT hash, so the link in the
// message the person holds removes it at once. The cost: once a send has
// been attempted, the confirmation message's older link no longer matches
// (the alert flow's rule - the newest message's link is the one that works).
//
// AFTER THE DATE, DELETED UNSENT (R916). A row whose date has passed is
// deleted whether it was confirmed or not, whether a send failed or never
// ran: the reminder can no longer help, and the notice says the row goes
// "une fois cette date passée". The daily purge does the same deletion
// (lib/rappel/purge.ts), so it holds even where this queue is not scheduled.
//
// THE CLOCK IS A PARAMETER (R171): "today" is Paris's calendar day of `now`,
// and a test places it; the scheduler passes the real one.

import { prisma } from '@/lib/db/client';
import { freshToken } from '@/lib/alerts/token';
import { sendMail } from '@/lib/alerts/mailer';
import { fromStoredDay, parisDayOf, toStoredDay } from '@/lib/entries/day';
import { sendDeadlineReminder, type Send } from '@/lib/rappel/mail';
import { deleteLapsedReminders } from '@/lib/rappel/purge';
import { DAYS_BEFORE, shiftDays } from '@/lib/rappel/window';

/** What one pass did (R244: what it considered, not merely that it ran). */
export interface DeadlineReminderRun {
  /** Paris's calendar day the pass ran for. */
  readonly today: string;
  /** Rows deleted unsent because their date had passed. */
  readonly lapsed: number;
  /** Confirmed rows due today or overdue and not yet past their date. */
  readonly due: number;
  readonly sent: number;
  /** Sends that failed; their rows stay for the next attempt. */
  readonly failed: number;
  /** Due rows another pass took first, or that were deleted meanwhile. */
  readonly skipped: number;
}

/** A send that failed, carried out of the transaction so it rolls back. */
class SendFailed extends Error {
  constructor() {
    super('the reminder was not accepted by the mailer');
    this.name = 'SendFailed';
  }
}

/** Send one row's reminder, deleting the row in the same unit of work. */
async function remind(id: string, send: Send): Promise<'sent' | 'failed' | 'skipped'> {
  const remove = freshToken();

  // Committed BEFORE the send: see the header (the link in a message that
  // went out despite a reported failure must still remove the row).
  const rotated = await prisma.deadlineReminder.updateMany({
    where: { id, confirmedAt: { not: null } },
    data: { deleteTokenHash: remove.hash },
  });

  if (rotated.count !== 1) return 'skipped';

  try {
    return await prisma.$transaction(
      async (tx) => {
        const row = await tx.deadlineReminder.findFirst({
          where: { id, deleteTokenHash: remove.hash },
          select: { email: true, deadline: true },
        });

        if (row === null) return 'skipped';

        // THE CLAIM: a second pass blocks here on the row lock, then finds
        // nothing to delete and sends nothing.
        const { count } = await tx.deadlineReminder.deleteMany({ where: { id, deleteTokenHash: remove.hash } });

        if (count !== 1) return 'skipped';

        const ok = await sendDeadlineReminder(row.email, fromStoredDay(row.deadline), remove.token, send);

        if (!ok) throw new SendFailed();

        return 'sent';
      },
      // A mail provider's answer can take seconds; the default five would
      // roll back a send that succeeded slowly.
      { maxWait: 10_000, timeout: 30_000 },
    );
  } catch (error) {
    if (error instanceof SendFailed) return 'failed';

    throw error;
  }
}

/**
 * The pass: delete what has lapsed, then send what is due, on the instant
 * `now`. `send` is injectable so a test can make a send fail; the scheduler
 * uses the product's one mailer.
 */
export async function runDeadlineReminders(now: Date, send: Send = sendMail): Promise<DeadlineReminderRun> {
  const today = parisDayOf(now);
  const lapsed = await deleteLapsedReminders(today);

  // Due: confirmed, and the date within DAYS_BEFORE days - its due day is
  // today or past - but not yet passed (those went just above).
  const horizon = shiftDays(today, DAYS_BEFORE) ?? today;
  const due = await prisma.deadlineReminder.findMany({
    where: {
      confirmedAt: { not: null },
      deadline: { gte: toStoredDay(today), lte: toStoredDay(horizon) },
    },
    select: { id: true },
    orderBy: { deadline: 'asc' },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const { id } of due) {
    const outcome = await remind(id, send);

    if (outcome === 'sent') sent += 1;
    else if (outcome === 'failed') failed += 1;
    else skipped += 1;
  }

  return { today, lapsed, due: due.length, sent, failed, skipped };
}

/** One line for a log; never an address. */
export function describeDeadlineRun(run: DeadlineReminderRun): string {
  return (
    `[deadline-reminder] ${run.today}: deleted ${run.lapsed} past their date, ` +
    `${run.due} due, sent ${run.sent}, failed ${run.failed}, skipped ${run.skipped}`
  );
}
