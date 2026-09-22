// web/tests/unit/export/render-queue.test.ts
//
// One render at a time, with a bounded queue. FW25b increment 2.
//
// ============================================================================
// WHY THE BOUND IS THE INTERESTING PART, NOT THE MUTEX
// ============================================================================
//
// A mutex alone turns concurrency into latency. Under load the queue grows,
// every waiting request holds its connection, its Next.js context and its
// dossier payload, and the machine runs out of memory anyway - later, and with
// a symptom that points at the wrong thing.
//
// So the queue is bounded and says NO by name, which is a 503 a client can
// retry rather than a timeout it cannot interpret.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_QUEUED,
  RenderBusyError,
  RenderTimeoutError,
  renderSlots,
  withRenderSlot,
} from '@/lib/export/render-queue';

// EVERY TEST LEAVES THE QUEUE EMPTY, asserted rather than assumed.
//
// The module state is shared across this file, so one test that leaks a
// waiter makes the NEXT one fail for a reason that has nothing to do with
// it - which is exactly what happened while writing this. A draft queued
// three jobs against a bound of two; the implementation correctly refused
// the third, that rejection broke the test Promise.all, and the orphaned
// timer surfaced two tests later as an unhandled rejection pointing at the
// timeout test. The guard was right and the test was wrong, and nothing in
// the output said so.
afterEach(() => {
  expect(renderSlots()).toEqual({ active: 0, queued: 0 });
});

/** A job that resolves when we say so, and reports when it started. */
function controllable() {
  let release: (value: string) => void = () => {};
  let started = false;

  const promise = new Promise<string>((resolve) => {
    release = resolve;
  });

  return {
    started: () => started,
    release,
    job: async () => {
      started = true;

      return promise;
    },
  };
}

describe('AC3: one render at a time, and both callers still succeed', () => {
  it('SERIALIZES two concurrent renders - the second starts only after the first ends', async () => {
    const first = controllable();
    const second = controllable();

    const a = withRenderSlot(first.job);
    const b = withRenderSlot(second.job);

    // Let the microtask queue settle. The first is inside; the second is not.
    await Promise.resolve();
    await Promise.resolve();

    expect(first.started()).toBe(true);

    // THE ASSERTION THAT MATTERS. Without it this test passes on a queue that
    // runs everything at once, since both would still resolve.
    expect(second.started()).toBe(false);

    first.release('one');
    await a;

    // Now, and only now, the second may begin.
    await Promise.resolve();
    await Promise.resolve();
    expect(second.started()).toBe(true);

    second.release('two');

    // BOTH SUCCEED. AC3 asks for serialized AND successful; a guard that
    // refused the second would pass every ordering assertion above.
    await expect(b).resolves.toBe('two');
  });

  it('runs them in submission order, so nobody starves', async () => {
    const order: number[] = [];
    const held = controllable();

    const blocking = withRenderSlot(held.job);

    // EXACTLY MAX_QUEUED. The first draft queued three against a bound of two,
    // and the implementation correctly refused the third: the TEST was wrong
    // and the guard was right, which is the good direction for that to happen.
    const queued = [1, 2].map((n) =>
      withRenderSlot(async () => {
        order.push(n);

        return n;
      }),
    );

    held.release('done');
    await blocking;
    await Promise.all(queued);

    expect(order).toEqual([1, 2]);
  });
});

describe('AC3: the queue is BOUNDED, and says so by name', () => {
  it('refuses past the bound with RenderBusyError rather than queueing forever', async () => {
    const held = controllable();
    const running = withRenderSlot(held.job);

    // Fill the waiting room exactly.
    const waiting = Array.from({ length: MAX_QUEUED }, () =>
      withRenderSlot(async () => 'queued'),
    );

    // One more than the bound.
    await expect(withRenderSlot(async () => 'overflow')).rejects.toBeInstanceOf(RenderBusyError);

    held.release('done');
    await running;
    await Promise.all(waiting);
  });

  it('accepts again once the queue drains, so the refusal is not permanent', async () => {
    // R196's shape: a guard that refuses EVERYTHING passes the test above
    // perfectly. This is the other direction.
    const held = controllable();
    const running = withRenderSlot(held.job);
    const waiting = Array.from({ length: MAX_QUEUED }, () => withRenderSlot(async () => 'q'));

    await expect(withRenderSlot(async () => 'overflow')).rejects.toBeInstanceOf(RenderBusyError);

    held.release('done');
    await running;
    await Promise.all(waiting);

    await expect(withRenderSlot(async () => 'after')).resolves.toBe('after');
  });

  it('reports how many slots are in use, so the 503 can say something true', async () => {
    expect(renderSlots()).toEqual({ active: 0, queued: 0 });

    const held = controllable();
    const running = withRenderSlot(held.job);

    await Promise.resolve();
    await Promise.resolve();

    expect(renderSlots().active).toBe(1);

    held.release('done');
    await running;

    expect(renderSlots()).toEqual({ active: 0, queued: 0 });
  });
});

describe('the slot is ALWAYS released, which is what stops one failure wedging it', () => {
  it('releases when the job throws', async () => {
    await expect(
      withRenderSlot(async () => {
        throw new Error('chromium fell over');
      }),
    ).rejects.toThrow('chromium fell over');

    // WITHOUT THE `finally` THIS IS WHERE THE PRODUCT DIES. One failed render
    // holds the only slot, every later export queues behind it, the queue
    // fills, and the route answers 503 forever while nothing is running. The
    // symptom is "exports stopped working" with a healthy machine.
    expect(renderSlots()).toEqual({ active: 0, queued: 0 });

    await expect(withRenderSlot(async () => 'next')).resolves.toBe('next');
  });
});

describe('a queued request does not wait for ever', () => {
  it('gives up with RenderTimeoutError, distinct from being refused outright', async () => {
    // R198: waiting too long and being turned away at the door are different
    // facts. A client can retry the first immediately and should back off on
    // the second.
    vi.useFakeTimers();

    try {
      const held = controllable();
      const running = withRenderSlot(held.job);
      const queued = withRenderSlot(async () => 'never gets there');

      // THE HANDLER IS ATTACHED BEFORE THE CLOCK MOVES, and that ordering is
      // the whole fix. Advancing first makes the rejection happen with nothing
      // listening, which Node reports as an UNHANDLED REJECTION - and vitest
      // still printed "7 passed" above it, so the run read as clean while
      // carrying an error its own output calls a cause of false positives.
      const rejected = expect(queued).rejects.toBeInstanceOf(RenderTimeoutError);

      await vi.advanceTimersByTimeAsync(60_000);
      await rejected;

      held.release('done');
      await running;
    } finally {
      vi.useRealTimers();
    }
  });
});
