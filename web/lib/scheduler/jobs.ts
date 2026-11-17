// web/lib/scheduler/jobs.ts
//
// The work the scheduler actually does. FW27 increment 4.
//
// ============================================================================
// A JOB THAT EXISTS ONLY AS A SCRIPT NOBODY RUNS
// ============================================================================
//
// FW14 wrote the thirty-day purge and left it as a function with a command,
// because pg-boss did not exist yet and said so. /confidentialite has promised
// since FW10 that an unconfirmed subscription is deleted after thirty days -
// and until this file, keeping that promise depended on somebody remembering
// to type `pnpm db:purge`.
//
// FW12 measured what that is worth in the same repository: `pnpm test:runtime`
// had not run since FW10, and "a guard that hasn't run since FW10 is a guard
// we don't have". This one has a regulator on the other end.
//
// ============================================================================
// A QUEUE IS NOT SCHEDULED UNLESS IT CAN DO ITS WORK (R205)
// ============================================================================
//
// The reminder queue is registered only when a push sender exists. With no
// credentials the alternative would be a job that runs every five minutes,
// finds everybody due, writes a claim row for each, discovers there is nowhere
// to deliver and releases it - producing load, log noise and a `sent` count of
// zero that looks identical to a healthy quiet day.
//
// So it is skipped, and the skip is REPORTED with the reason (R198) rather
// than being an absence somebody has to notice.

import type { PgBoss } from 'pg-boss';
import { describePurge, purgeUnconfirmed } from '@/lib/alerts/purge';
import { describeReminderPurge, purgeUnconfirmedReminders } from '@/lib/rappel/purge';
import { describeCodeAttemptSweep, purgeCodeAttempts } from '@/lib/auth/magic-link';
import { describePushSender, resolvePushSender } from '@/lib/push/resolve';
import type { EnvLike } from '@/lib/push/resolve';
import { DevicePushTransport } from '@/lib/push/transport';
import { describeRun, runDailyReminders } from '@/lib/reminders/job';
import { describeDeadlineRun, runDeadlineReminders } from '@/lib/rappel/job';
import { describeMailSender } from '@/lib/rappel/mail';
import { tagged } from '@/lib/scheduler/instance';

export const REMINDER_QUEUE = 'daily-reminder';
export const PURGE_QUEUE = 'purge-unconfirmed';
export const CODE_ATTEMPT_QUEUE = 'purge-code-attempts';
export const DEADLINE_QUEUE = 'deadline-reminder';

/**
 * Both expressions are read in Paris, because both are about a LOCAL day.
 *
 * A purge "after thirty days" and a reminder "at 17:30" are statements about
 * the reader's calendar, and a job evaluated in UTC drifts an hour twice a
 * year against the only clock anybody cares about here.
 */
export const SCHEDULE_TZ = 'Europe/Paris';

/**
 * Every five minutes.
 *
 * `reminderTime` is an arbitrary `HH:mm`, and the job sends to everybody whose
 * time has passed and who has not had today's. THE CADENCE IS PUNCTUALITY, NOT
 * CORRECTNESS - "exactly one per day" is the unique row in `ReminderSent` and
 * holds at any interval. Five minutes bounds how late a 17:30 reminder can be
 * at five minutes; one pass is a single indexed query.
 *
 * PARKED for FW28, which measures on the real image: whether five is the right
 * number is an operational question about a machine that does not exist yet.
 */
export const REMINDER_CRON = '*/5 * * * *';

/** Daily, at an unremarkable hour with nobody waiting on it. */
export const PURGE_CRON = '17 3 * * *';

/**
 * Hourly, and the hour is the point rather than a cadence somebody liked.
 *
 * /confidentialite says the attempt fingerprints are erased after twenty-four
 * hours. On the daily cron above, a row written at 04:00 would sit in the
 * table until 03:17 the day after next - forty-seven hours - and the sentence
 * would be false for most of a day. Hourly bounds it at twenty-five.
 *
 * It is cheap enough to say so: one indexed DELETE over a table that holds at
 * most a day of attempts.
 */
export const CODE_ATTEMPT_CRON = '23 * * * *';

/**
 * FW-DELAI-RAPPEL (R916): the deadline reminder's pass, hourly from 08:41 to
 * 20:41 in Paris. A reminder is due on a DAY, fourteen days before the date;
 * the first pass of that day sends it, and every later pass is a retry for a
 * send that failed. Daytime only, because a reminder about a deadline that
 * lands at 02:41 is buried under the morning's mail.
 */
export const DEADLINE_CRON = '41 8-20 * * *';

/**
 * THE QUEUE'S RETRY POLICY, STATED (R345's corollary: a default is a setting
 * nobody chose). A pass in which any send failed throws once it has tried
 * every due row; pg-boss then runs it again up to three times, ten minutes
 * apart, and the hourly schedule keeps trying after that until the date
 * passes. A retry re-reads the table, so a row already sent is never sent
 * twice - the delete is the claim (lib/rappel/job.ts).
 */
export const DEADLINE_RETRY = { retryLimit: 3, retryDelay: 600, retryBackoff: false } as const;

export interface JobRegistration {
  readonly scheduled: readonly string[];
  readonly skipped: readonly { readonly queue: string; readonly reason: string }[];
}

/**
 * Register every recurring job, and report which were skipped and why.
 *
 * `env` is a parameter so a test can present a configured or unconfigured
 * environment without setting one on the process, where it would outlive the
 * test file (R171).
 */
