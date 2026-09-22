// web/lib/export/render-queue.ts
//
// One render at a time, with a bounded waiting room. FW25b increment 2.
//
// ============================================================================
// THE NUMBER THAT SETS THIS: ONE RENDER PEAKS AT 280 MB
// ============================================================================
//
// MEASURED, not estimated: 279.9 MB resident across 4 processes, sampled every
// 200 ms while this route printed a year through `pnpm dev` on this machine.
// The browser is a tree, not a process - the 4 are the shell plus its renderer
// and GPU children, and summing only the parent would have under-reported it.
//
// SPEC D1 puts this product on ONE small VPS, beside Postgres and the Next.js
// server itself. So two concurrent renders is not a performance question; it is
// the difference between a document and an OOM kill, and an OOM kill takes the
// database connection pool with it.
//
// THE FIRST MEASUREMENT SAID 0 MB and was wrong in a way worth recording: it
// matched processes named `chrome`, and Playwright 1.63 runs headless through
// `headless_shell.exe`. 340 samples found nothing and reported zero, which
// reads exactly like a result. The sampler now matches on the executable PATH
// and reports whether it saw the browser at all - R133's positive signal, on a
// measurement rather than on a test.
//
// Two concurrent renders is therefore not a performance question. It is the
// difference between a document and an OOM kill, and an OOM kill takes the
// database connection pool with it.
//
// ============================================================================
// WHY THE QUEUE IS BOUNDED, WHICH IS THE PART THAT IS EASY TO SKIP
// ============================================================================
//
// A mutex alone converts concurrency into LATENCY. That sounds like the safe
// failure until you follow it: each waiting request holds its connection, its
// request context and its already-computed dossier payload, so the queue is
// itself a memory cost. Under sustained load the machine runs out of memory
// anyway - later than it would have, and with a symptom that points at the
// wrong subsystem.
//
// So the waiting room has a size and a deadline, and exceeding either is
// answered by NAME (R198). A 503 that says "busy, try again" is something a
// client can act on; a request that hangs for four minutes and dies is not.

/**
 * How many may WAIT while one renders.
 *
 * Two, deliberately small. It is a person exporting their own year, not a
 * public endpoint: the realistic burst is one impatient reader pressing the
 * button twice and a second household member doing the same.
 */
export const MAX_QUEUED = 2;

/**
 * How long a queued request will wait before giving up.
 *
 * Longer than two renders, shorter than any reverse proxy's own timeout -
 * because whoever times out first owns the error message, and ours says
 * something true while the proxy's says 504.
 */
export const QUEUE_WAIT_MS = 30_000;

/** The waiting room is full. Retry is reasonable; retry immediately is not. */
export class RenderBusyError extends Error {
  constructor(queued: number) {
    super(`the render queue is full (${queued} waiting)`);
    this.name = 'RenderBusyError';
  }
}

/** Waited past the deadline without reaching the front. A different fact. */
export class RenderTimeoutError extends Error {
  constructor(ms: number) {
    super(`waited ${ms} ms for a render slot`);
    this.name = 'RenderTimeoutError';
  }
}

interface Waiter {
  readonly resolve: () => void;
  readonly reject: (cause: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * MODULE STATE, AND THAT IS THE CORRECT SCOPE.
 *
 * The bound protects one MACHINE's memory, so it belongs to the process that
 * owns that memory. A per-request or per-user limiter would let ten users start
 * ten renders and OOM a machine on which every individual limit was respected.
 *
 * It follows that this does not survive horizontal scaling, which is fine and
 * worth stating: D1 specifies one VPS. A second instance would need the bound
 * somewhere both could see, and that is a different design.
 */
let active = 0;
const waiting: Waiter[] = [];

/** What the 503 can honestly say about why it is refusing. */
export function renderSlots(): { active: number; queued: number } {
  return { active, queued: waiting.length };
}

async function acquire(): Promise<void> {
  if (active === 0) {
    active = 1;

    return;
  }

  if (waiting.length >= MAX_QUEUED) {
    throw new RenderBusyError(waiting.length);
  }

  await new Promise<void>((resolve, reject) => {
    const waiter: Waiter = { resolve, reject, timer: null };

    waiter.timer = setTimeout(() => {
      const index = waiting.indexOf(waiter);

      // Leave the queue on the way out. A timed-out waiter left in the array
      // would be handed the slot later and resolve a promise nobody is
      // holding - the slot would then be marked busy for ever.
      if (index !== -1) waiting.splice(index, 1);

      reject(new RenderTimeoutError(QUEUE_WAIT_MS));
    }, QUEUE_WAIT_MS);

    waiting.push(waiter);
  });
}

function release(): void {
  const next = waiting.shift();

  if (next === undefined) {
    active = 0;

    return;
  }

  if (next.timer !== null) clearTimeout(next.timer);

  // `active` stays 1: the slot is HANDED OVER rather than freed and retaken,
  // so there is no window in which a new arrival could jump the queue.
  next.resolve();
}

/**
 * Run one job holding the only render slot.
 *
 * THE `finally` IS LOAD-BEARING. Without it a single failed render - a browser
 * that will not start, a page that throws - holds the slot for ever. Every
 * later export queues behind it, the queue fills, and the route answers 503
 * indefinitely while nothing at all is running. The symptom is "exports
 * stopped working" on a machine that looks perfectly healthy, which is the
 * kind of defect that costs a weekend.
 */
export async function withRenderSlot<T>(job: () => Promise<T>): Promise<T> {
  await acquire();

  try {
    return await job();
  } finally {
    release();
  }
}
