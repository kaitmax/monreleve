// web/tests/db/scheduled-jobs.test.ts
//
// The jobs are registered, and one of them is driven through pg-boss.
// FW27 increment 4.
//
// ============================================================================
// R204: ONE TEST CROSSES THE WHOLE THING
// ============================================================================
//
// `purgeUnconfirmed` is proven by tests/db/purge.test.ts and `registerJobs` is
// proven below to store two schedules. Neither can tell you a job sent to the
// queue ever reaches the function - that path runs through pg-boss's own
// tables and workers, and nothing this repository owns would notice if the
// handler were registered on a queue nobody sends to.
//
// FW22 produced the instance: a sign-in email addressed a route that would not
// exist for three increments, with every unit test green.
//
// ============================================================================
// THE ORPHAN DISCIPLINE (R179)
// ============================================================================
//
// pg-boss holds connections and runs timers. Every test here stops what it
// started, and afterEach ASSERTS nothing survived rather than assuming it.

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { isSchedulerRunning, startScheduler, stopScheduler } from '@/lib/scheduler/boss';
import {
  PURGE_CRON,
  PURGE_QUEUE,
  REMINDER_CRON,
  REMINDER_QUEUE,
  SCHEDULE_TZ,
  describeRegistration,
  registerJobs,
} from '@/lib/scheduler/jobs';
import { PURGE_AFTER_DAYS } from '@/lib/alerts/purge';
import { register } from '@/instrumentation';
import type { EnvLike } from '@/lib/push/resolve';

const DAY_MS = 24 * 60 * 60 * 1000;

/** No credentials: the state of every machine that exists today (R243). */
const UNCONFIGURED: EnvLike = {};

/** The one environment that produces a push sender without credentials. */
const DEVELOPMENT: EnvLike = { NODE_ENV: 'development' };

/** The boss this file started, so afterEach can undo what it wrote. */
let running: Awaited<ReturnType<typeof startScheduler>> | null = null;

async function start(): Promise<NonNullable<typeof running>> {
  running = await startScheduler();

  return running;
}

beforeEach(async () => {
  await stopScheduler();
  await prisma.alertSubscriber.deleteMany();
});

afterEach(async () => {
  // ==========================================================================
  // R179 REACHES THE DATABASE, NOT ONLY THE PROCESS
  // ==========================================================================
  //
  // A schedule is a ROW. Stopping the scheduler leaves it there, and the next
  // thing in this repository to call startScheduler() - scheduler-start.test.ts
  // is one, `pnpm dev` is another - starts a timekeeper that reads it and
  // begins queueing jobs from a cron expression a TEST wrote.
  //
  // The purge is the one that would hurt: a queued purge picked up later by a
  // worker deletes unconfirmed AlertSubscriber rows, and tests/db/purge.test.ts
  // seeds rows at exactly 29 and 31 days to assert the boundary. That is a
  // flake with no visible cause, arriving in a different file from the one
  // that created it.
  if (running !== null) {
    for (const queue of [PURGE_QUEUE, REMINDER_QUEUE]) {
      await running.unschedule(queue).catch(() => undefined);
      await running.deleteAllJobs(queue).catch(() => undefined);
    }

    running = null;
  }

  await stopScheduler();

  expect(isSchedulerRunning(), 'a scheduler survived this test').toBe(false);
});

afterAll(async () => {
  await stopScheduler();
  await prisma.$disconnect();
});