export async function registerJobs(
  boss: PgBoss,
  env: EnvLike = process.env,
  // FW-DELAI-RAPPEL: the moment the deadline pass runs AT, a parameter so a
  // test can place it (R171), as `env` is for the environment. The real
  // clock for every caller but a test.
  clock: () => Date = () => new Date(),
): Promise<JobRegistration> {
  const scheduled: string[] = [];
  const skipped: { queue: string; reason: string }[] = [];

  // ---------------------------------------------------------------------
  // The purge, which needs nothing but a database.
  // ---------------------------------------------------------------------
  await boss.createQueue(PURGE_QUEUE);

  await boss.work(PURGE_QUEUE, async () => {
    // R244: what it considered, what it removed, and why it kept the rest.
    console.log(tagged(describePurge(await purgeUnconfirmed())));

    // FW-DELAI-RAPPEL (R915): the deadline reminder's unconfirmed requests go
    // ON THE SAME PASS, so /confidentialite's thirty days are performed by the
    // job that performs the alert list's.
    console.log(tagged(describeReminderPurge(await purgeUnconfirmedReminders())));
  });

  // `once` rather than `skip`: a deployment that was down at 03:17 should
  // still purge when it comes back, because the promise is about how long a
  // row may live rather than about a particular minute.
  await boss.schedule(PURGE_QUEUE, PURGE_CRON, null, { tz: SCHEDULE_TZ, missed: 'once' });
  scheduled.push(PURGE_QUEUE);

  // ---------------------------------------------------------------------
  // The attempt-fingerprint sweep, which needs nothing but a database either.
  // ---------------------------------------------------------------------
  await boss.createQueue(CODE_ATTEMPT_QUEUE);

  await boss.work(CODE_ATTEMPT_QUEUE, async () => {
    console.log(tagged(describeCodeAttemptSweep(await purgeCodeAttempts())));
  });

  // `once`, like the purge above and for the same reason: the promise is about
  // how long a row may live, not about a particular minute.
  await boss.schedule(CODE_ATTEMPT_QUEUE, CODE_ATTEMPT_CRON, null, {
    tz: SCHEDULE_TZ,
    missed: 'once',
  });
  scheduled.push(CODE_ATTEMPT_QUEUE);

  // ---------------------------------------------------------------------
  // The reminder, which needs somewhere to send.
  // ---------------------------------------------------------------------
  const push = resolvePushSender(env);

  if (push.ok) {
    await registerDailyReminder(boss, new DevicePushTransport(push.sender));
    scheduled.push(REMINDER_QUEUE);
  } else {
    skipped.push({ queue: REMINDER_QUEUE, reason: describePushSender(push) });
  }

  // ---------------------------------------------------------------------
  // FW-DELAI-RAPPEL (R916): the deadline reminder, which needs a mail
  // sender. Registered after the daily reminder, so a skip of both reads in
  // that order.
  // ---------------------------------------------------------------------
  const mail = describeMailSender(env);

  if (!mail.ok) {
    skipped.push({ queue: DEADLINE_QUEUE, reason: mail.reason });

    return { scheduled, skipped };
  }

  await boss.createQueue(DEADLINE_QUEUE, DEADLINE_RETRY);

  await boss.work(DEADLINE_QUEUE, async () => {
    // R244: what it considered and did. Never an address in the line.
    const run = await runDeadlineReminders(clock());

    console.log(tagged(describeDeadlineRun(run)));

    // A failed send leaves its row; throwing hands the pass to the retry
    // policy above. Rows already sent were deleted, so a retry cannot repeat
    // them.
    if (run.failed > 0) throw new Error(`[deadline-reminder] ${run.failed} send(s) failed; the rows stay for a retry`);
  });

  // `once`: a deployment down at 08:41 still runs a pass when it comes back.
  // The payload is null - no address or date is ever copied into pg-boss.
  await boss.schedule(DEADLINE_QUEUE, DEADLINE_CRON, null, { tz: SCHEDULE_TZ, missed: 'once' });
  scheduled.push(DEADLINE_QUEUE);

  return { scheduled, skipped };
}

/** The daily push reminder, which needs somewhere to send. FW27, unchanged. */
async function registerDailyReminder(boss: PgBoss, transport: DevicePushTransport): Promise<void> {
  await boss.createQueue(REMINDER_QUEUE);

  await boss.work(REMINDER_QUEUE, async () => {
    // `new Date()` here and nowhere below it: the job's own module takes the
    // moment as a parameter so a test can place the clock (R171).
    //
    // AND THE RESULT IS PRINTED. This awaited and DISCARDED it until FW28,
    // so the pass that runs at 06:00 with nobody awake reported nothing at
    // all - while every skip reason R244 requires was computed and thrown
    // away. Tagged with the instance, because every replica runs its own
    // scheduler and two containers logging identical lines into one
    // aggregator is indistinguishable from one container restarting.
    console.log(tagged(describeRun(await runDailyReminders(new Date(), transport))));
  });

  // `skip` rather than `once`: the next pass is five minutes away, and a
  // backlog of missed reminder passes would all find the same people due and
  // race for the same claim rows to no purpose.
  await boss.schedule(REMINDER_QUEUE, REMINDER_CRON, null, { tz: SCHEDULE_TZ, missed: 'skip' });
}

/** One line for a log at boot, naming what will run and what will not. */
export function describeRegistration(registration: JobRegistration): string {
  const lines = [`[scheduler] scheduled: ${registration.scheduled.join(', ') || 'nothing'}`];

  for (const one of registration.skipped) {
    lines.push(`[scheduler] NOT scheduled: ${one.queue} - ${one.reason}`);
  }

  return lines.join('\n');
}
