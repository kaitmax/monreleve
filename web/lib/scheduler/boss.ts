// web/lib/scheduler/boss.ts
//
// pg-boss, started exactly once. FW27 increment 1.
//
// ============================================================================
// WHY ONCE IS THE WHOLE PROBLEM
// ============================================================================
//
// SPEC §3: "started once in `instrumentation.ts` behind a `globalThis` guard
// so hot-reload and multiple workers don't duplicate the scheduler", and
// SPEC §17 repeats it: "otherwise dev hot-reload and multiple workers
// duplicate the reminder scheduler".
//
// A module-level `let` is not enough. Next.js hot-reload re-evaluates a module
// and hands the new copy a fresh module scope, so the old scheduler keeps its
// connections and its timers while the new one starts beside it. The symptom
// is two reminders, which is the one thing SPEC §13.3 says gets a compliance
// tool uninstalled.
//
// `globalThis` survives module re-evaluation. It is the only scope that does.
//
// ============================================================================
// R243: IT REFUSES A NON-LOCAL DATABASE
// ============================================================================
//
// This is the first code in the product that acts WITHOUT A REQUEST. Every
// other path waits for somebody to call it; a scheduler wakes up on its own
// and sends. A test that accidentally delivers is not a failing test - it is
// an email or a push in somebody's hand, and there is no undo.
//
// So it refuses to start against anything but a database on this machine, and
// says which host it refused (R198). FW28 owns production scheduling and will
// have to lift this deliberately, which is the point: the lifting should be a
// visible act in a deployment task, not an absence nobody noticed.

// A NAMED IMPORT. pg-boss 12 has no default export: `import PgBoss from
// 'pg-boss'` compiles under some module settings and fails under this one.
// The typecheck caught it before a single test ran.
import { PgBoss } from 'pg-boss';
import { isLocalDatabase } from '@/lib/db/local-host';

/** Why a start was refused, so a caller can say which rule fired (R198). */
export type SchedulerRefusal = 'no_database_url' | 'non_local_database';

export class SchedulerRefused extends Error {
  readonly code: SchedulerRefusal;

  constructor(code: SchedulerRefusal, message: string) {
    super(message);
    this.name = 'SchedulerRefused';
    this.code = code;
  }
}

/**
 * The one scheduler, on `globalThis` so hot-reload cannot make a second.
 *
 * Typed rather than cast at each use, because a `globalThis` property is
 * exactly the kind of thing that acquires an `any` and then a second shape.
 */
interface SchedulerGlobal {
  __monreleveBoss?: PgBoss;
  __monreleveBossStarting?: Promise<PgBoss>;
}

const store = globalThis as unknown as SchedulerGlobal;

/** Whether a scheduler is already running in this process. */
export function isSchedulerRunning(): boolean {
  return store.__monreleveBoss !== undefined;
}

/**
 * Start the scheduler, or return the one already running.
 *
 * THE IN-FLIGHT PROMISE IS PART OF THE GUARD, not an optimisation. Two
 * concurrent callers would otherwise both find `__monreleveBoss` undefined and
 * both start - which is the double-scheduler this whole module exists to
 * prevent, arriving through the one door a simple "is it set?" check leaves
 * open. Next.js can call `register()` from more than one entry point.
 */
export async function startScheduler(): Promise<PgBoss> {
  if (store.__monreleveBoss !== undefined) return store.__monreleveBoss;
  if (store.__monreleveBossStarting !== undefined) return store.__monreleveBossStarting;

  const url = process.env.DATABASE_URL;

  if (url === undefined || url === '') {
    throw new SchedulerRefused(
      'no_database_url',
      'the scheduler needs DATABASE_URL; copy web/.env.example to web/.env.',
    );
  }

  // ==========================================================================
  // R243 IS LIFTED BY A MARKER, NOT BY DELETING THE CHECK (FW28)
  // ==========================================================================
  //
  // The refusal exists because this process sends reminders WITHOUT BEING
  // ASKED, and a run against a real database is a notification in somebody's
  // hand with no undo. That hazard does not go away because the product is
  // deployable now - it is exactly as real for a developer who points
  // DATABASE_URL at production for ten minutes to debug something.
  //
  // So the check stays and gains one door: FRONTALIER_SCHEDULER=1, which a
  // DEPLOYMENT sets and nothing else does.
  //
  // THE IMAGE DELIBERATELY DOES NOT SET IT. web/Dockerfile sets HOSTNAME, TZ
  // and FRONTALIER_RUNTIME because those are properties of being
  // containerised; sending reminders is a property of being THE deployment,
  // and `docker run monreleve` by hand must not start notifying people. The
  // marker is supplied where the database URL is, by whoever decided this
  // container is the one that serves.
  //
  // WHY NOT REUSE FRONTALIER_RUNTIME: it is set by the image and by
  // playwright.runtime.config.ts, so keying on it would make the R81 guard
  // suite a reminder sender.
  if (!isLocalDatabase(url) && process.env.FRONTALIER_SCHEDULER !== '1') {
    throw new SchedulerRefused(
      'non_local_database',
      `Refusing to start the scheduler against a non-local database. This ` +
        'process sends reminders without being asked, and a run against a ' +
        'real database is a notification in somebody’s hand with no undo ' +
        '(R243). A deployment that intends to send sets ' +
        'FRONTALIER_SCHEDULER=1; the image does not set it, so a container ' +
        'run by hand stays quiet.',
    );
  }

  const starting = (async () => {
    const boss = new PgBoss({ connectionString: url });

    // A scheduler that dies silently is worse than one that never started:
    // the reminders simply stop, and nobody is watching (R244's reasoning,
    // one layer down).
    boss.on('error', (error: unknown) => {
      console.error('[scheduler] pg-boss error:', error);
    });

    await boss.start();

    store.__monreleveBoss = boss;
    store.__monreleveBossStarting = undefined;

    return boss;
  })();

  store.__monreleveBossStarting = starting;

  try {
    return await starting;
  } catch (cause) {
    // A FAILED START MUST NOT POISON THE SLOT. Leaving the rejected promise in
    // place would make every later attempt return the same failure forever -
    // the scheduler equivalent of the render-queue slot FW25b's `finally`
    // exists to release.
    store.__monreleveBossStarting = undefined;

    throw cause;
  }
}

/**
 * Stop the scheduler and forget it.
 *
 * R179's shape for a process rather than a port: a harness that starts one
 * must be able to end it, and a scheduler surviving between test files is this
 * project's fourth concurrency class - after containers, ports and the working
 * tree. pg-boss holds database connections, so an orphan is not merely idle.
 */
export async function stopScheduler(): Promise<void> {
  const boss = store.__monreleveBoss;

  store.__monreleveBoss = undefined;
  store.__monreleveBossStarting = undefined;

  if (boss === undefined) return;

  // `graceful` lets in-flight handlers finish; pg-boss 12 has no `wait`
  // option, and `stop()` resolves once the pool is closed.
  await boss.stop({ graceful: true });
}
