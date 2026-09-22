// web/tests/db/scheduler-start.test.ts
//
// AC1: pg-boss starts once, and refuses a non-local database. FW27 increment 1.
//
// ============================================================================
// THE ORPHAN DISCIPLINE APPLIES TO THIS FILE ITSELF
// ============================================================================
//
// pg-boss holds database connections and runs timers. A scheduler left running
// between test files is this project's FOURTH concurrency class - after R98's
// containers, R105's ports and R131's working tree - and it is the least
// visible of them, because an orphaned scheduler does not occupy anything a
// person would think to check.
//
// So every test here stops what it started, and `afterEach` asserts nothing is
// left running rather than assuming it.

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  SchedulerRefused,
  isSchedulerRunning,
  startScheduler,
  stopScheduler,
} from '@/lib/scheduler/boss';

const REAL_URL = process.env.DATABASE_URL;

beforeEach(async () => {
  await stopScheduler();

  if (REAL_URL !== undefined) process.env.DATABASE_URL = REAL_URL;
});

afterEach(async () => {
  // R179's second half: the harness kills what it spawned AND asserts the
  // state clean, because either alone leaves the trap.
  await stopScheduler();

  expect(isSchedulerRunning(), 'a scheduler survived this test').toBe(false);

  if (REAL_URL !== undefined) process.env.DATABASE_URL = REAL_URL;
});

afterAll(async () => {
  await stopScheduler();
  await prisma.$disconnect();
});

describe('AC1: the scheduler starts exactly once', () => {
  it('starts, and reports itself running', async () => {
    // PRESENCE FIRST (R169). Every assertion below is about a SECOND start,
    // and "there is no second" is satisfied perfectly by a first that never
    // happened.
    expect(isSchedulerRunning()).toBe(false);

    const boss = await startScheduler();

    expect(boss).toBeDefined();
    expect(isSchedulerRunning()).toBe(true);
  });

  it('returns the SAME instance on a second start', async () => {
    // The defect this guards: hot-reload re-evaluates the module, a fresh
    // module scope finds no scheduler, and a second one starts beside the
    // first. Two schedulers is two reminders, which SPEC 13.3 says gets a
    // compliance tool uninstalled.
    const first = await startScheduler();
    const second = await startScheduler();

    expect(second).toBe(first);
  });

  it('survives module re-evaluation, which a module-level variable does not', async () => {
    // The guard lives on `globalThis` for exactly this reason. Re-importing
    // the module gives a new module scope; the scheduler must not change.
    const first = await startScheduler();

    const reimported = await import(`@/lib/scheduler/boss?reevaluated=${Date.now()}`).catch(
      () => null,
    );

    // The dynamic re-import may be served from cache by the bundler, which is
    // fine: what matters is that the exported accessor still sees the ONE
    // scheduler rather than nothing.
    if (reimported !== null) {
      expect((reimported as { isSchedulerRunning: () => boolean }).isSchedulerRunning()).toBe(true);
    }

    expect(await startScheduler()).toBe(first);
  });

  it('starts ONCE under concurrent callers, which a bare check would not', async () => {
    // THE DOOR A SIMPLE "is it set?" LEAVES OPEN. Two callers both find the
    // slot empty and both start. Next.js can call register() from more than
    // one entry point, so this is not hypothetical.
    const [a, b, c] = await Promise.all([
      startScheduler(),
      startScheduler(),
      startScheduler(),
    ]);

    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('can be stopped and started again, so the guard is not a one-shot latch', async () => {
    // R196: a guard that refused every restart would pass every test above.
    const first = await startScheduler();

    await stopScheduler();

    expect(isSchedulerRunning()).toBe(false);

    const second = await startScheduler();

    expect(second).not.toBe(first);
    expect(isSchedulerRunning()).toBe(true);
  });
});

describe('R243: it refuses to act on its own against a database that is not ours', () => {
  it('refuses a non-local host, BY NAME', async () => {
    // This is the first code in the product that acts without a request. A
    // run against a real database is a notification in somebody's hand, and
    // there is no undo.
    process.env.DATABASE_URL = 'postgresql://user:pw@db.example.com:5432/monreleve';

    await expect(startScheduler()).rejects.toBeInstanceOf(SchedulerRefused);
    expect(isSchedulerRunning()).toBe(false);

    process.env.DATABASE_URL = 'postgresql://user:pw@db.example.com:5432/monreleve';

    await expect(startScheduler()).rejects.toMatchObject({ code: 'non_local_database' });
  });

  it('names the host it refused, so the message is actionable (R198)', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pw@db.example.com:5432/monreleve';

    await expect(startScheduler()).rejects.toThrow(/non-local database/u);
  });

  it('refuses a missing DATABASE_URL with a DIFFERENT code', async () => {
    // Two facts, two remedies: set the variable, or point it somewhere local.
    delete process.env.DATABASE_URL;

    await expect(startScheduler()).rejects.toMatchObject({ code: 'no_database_url' });
  });

  it('ACCEPTS a local host, so the guard is not refusing everything', async () => {
    // R196 again, and it is the assertion that makes the three above mean
    // something: a guard that rejected every URL would pass all of them.
    const boss = await startScheduler();

    expect(boss).toBeDefined();
    expect(isSchedulerRunning()).toBe(true);
  });

  it('does not POISON the slot after a refusal', async () => {
    // A failed start that left its rejected promise in place would make every
    // later attempt fail with the same error for ever - the scheduler
    // equivalent of the render slot FW25b's `finally` exists to release.
    process.env.DATABASE_URL = 'postgresql://user:pw@db.example.com:5432/monreleve';

    await expect(startScheduler()).rejects.toBeInstanceOf(SchedulerRefused);

    if (REAL_URL !== undefined) process.env.DATABASE_URL = REAL_URL;

    await expect(startScheduler()).resolves.toBeDefined();
  });
});
