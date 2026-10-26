// web/tests/db/entries-retry.test.ts
//
// FW-DOSSIER-EMPTY-3 (R591, a scope addition): A RACE LOSER ANSWERS
// granularity_conflict, NEVER write_failed.
//
// Under concurrent writes the losing transaction can fail as a deadlock or a
// write conflict - Prisma P2034, PostgreSQL 40P01 / 40001 - instead of the
// exclusion violation, and the write path answered that write_failed (500).
// gate:clone on main met it, and so did this task's own gates (PARK-O1): the
// 100-run race in entries-granularity.test.ts went red about one race in 350.
//
// THE PATH IS FORCED, NEVER HOPED FOR. Load reproduces the deadlock too rarely
// to be a test, so the database layer is made to throw it: the client's
// $transaction runs the real transaction and, on the attempts chosen, throws
// the deadlock INSIDE it - after the body's writes where the case needs them -
// so PostgreSQL rolls the attempt back exactly as it does for a real victim.
// Everything else is the real route and the real database (R204).

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { type EntryItem, entryItemSchema } from '@/lib/entries/schema';
import { POST } from '@/app/api/v1/entries/route';

let userId = '';
let token = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-9000-${String(counter).padStart(12, '0')}`;
}

function item(overrides: Record<string, unknown> = {}): EntryItem {
  const parsed = entryItemSchema.safeParse({
    clientMutationId: mutation(),
    dayDate: '2026-04-07',
    portion: 'FULL',
    kind: 'CH',
    ...overrides,
  });

  if (!parsed.success) {
    throw new Error(`the fixture is not a valid item: ${JSON.stringify(parsed.error.issues)}`);
  }

  return parsed.data;
}

async function send(entries: EntryItem[]): Promise<Response> {
  return POST(
    new Request('https://monreleve.ch/api/v1/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ entries }),
    }),
  );
}

/** Prisma's own error for a deadlock or write conflict, as a real victim gets it. */
function p2034(): Error {
  return new Prisma.PrismaClientKnownRequestError(
    'Transaction failed due to a write conflict or a deadlock. Please retry your transaction',
    { code: 'P2034', clientVersion: Prisma.prismaVersion.client },
  );
}

/** The same condition surfacing as the PostgreSQL code alone (R591's "if they surface differently"). */
function sqlstate(code: '40P01' | '40001'): Error {
  return Object.assign(new Error(`database error (SQLSTATE ${code})`), { code });
}

/** The cached client behind the `prisma` proxy - the object whose $transaction the write path calls. */
function client(): PrismaClient {
  void prisma.user;
  const cached = (globalThis as { frontalierPrisma?: PrismaClient }).frontalierPrisma;

  if (cached === undefined) throw new Error('no cached Prisma client to observe');

  return cached;
}

type Plan = 'throw-before-body' | 'throw-after-body' | 'real';

/**
 * Make the next attempts fail as planned, inside a REAL transaction, and count
 * every attempt. 'throw-after-body' runs the write path's whole body first, so
 * its rows and events exist inside the transaction when it is rolled back.
 */
function force(plans: readonly Plan[], error: () => Error = p2034): { attempts: () => number } {
  const target = client();
  const real = target.$transaction.bind(target) as (
    fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
    options?: unknown,
  ) => Promise<unknown>;
  let attempts = 0;

  vi.spyOn(target, '$transaction').mockImplementation(((
    fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
    options?: unknown,
  ) => {
    const plan = plans[attempts] ?? 'real';

    attempts += 1;

    if (plan === 'real') return real(fn, options);

    return real(async (tx) => {
      if (plan === 'throw-after-body') await fn(tx);
      throw error();
    }, options);
  }) as unknown as PrismaClient['$transaction']);

  return { attempts: () => attempts };
}

beforeEach(async () => {
  await prisma.user.deleteMany();
  userId = (await prisma.user.create({ data: { email: 'retry@example.com' } })).id;
  token = (await issueTokenPair(userId)).accessToken;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('FW-DOSSIER-EMPTY-3 R591: a race loser is retried once, and answers for itself', () => {
  it('a loser against the winner\'s other granularity answers 400 granularity_conflict, not 500', async () => {
    // The winner: a FULL already stored.
    expect((await send([item()])).status).toBe(200);
    const eventsBefore = await prisma.entryEvent.count({ where: { userId } });

    expect(eventsBefore).toBe(1);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const forced = force(['throw-before-body']);
    const response = await send([item({ portion: 'AM', kind: 'HOME' })]);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'granularity_conflict' });
    // The retry is what met the constraint: two attempts, never a third.
    expect(forced.attempts()).toBe(2);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(eventsBefore);
  });

  it('a loser with no conflict to meet lands on the retry, written exactly once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const forced = force(['throw-after-body']);
    const response = await send([item({ dayDate: '2026-04-08' })]);

    expect(response.status).toBe(200);
    expect(forced.attempts()).toBe(2);

    // NOTHING WRITTEN TWICE: the first attempt's row and event were inside the
    // transaction that was rolled back, so exactly one of each survives.
    const rows = await prisma.entry.findMany({ where: { userId } });
    const events = await prisma.entryEvent.findMany({ where: { userId } });

    expect(rows).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'CREATED', portion: 'FULL', entryId: rows[0]?.id });
  });

  it.each([['40P01'], ['40001']] as const)(
    'the same condition surfacing as SQLSTATE %s is retried the same way',
    async (code) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const forced = force(['throw-after-body'], () => sqlstate(code));
      const response = await send([item({ dayDate: '2026-04-09' })]);

      expect(response.status).toBe(200);
      expect(forced.attempts()).toBe(2);
      expect(await prisma.entryEvent.count({ where: { userId } })).toBe(1);
    },
  );

  it('a retry that fails again answers write_failed, writes nothing, and is never tried a third time', async () => {
    const lines: string[] = [];

    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    const forced = force(['throw-after-body', 'throw-after-body', 'throw-after-body']);
    const response = await send([item({ dayDate: '2026-04-10' })]);

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: 'write_failed' });
    expect(forced.attempts()).toBe(2);
    expect(await prisma.entry.count({ where: { userId } })).toBe(0);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(0);
    expect(lines.join('\n')).toContain('write_failed');
  });

  it('any other failure behaves as before: not retried, write_failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const forced = force(['throw-after-body'], () => new Error('something else broke'));
    const response = await send([item({ dayDate: '2026-04-13' })]);

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: 'write_failed' });
    expect(forced.attempts()).toBe(1);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(0);
  });
});
