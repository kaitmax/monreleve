// web/tests/db/rappel-delai-jobs.test.ts
//
// FW-DELAI-RAPPEL: the reminder's work, THROUGH pg-boss (R204) - a job sent to
// the queue reaches the function, rather than the function being called. The
// shape and the cleanup are tests/db/scheduled-jobs.test.ts's: a schedule is
// a ROW, so every queue this file's registration creates is unscheduled and
// emptied afterwards (R179 reaches the database).

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { stopScheduler, startScheduler, isSchedulerRunning } from '@/lib/scheduler/boss';
import {
  CODE_ATTEMPT_QUEUE,
  DEADLINE_CRON,
  DEADLINE_QUEUE,
  DEADLINE_RETRY,
  PURGE_QUEUE,
  REMINDER_QUEUE,
  SCHEDULE_TZ,
  registerJobs,
} from '@/lib/scheduler/jobs';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { PURGE_AFTER_DAYS } from '@/lib/alerts/lifetimes';
import { hashToken } from '@/lib/alerts/token';
import { parisDayOf, toStoredDay } from '@/lib/entries/day';
import { reminderDay, shiftDays } from '@/lib/rappel/window';
import type { EnvLike } from '@/lib/push/resolve';

const DAY_MS = 24 * 60 * 60 * 1000;

/** No credentials: the state of every machine that exists today (R243). */
const UNCONFIGURED: EnvLike = {};

/** The one environment with a mail sender and no credentials: the printed outbox. */
const DEVELOPMENT: EnvLike = { NODE_ENV: 'development' };

/** Every queue a registration can create; afterEach clears each one. */
const QUEUES = [PURGE_QUEUE, CODE_ATTEMPT_QUEUE, REMINDER_QUEUE, DEADLINE_QUEUE];

let running: Awaited<ReturnType<typeof startScheduler>> | null = null;

beforeEach(async () => {
  await stopScheduler();
  await prisma.deadlineReminder.deleteMany();
  clearOutbox();
});

afterEach(async () => {
  if (running !== null) {
    for (const queue of QUEUES) {
      await running.unschedule(queue).catch(() => undefined);
      await running.deleteAllJobs(queue).catch(() => undefined);
    }

    running = null;
  }

  await stopScheduler();
  clearOutbox();

  expect(isSchedulerRunning(), 'a scheduler survived this test').toBe(false);
});

afterAll(async () => {
  await stopScheduler();
  await prisma.deadlineReminder.deleteMany();
  await prisma.$disconnect();
});

/** Poll until `count()` reaches `target` or eight seconds pass. */
async function until(count: () => Promise<number>, target: number): Promise<number> {
  const deadline = Date.now() + 8000;
  let current = await count();

  while (Date.now() < deadline && current !== target) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    current = await count();
  }

  return current;
}

describe("R915 / R204: the alert flow's purge pass also purges unconfirmed reminder requests", () => {
  it('deletes a thirty-one-day unconfirmed request through pg-boss, not through a direct call', async () => {
    running = await startScheduler();
    await registerJobs(running, UNCONFIGURED);

    await prisma.deadlineReminder.create({
      data: {
        email: 'lapsed@monreleve.test',
        deadline: toStoredDay(shiftDays(parisDayOf(new Date()), 200) ?? ''),
        confirmationTokenHash: hashToken('lapsed'),
        confirmationExpiresAt: new Date(),
        deleteTokenHashes: [hashToken('delete:lapsed')],
        createdAt: new Date(Date.now() - (PURGE_AFTER_DAYS + 1) * DAY_MS),
      },
    });

    await running.send(PURGE_QUEUE, {});

    expect(
      await until(() => prisma.deadlineReminder.count(), 0),
      'the queued purge never reached purgeUnconfirmedReminders',
    ).toBe(0);
  });
});

describe('R916: the deadline reminder is a queue in the existing scheduler', () => {
  it('is scheduled hourly in the daytime, Paris, with its retry policy STATED, and a null payload', async () => {
    running = await startScheduler();

    const registration = await registerJobs(running, DEVELOPMENT);

    expect(registration.scheduled).toContain(DEADLINE_QUEUE);

    const schedule = await running.getSchedule(DEADLINE_QUEUE);

    expect(schedule?.cron).toBe(DEADLINE_CRON);
    expect(schedule?.timezone).toBe(SCHEDULE_TZ);
    // No address or date is ever copied into pg-boss: the payload is null.
    expect(schedule?.data ?? null).toBeNull();

    const queue = await running.getQueue(DEADLINE_QUEUE);

    // R345's corollary: the policy is a value set and asserted, never a default.
    expect(queue?.retryLimit).toBe(DEADLINE_RETRY.retryLimit);
    expect(queue?.retryDelay).toBe(DEADLINE_RETRY.retryDelay);
    expect(queue?.retryBackoff).toBe(DEADLINE_RETRY.retryBackoff);
  });

  it('is NOT scheduled without a mail sender, and says why (R205, R198)', async () => {
    running = await startScheduler();

    const registration = await registerJobs(running, UNCONFIGURED);

    expect(registration.scheduled).not.toContain(DEADLINE_QUEUE);
    expect(await running.getSchedule(DEADLINE_QUEUE)).toBeNull();

    const skip = registration.skipped.find((one) => one.queue === DEADLINE_QUEUE);

    expect(skip?.reason).toContain('not_configured');
  });

  it('R204: a job sent to the queue reaches the pass, at the placed clock, and sends and deletes', async () => {
    const deadline = shiftDays(parisDayOf(new Date()), 120) ?? '';
    const dueNoon = new Date(`${reminderDay(deadline) ?? ''}T11:00:00Z`);

    await prisma.deadlineReminder.create({
      data: {
        email: 'due@monreleve.test',
        deadline: toStoredDay(deadline),
        confirmedAt: new Date(),
        deleteTokenHashes: [hashToken('delete:due')],
      },
    });

    running = await startScheduler();
    await registerJobs(running, DEVELOPMENT, () => dueNoon);

    await running.send(DEADLINE_QUEUE, null);

    expect(await until(() => prisma.deadlineReminder.count(), 0), 'the queued pass never deleted the row').toBe(0);
    expect(readOutbox().map((message) => message.to)).toEqual(['due@monreleve.test']);
  });
});