describe('what gets registered', () => {
  it('schedules the purge, which needs nothing but a database', async () => {
    const boss = await start();

    const registration = await registerJobs(boss, UNCONFIGURED);

    expect(registration.scheduled).toContain(PURGE_QUEUE);

    const schedule = await boss.getSchedule(PURGE_QUEUE);

    expect(schedule?.cron).toBe(PURGE_CRON);
    // IN PARIS, because "thirty days" is a statement about the reader's
    // calendar and a UTC evaluation drifts an hour twice a year.
    expect(schedule?.timezone).toBe(SCHEDULE_TZ);
  });

  it('does NOT schedule the reminder with no push sender, and says why', async () => {
    // R205: a job that runs every five minutes, claims every due day and
    // discovers there is nowhere to deliver produces load, log noise and a
    // `sent` count of zero indistinguishable from a healthy quiet day.
    const boss = await start();

    const registration = await registerJobs(boss, UNCONFIGURED);

    expect(registration.scheduled).not.toContain(REMINDER_QUEUE);
    expect(await boss.getSchedule(REMINDER_QUEUE)).toBeNull();

    const [skip] = registration.skipped;

    expect(skip?.queue).toBe(REMINDER_QUEUE);
    expect(skip?.reason).toContain('not_configured');
  });

  it('DOES schedule the reminder once there is a sender', async () => {
    // R196's other direction, and it is what makes the test above mean
    // something: a registration that scheduled nothing would pass it.
    const boss = await start();

    const registration = await registerJobs(boss, DEVELOPMENT);

    expect(registration.scheduled).toEqual([PURGE_QUEUE, REMINDER_QUEUE]);
    expect(registration.skipped).toEqual([]);

    const schedule = await boss.getSchedule(REMINDER_QUEUE);

    expect(schedule?.cron).toBe(REMINDER_CRON);
  });

  it('is idempotent, because a restart calls it again', async () => {
    const boss = await start();

    await registerJobs(boss, DEVELOPMENT);

    const second = await registerJobs(boss, DEVELOPMENT);

    expect(second.scheduled).toEqual([PURGE_QUEUE, REMINDER_QUEUE]);
    expect(await boss.getSchedules()).toHaveLength(2);
  });

  it('names the skip in the line a log carries', () => {
    const described = describeRegistration({
      scheduled: [PURGE_QUEUE],
      skipped: [{ queue: REMINDER_QUEUE, reason: '[push] no push sender (not_configured)' }],
    });

    expect(described).toContain(`NOT scheduled: ${REMINDER_QUEUE}`);
    expect(described).toContain('not_configured');
  });
});

describe('R204: a job sent to the queue reaches the function', () => {
  it('purges a thirty-one-day row through pg-boss, not through a direct call', async () => {
    const boss = await start();

    await registerJobs(boss, UNCONFIGURED);

    await prisma.alertSubscriber.create({
      data: {
        email: 'lapsed@example.com',
        source: 'calculateur',
        confirmationTokenHash: 'a'.repeat(64),
        createdAt: new Date(Date.now() - (PURGE_AFTER_DAYS + 1) * DAY_MS),
      },
    });

    expect(await prisma.alertSubscriber.count()).toBe(1);

    await boss.send(PURGE_QUEUE, {});

    // Polled rather than slept: pg-boss fetches on its own interval, and a
    // fixed wait is either flaky or slow.
    const deadline = Date.now() + 8000;
    let remaining = 1;

    while (Date.now() < deadline && remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));

      remaining = await prisma.alertSubscriber.count();
    }

    expect(remaining, 'the queued purge never reached purgeUnconfirmed').toBe(0);
  });
});

describe('R204: instrumentation.ts is the entry point, and it is DRIVEN here', () => {
  it('starts the scheduler and registers the purge, through register() itself', async () => {
    // ========================================================================
    // THIS IMPORT IS ALSO WHAT PUTS THE FILE IN THE GATE'S SELECTION
    // ========================================================================
    //
    // R132's database rule is derived from the import graph reachable FROM
    // tests/db/**, and instrumentation.ts is imported by NOTHING - Next calls
    // it by convention. Before this line it matched no rule at all, so a
    // commit changing the ONLY caller of startScheduler() would have run
    // typecheck, lint, test and build and NOT these tests.
    //
    // Importing it here closes that by MECHANISM. The alternative - a fourth
    // path prefix in the rule - is the list the rule's own header was written
    // to replace, having already been extended three times (R149's signal).
    //
    // Half of it was covered by accident: `build` always runs, and the one
    // defect this file has ever had was an Edge-bundling failure that only a
    // build could see. The half that was not covered is whether it WORKS.
    process.env.NEXT_RUNTIME = 'nodejs';

    try {
      // IT NEVER THROWS, which is its whole contract: register() runs before
      // the server accepts requests, so an exception here takes the
      // application down and leaves a reader unable to open their dossier.
      await register();

      expect(isSchedulerRunning()).toBe(true);

      // The same instance, because of the globalThis guard - and tracking it
      // is what lets afterEach undo the rows this wrote.
      const boss = await start();

      expect(await boss.getSchedule(PURGE_QUEUE)).not.toBeNull();

      // AND THE REMINDER IS NOT SCHEDULED. NODE_ENV is `test` here, so
      // resolvePushSender refuses and registerJobs skips it - which is R243
      // asserted at the entry point rather than one module down.
      expect(await boss.getSchedule(REMINDER_QUEUE)).toBeNull();
    } finally {
      delete process.env.NEXT_RUNTIME;
    }
  });

  it('does nothing at all outside the Node runtime', async () => {
    // The Edge bundle cannot resolve what pg-boss reaches through pg, and the
    // guard that keeps it out is a build-time constant in an `if`. This is
    // the runtime half of the same statement.
    delete process.env.NEXT_RUNTIME;

    await register();

    expect(isSchedulerRunning()).toBe(false);
  });
});
