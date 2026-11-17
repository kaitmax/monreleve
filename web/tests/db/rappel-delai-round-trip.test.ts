// web/tests/db/rappel-delai-round-trip.test.ts
//
// FW-DELAI-RAPPEL, R920 / R204: THE WHOLE PATH, THROUGH THE REAL ENTRY POINTS.
//
//   submit (the POST route the island calls)
//     -> the confirmation in the fake outbox
//       -> its link, fired at the confirm route
//         -> the job, fired THROUGH pg-boss at its time (a placed clock)
//           -> the reminder in the outbox
//             -> the table, read, and empty.
//
// Every unit below is tested on its own elsewhere; this is the one test that
// crosses all of them, so a link pointing at nothing, a queue registered with
// the wrong worker, or a pass that sends without deleting fails HERE (FW22's
// sign-in link addressed a route that did not exist for three increments,
// with every unit test green).

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { TEST_ORIGIN } from '../../lib/content/identity';
import { POST } from '@/app/api/rappel-delai/route';
import { GET as CONFIRM } from '@/app/api/rappel-delai/confirm/route';
import { prisma } from '@/lib/db/client';
import { siteOrigin } from '@/lib/content/site';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { RAPPEL_COPY } from '@/lib/fr/rappel';
import { parisDayOf } from '@/lib/entries/day';
import { LANDING_STATES, landingFor } from '@/lib/rappel/landing';
import { CONFIRM_PATH } from '@/lib/rappel/mail';
import { isSchedulerRunning, startScheduler, stopScheduler } from '@/lib/scheduler/boss';
import {
  CODE_ATTEMPT_QUEUE,
  DEADLINE_QUEUE,
  PURGE_QUEUE,
  REMINDER_QUEUE,
  registerJobs,
} from '@/lib/scheduler/jobs';
import { reminderDay, shiftDays } from '@/lib/rappel/window';
import type { EnvLike } from '@/lib/push/resolve';

const EMAIL = 'aller-retour@monreleve.test';

/** The one environment with a mail sender and no credentials (the outbox). */
const DEVELOPMENT: EnvLike = { NODE_ENV: 'development' };

const QUEUES = [PURGE_QUEUE, CODE_ATTEMPT_QUEUE, REMINDER_QUEUE, DEADLINE_QUEUE];

let running: Awaited<ReturnType<typeof startScheduler>> | null = null;

/** The clock the registered worker reads; the test places it. */
let placed = new Date();

beforeEach(async () => {
  await stopScheduler();
  await prisma.deadlineReminder.deleteMany();
  clearOutbox();
  resetRateLimit();
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

describe('R920: submit -> confirm -> the job at its time -> the reminder -> nothing kept', () => {
  it('drives the whole path through the route handlers and pg-boss', async () => {
    const deadline = shiftDays(parisDayOf(new Date()), 120) ?? '';

    // 1. The island's POST: the address and the computed date.
    const answer = (await (
      await POST(
        new NextRequest(`${TEST_ORIGIN}/api/rappel-delai`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '10.9.9.9' },
          body: new URLSearchParams({ email: EMAIL, date: deadline }).toString(),
        }),
      )
    ).json()) as { status: string };

    expect(answer.status).toBe('ok');

    // 2. The confirmation, out of the outbox.
    const confirmation = readOutbox().at(-1);

    expect(confirmation?.subject).toBe(RAPPEL_COPY.confirmation.subject);

    const link =
      (confirmation?.text ?? '').split('\n').find((line) => line.startsWith(`${siteOrigin()}${CONFIRM_PATH}?token=`)) ?? '';

    // 3. Its link, through the confirm route.
    const confirmed = await CONFIRM(new NextRequest(link));

    expect(confirmed.headers.get('location')).toBe(landingFor(LANDING_STATES.confirmed));

    // 4. The job, through pg-boss, on the due day (the placed clock).
    running = await startScheduler();

    const registration = await registerJobs(running, DEVELOPMENT, () => placed);

    expect(registration.scheduled).toContain(DEADLINE_QUEUE);

    placed = new Date(`${reminderDay(deadline) ?? ''}T11:00:00Z`);
    clearOutbox();

    await running.send(DEADLINE_QUEUE, null);

    const until = Date.now() + 8000;

    // The message is collected INSIDE the transaction that deletes the row, a
    // moment before it commits - so the wait is for both, not the first.
    while (Date.now() < until && (readOutbox().length === 0 || (await prisma.deadlineReminder.count()) !== 0)) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    // 5. The reminder, in the outbox.
    const reminder = readOutbox().at(-1);

    expect(reminder, 'the queued job never reached the reminder pass').toBeDefined();
    expect(reminder?.to).toBe(EMAIL);
    expect(reminder?.subject).toBe(RAPPEL_COPY.reminder.subject(deadline));

    // 6. And nothing kept: the table, read, is empty.
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });
});
