// web/lib/reminders/job.ts
//
// The daily reminder. FW27 increment 2, extended by 3.
//
// ============================================================================
// EXACTLY ONE PER DAY, AND THE DATABASE IS WHAT GUARANTEES IT
// ============================================================================
//
// SPEC §13.3: one reminder, only if today is unconfirmed, opt-in, and "a
// compliance tool that nags gets uninstalled" - so no second reminder, no
// digest, no streak.
//
// IDEMPOTENCY IS A UNIQUE ROW, not a set in memory. A scheduler retries, and
// the thing that caused the retry is often the thing that lost the memory: a
// restart, a crash, a second worker. `ReminderSent` has a unique index on
// (userId, sentOn), and the insert is what claims the day.
//
// THE ORDER MATTERS AND IS THE WHOLE DESIGN. The row is inserted BEFORE the
// send, not after:
//
//   insert-then-send  a crash between them means one MISSED reminder
//   send-then-insert  a crash between them means one DUPLICATE tomorrow,
//                     and on every retry until the insert succeeds
//
// Both lose. SPEC decides which: a tool that nags gets uninstalled, so a
// missed reminder is the cheaper failure and the one this code chooses. When
// the send then fails, the row is REMOVED again so the next run retries - the
// window where a crash loses a reminder is the few milliseconds between the
// insert and the failure, rather than the whole delivery.
//
// ============================================================================
// R244: IT REPORTS WHAT IT DID, NOT THAT IT RAN
// ============================================================================
//
// Nobody is watching when this runs. "Reminders sent" is indistinguishable
// from a run whose query matched nobody, so every run returns counts: how many
// were considered, how many were sent, and how many were skipped for each
// reason.

import { prisma } from '@/lib/db/client';
import { parisDayOf, parisTimeOf, toStoredDay } from '@/lib/entries/day';
import type { ReminderTransport } from '@/lib/reminders/transport';

/** What one run did. Every field is a number somebody could act on. */
/**
 * What a run did, as one line.
 *
 * ============================================================================
 * THE COUNTS EXISTED AND NOTHING PRINTED THEM
 * ============================================================================
 *
 * This file's own header says "Nobody is watching when this runs. 'Reminders
 * sent' is indistinguishable from 'reminders not sent'" - and that is exactly
 * what the SCHEDULED path did: lib/scheduler/jobs.ts awaited
 * runDailyReminders() and discarded the result. Every skip reason R244 asks
 * for was computed and thrown away.
 *
 * FW28 found it by running two containers and having nothing to read. The
 * figures FW27's walkthrough recorded came from driving the job BY HAND,
 * which is a different code path from the one that runs at 06:00 with nobody
 * awake - the same shape as R176's distinction between a smoke check and a
 * walkthrough.
 *
 * EVERY REASON IS NAMED, INCLUDING THE ZEROES. "sent: 0" alone is ambiguous
 * between "nobody was due", "everybody already had theirs" and "the query is
 * broken", and those send a reader to three different places.
 */
export function describeRun(run: ReminderRun): string {
  return [
    `[scheduler] reminders ${run.day} at ${run.parisTime}:`,
    `considered ${run.considered},`,
    `sent ${run.sent},`,
    `skipped ${run.skippedAlreadySent} already-sent,`,
    `${run.skippedDayLogged} day-logged,`,
    `${run.skippedNoDevice} no-device,`,
    `${run.failed} failed`,
  ].join(' ');
}

export interface ReminderRun {
  readonly day: string;
  readonly parisTime: string;
  readonly considered: number;
  readonly sent: number;
  readonly skippedAlreadySent: number;
  readonly skippedDayLogged: number;
  /**
   * Due, and nowhere to deliver: reminders on, no registered device.
   *
   * SEPARATE FROM `failed` BECAUSE RETRYING CANNOT FIX IT, and separate from
   * `sent` because nobody received anything. A number growing here is an
   * operational fact - people who asked for reminders and are not getting them
   * - and folding it into either neighbour would hide it in a number that is
   * expected to be non-zero.
   */
  readonly skippedNoDevice: number;
  readonly failed: number;
}

/**
 * Send today's reminders, to everybody who is due one and has not had it.
 *
 * `now` is a parameter rather than `new Date()` so a test can place the clock
 * at 17:29 and at 17:31 without waiting two minutes (R171: the role is "the
 * moment this run represents", and it is read rather than assumed).
 */
export async function runDailyReminders(
  now: Date,
  transport: ReminderTransport,
): Promise<ReminderRun> {
  const day = parisDayOf(now);
  const parisTime = parisTimeOf(now);
  const stored = toStoredDay(day);

  // DUE MEANS: opted in, and their chosen time has passed in Paris today.
  // The comparison is lexicographic on `HH:mm`, which is valid only because
  // both sides are zero-padded - see `parisTimeOf`.
  const due = await prisma.user.findMany({
    where: { reminderEnabled: true, reminderTime: { lte: parisTime } },
    select: { id: true, loggingMode: true },
  });

  let sent = 0;
  let skippedAlreadySent = 0;
  let skippedDayLogged = 0;
  let skippedNoDevice = 0;
  let failed = 0;

  for (const user of due) {
    // ALREADY LOGGED: the reminder exists to ask for a day that is missing.
    // A person who filled it in at lunchtime is not nagged at half past five.
    const logged = await prisma.entry.count({
      where: { userId: user.id, dayDate: stored },
    });

    if (logged > 0) {
      skippedDayLogged += 1;

      continue;
    }

    // CLAIM THE DAY FIRST. The unique index is the guarantee; this insert is
    // where a retry loses. `create` rather than `upsert` deliberately - an
    // upsert would succeed on the second run and send again.
    try {
      await prisma.reminderSent.create({ data: { userId: user.id, sentOn: stored } });
    } catch {
      // The only way this fails is the unique constraint, which means another
      // run - or this one, retried - already has this day.
      skippedAlreadySent += 1;

      continue;
    }

    try {
      const delivery = await transport.send({ userId: user.id, day, mode: user.loggingMode });

      // NOWHERE TO DELIVER. The claim is released so that registering a device
      // later the same day still earns today's reminder - and it is NOT
      // counted as sent, because nobody received anything.
      if (delivery.devices === 0) {
        await prisma.reminderSent.deleteMany({ where: { userId: user.id, sentOn: stored } });

        skippedNoDevice += 1;

        continue;
      }

      sent += 1;
    } catch (cause) {
      // THE CLAIM IS RELEASED so the next run can try again. Without this a
      // failed delivery would silently consume the person's one reminder for
      // the day - which is worse than either failure mode the header weighs,
      // because nothing would record that they never got it.
      await prisma.reminderSent.deleteMany({ where: { userId: user.id, sentOn: stored } });

      failed += 1;

      console.error(
        `[reminders] delivery failed for ${user.id} on ${day}:`,
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  }

  const run: ReminderRun = {
    day,
    parisTime,
    considered: due.length,
    sent,
    skippedAlreadySent,
    skippedDayLogged,
    skippedNoDevice,
    failed,
  };

  // R244. A log line saying "completed" would be true of a run that matched
  // nobody because its query was wrong, and nobody is watching to notice.
  console.log(
    `[reminders] ${day} ${parisTime}: considered ${run.considered}, sent ${run.sent}, ` +
      `skipped ${run.skippedAlreadySent} already-sent, ${run.skippedDayLogged} logged and ` +
      `${run.skippedNoDevice} with no device, failed ${run.failed}`,
  );

  return run;
}
