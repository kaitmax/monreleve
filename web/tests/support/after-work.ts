// web/tests/support/after-work.ts
//
// next/server's after(), for a route handler driven in-process (W12, Web
// Ruling 37 R1072).
//
// THE WEBSITE'S STEP ONE HANDS A KNOWN ADDRESS'S ROW AND MAIL TO after(), so
// the request does the same work for a known and an unknown address. Next runs
// that work once the response has been sent; outside a request, after()
// throws. A test that drives the handler mocks next/server with queueAfter and
// then runs the queue - which is the order Next uses: the response first, the
// deferred work second. requestCodeOnSite drains it by default, so a test reads
// the outbox exactly as a person would read their mail.
//
// Use, at the top of a test file (vi.mock is hoisted):
//   vi.mock('next/server', async (original) => ({
//     ...(await original<typeof import('next/server')>()),
//     after: (await import('@/tests/support/after-work')).queueAfter,
//   }));

const queue: (() => unknown)[] = [];

/** next/server's after(), as a queue. */
export function queueAfter(work: () => unknown): void {
  queue.push(work);
}

/** How much work the last response left behind. */
export function pendingAfterWork(): number {
  return queue.length;
}

/** Runs the queued work in order, as Next does once the response is sent. */
export async function drainAfterWork(): Promise<void> {
  while (queue.length > 0) await queue.shift()?.();
}
