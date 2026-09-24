// web/tests/db/client-surface.test.ts
//
// THE TWO PROPERTIES lib/db/client.ts MUST HAVE IN PRODUCTION. FW31.
//
// ============================================================================
// WHY THESE ASSERTIONS EXIST, AND WHY THEY FORCE NODE_ENV
// ============================================================================
//
// POST /api/v1/entries returned 500 and wrote zero rows on every production
// build from 13 September until FW31, while every suite in this repository was
// green. They were green because THEY ALL RUN WHERE THE DEFECT DOES NOT EXIST:
// the client cached itself when NODE_ENV was anything but `production`, and no
// automated run ever used that value.
//
// So a test that took the ambient NODE_ENV would have passed on the broken
// code and proved nothing. Each block below stubs `production`, clears the
// cache the module keeps on globalThis, and re-imports - which is the
// configuration the container actually runs in.
//
// ============================================================================
// THE TWO HALVES, AND WHY EACH NEEDS ITS OWN ASSERTION
// ============================================================================
//
// The defect had two independent causes and either one alone still leaves a
// defect - so a single assertion covering both would let one of them come back
// unnoticed (R175).
//
//   MEMOISATION. `create()` cached only off-production, so every property
//   access built a client and a pool. Isolated by DELEGATE IDENTITY below:
//   two reads of `prisma.user` come off two different clients when it
//   regresses.
//
//   BINDING. The get trap returned an unbound function, and
//   `prisma.$transaction(...)` binds `this` to the Proxy by ordinary
//   method-call semantics - so Prisma's internals resolved through the trap
//   rather than off the client that opened the transaction. Isolated by
//   DETACHED INVOCATION below: a method held in a variable has no base
//   reference to bind, so only a bound one can run.
//
// The pair is chosen so that fixing either half alone fails the other test.
// Measured against all four variants in REPORT-FW31.txt.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CacheHolder = { frontalierPrisma?: unknown };

/**
 * The module under test, imported as production sees it.
 *
 * THE CACHE IS CLEARED FIRST. It lives on globalThis precisely so that it
 * survives module re-evaluation, which means `vi.resetModules()` alone would
 * hand back the client built by whichever block ran before this one - and the
 * assertion would be about that one instead.
 */
async function importAsProduction() {
  vi.stubEnv('NODE_ENV', 'production');
  vi.resetModules();

  delete (globalThis as CacheHolder).frontalierPrisma;

  return import('@/lib/db/client');
}

beforeEach(() => {
  delete (globalThis as CacheHolder).frontalierPrisma;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  delete (globalThis as CacheHolder).frontalierPrisma;
});

describe('the Prisma client in production', () => {
  it('MEMOISATION: is one client, not one per property access', async () => {
    const { prisma } = await importAsProduction();

    expect(process.env.NODE_ENV, 'the stub took effect').toBe('production');

    // Two reads of the same delegate. Prisma memoises a delegate per client,
    // so these are equal if and only if they came off the SAME client.
    const first = (prisma as unknown as Record<string, unknown>).user;
    const second = (prisma as unknown as Record<string, unknown>).user;

    expect(first).toBe(second);

    // A second delegate, because one could be equal by accident of caching
    // somewhere else; two cannot.
    const entryA = (prisma as unknown as Record<string, unknown>).entry;
    const entryB = (prisma as unknown as Record<string, unknown>).entry;

    expect(entryA).toBe(entryB);
  });

  it('BINDING: hands out methods that run on the client, not on the Proxy', async () => {
    const { prisma } = await importAsProduction();

    // DETACHED ON PURPOSE. Held in a variable, the call has no base reference,
    // so `this` is undefined unless the trap bound it. An unbound method
    // throws reading a Prisma internal off undefined.
    const queryRawUnsafe = prisma.$queryRawUnsafe.bind(prisma) as never;

    // The line above is what a CALLER would write to work around an unbound
    // method; the assertion is that they do not have to.
    const detached = prisma.$queryRawUnsafe;

    const rows = await (detached as (sql: string) => Promise<unknown[]>)('SELECT 1 AS one');

    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(1);

    // The workaround must also still work, so this asserts the fix rather than
    // merely a change of shape.
    expect(typeof queryRawUnsafe).toBe('function');
  });

  it('BOTH: a transaction opens and commits on one client', async () => {
    const { prisma } = await importAsProduction();

    // TWO calls on the SAME handle - the shape lib/entries/write.ts uses, and
    // the shape that produced "Transaction API error: Transaction not found".
    const result = await prisma.$transaction(async (tx) => {
      const users = await tx.user.count();
      const events = await tx.entryEvent.count();

      return { users, events };
    });

    expect(typeof result.users).toBe('number');
    expect(typeof result.events).toBe('number');
  });

  it('model delegates keep their identity - they are objects, not bound functions', async () => {
    const { prisma } = await importAsProduction();

    // Binding must apply to client METHODS only. A delegate is Prisma's own
    // composite proxy; wrapping it would change what every call site holds.
    expect(typeof (prisma as unknown as Record<string, unknown>).user).toBe('object');
    expect(typeof prisma.$transaction).toBe('function');
  });
});
