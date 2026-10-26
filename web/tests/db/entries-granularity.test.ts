// web/tests/db/entries-granularity.test.ts
//
// FW-GRANULARITY (R499-R500, R504): THE DATABASE REFUSES A DAY WITH TWO
// GRANULARITIES, and the write path says so as a refusal, never a 500.
//
// R490: a day keeps the granularity it was recorded in. FULL beside AM or PM is
// counted twice in the Releve (R476), so the rule lives in the database, where a
// writer that does not know it exists (iOS, any later client) cannot bypass it
// (R196). Every case runs against a real PostgreSQL: an exclusion constraint is
// a claim about PostgreSQL, and a fake would assert a model of it.
//
// BOTH DIRECTIONS (R196): the refusals prove the constraint is strict; AM+PM,
// an edit and a kind change being ACCEPTED prove it is right.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { writeEntries } from '@/lib/entries/write';
import { type EntryItem, entryItemSchema } from '@/lib/entries/schema';
import { POST } from '@/app/api/v1/entries/route';

/** How many times the race is run (R500). Reported in the report. */
const RACE_RUNS = 100;

let userId = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
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

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (await prisma.user.create({ data: { email: 'granularite@example.com' } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the constraint itself, at the table', () => {
  it('has the exclusion constraint Prisma does not model', async () => {
    const rows = await prisma.$queryRaw<Array<{ contype: string }>>`
      SELECT contype::text AS contype FROM pg_constraint WHERE conname = 'entry_one_granularity_per_day'`;

    expect(rows).toEqual([{ contype: 'x' }]);
  });

  it('refuses a raw insert of AM beside FULL with SQLSTATE 23P01', async () => {
    await writeEntries(userId, [item()]);

    await expect(
      prisma.entry.create({
        data: {
          userId,
          dayDate: new Date('2026-04-07T00:00:00.000Z'),
          portion: 'AM',
          kind: 'CH',
          clientMutationId: 'raw-1',
        },
      }),
    ).rejects.toThrow(/23P01|entry_one_granularity_per_day/);
  });
});

describe('the write path', () => {
  it('FULL then AM: the AM is refused as granularity_conflict', async () => {
    expect((await writeEntries(userId, [item()])).ok).toBe(true);

    const result = await writeEntries(userId, [item({ portion: 'AM' })]);

    expect(result).toMatchObject({ ok: false, code: 'granularity_conflict', written: 0 });
    expect(await prisma.entry.count({ where: { userId } })).toBe(1);
  });

  it('AM then FULL: the FULL is refused', async () => {
    expect((await writeEntries(userId, [item({ portion: 'AM' })])).ok).toBe(true);

    const result = await writeEntries(userId, [item()]);

    expect(result).toMatchObject({ ok: false, code: 'granularity_conflict' });
  });

  it('PM then FULL: the FULL is refused', async () => {
    await writeEntries(userId, [item({ portion: 'PM' })]);

    expect(await writeEntries(userId, [item()])).toMatchObject({ code: 'granularity_conflict' });
  });

  it('AM then PM: accepted - two halves are one granularity', async () => {
    await writeEntries(userId, [item({ portion: 'AM' })]);

    const result = await writeEntries(userId, [item({ portion: 'PM' })]);

    expect(result).toMatchObject({ ok: true, written: 1 });
    expect(await prisma.entry.count({ where: { userId } })).toBe(2);
  });

  it('FULL modified to another kind: accepted', async () => {
    await writeEntries(userId, [item()]);

    const result = await writeEntries(userId, [item({ kind: 'HOME' })]);

    expect(result).toMatchObject({ ok: true, written: 1 });
    expect((await prisma.entry.findFirstOrThrow({ where: { userId } })).kind).toBe('HOME');
  });

  it('a different day, and a different person, are unaffected', async () => {
    const other = (await prisma.user.create({ data: { email: 'autre-gran@example.com' } })).id;

    await writeEntries(userId, [item()]);

    expect((await writeEntries(userId, [item({ dayDate: '2026-04-08', portion: 'AM' })])).ok).toBe(true);
    expect((await writeEntries(other, [item({ portion: 'AM' })])).ok).toBe(true);
  });

  it('FULL and AM for one day in ONE batch: refused, and nothing of the batch survives', async () => {
    const result = await writeEntries(userId, [
      item({ dayDate: '2026-04-09' }),
      item({ dayDate: '2026-04-07' }),
      item({ dayDate: '2026-04-07', portion: 'AM' }),
    ]);

    expect(result).toMatchObject({ ok: false, code: 'granularity_conflict' });
    expect(await prisma.entry.count({ where: { userId } })).toBe(0);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(0);
  });

  it('a refusal appends no event (R500)', async () => {
    await writeEntries(userId, [item()]);
    const before = await prisma.entryEvent.count({ where: { userId } });

    await writeEntries(userId, [item({ portion: 'AM' })]);

    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(before);
  });
});

describe('two concurrent requests, one FULL and one AM, for the same day', () => {
  it(`exactly one wins and the other is a refusal, never a 500 (${RACE_RUNS} runs)`, async () => {
    const outcomes: string[] = [];

    for (let run = 0; run < RACE_RUNS; run += 1) {
      const dayDate = new Date(Date.UTC(2026, 0, 1 + run)).toISOString().slice(0, 10);

      const results = await Promise.all([
        writeEntries(userId, [item({ dayDate, portion: 'FULL' })]),
        writeEntries(userId, [item({ dayDate, portion: 'AM' })]),
      ]);

      const winners = results.filter((result) => result.ok);
      const losers = results.filter((result) => !result.ok);

      outcomes.push(`${winners.length}/${losers.map((loser) => loser.code).join(',')}`);

      const stored = await prisma.entry.findMany({
        where: { userId, dayDate: new Date(`${dayDate}T00:00:00.000Z`) },
      });

      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(losers[0]?.code).toBe('granularity_conflict');
      expect(stored).toHaveLength(1);
    }

    expect(new Set(outcomes)).toEqual(new Set(['1/granularity_conflict']));
  }, 120_000);
});

describe('through the route, as the Android queue sends it (R504)', () => {
  it('a FULL and an AM batch is a 400 granularity_conflict, and the item-by-item retry lands the FULL only', async () => {
    const token = (await issueTokenPair(userId)).accessToken;
    const send = (entries: EntryItem[]): Promise<Response> =>
      POST(
        new Request('https://monreleve.ch/api/v1/entries', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ entries }),
        }),
      );

    const full = item({ dayDate: '2026-04-07' });
    const half = item({ dayDate: '2026-04-07', portion: 'AM' });

    const batch = await send([full, half]);

    expect(batch.status).toBe(400);
    expect(await batch.json()).toMatchObject({ status: 'error', code: 'granularity_conflict' });
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(0);

    // The R296 isolation SyncEngine performs: each item on its own, once.
    const first = await send([full]);
    const second = await send([half]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(await second.json()).toMatchObject({ code: 'granularity_conflict' });

    // The positive control: exactly one event, the CREATED for the FULL.
    const events = await prisma.entryEvent.findMany({ where: { userId } });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'CREATED', portion: 'FULL' });
  });
});

// ============================================================================
// FW-DOSSIER-EMPTY-3 (R588): A REFUSED BATCH STILL LANDS ITS GOOD DAYS - THE
// SERVER HALF
// ============================================================================
//
// FW-GRANULARITY kept a whole-batch 400 granularity_conflict (its DEVIATIONS
// 1), and the operator accepted it on one proof: a batch holding ONE
// conflicting day and TWO valid ones ends with the two valid days on the
// server. The app half is SyncEngineTest (R296: a refused multi-item 400 is
// isolated item by item, once); this is the server's, through the route
// (R204), with the app's isolation replayed as the requests it sends.
//
// THE CONFLICTING DAY IS ALREADY STORED, so the refusal is against the record
// rather than inside the batch (the R504 test above covers that one), and its
// own CREATED event is the positive control: the count the refusal must leave
// unchanged is 1, not 0, so "unchanged" cannot pass on a query that sees
// nothing.
describe('FW-DOSSIER-EMPTY-3 R588: a refused batch still lands its good days', () => {
  it('one conflicting day and two valid ones: 400 and nothing written, then 200, 200, 400 item by item', async () => {
    const token = (await issueTokenPair(userId)).accessToken;
    const send = (entries: EntryItem[]): Promise<Response> =>
      POST(
        new Request('https://monreleve.ch/api/v1/entries', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ entries }),
        }),
      );
    const day = (stored: Date): string => stored.toISOString().slice(0, 10);

    // The stored day: a FULL on the 7th, recorded through the route.
    expect((await send([item({ dayDate: '2026-04-07' })])).status).toBe(200);

    const storedRows = await prisma.entry.findMany({ where: { userId } });
    const storedEvents = await prisma.entryEvent.findMany({ where: { userId } });

    // POSITIVE CONTROL: the stored day's own event, so every "unchanged" below
    // is measured against something real.
    expect(storedRows).toHaveLength(1);
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents[0]).toMatchObject({ action: 'CREATED', portion: 'FULL' });

    // The batch as the queue holds it: two valid days, then a half of the
    // stored whole day - the one conflict.
    const valid1 = item({ dayDate: '2026-04-08', kind: 'HOME' });
    const valid2 = item({ dayDate: '2026-04-09' });
    const conflicting = item({ dayDate: '2026-04-07', portion: 'AM', kind: 'HOME' });

    const batch = await send([valid1, valid2, conflicting]);

    expect(batch.status).toBe(400);
    expect(await batch.json()).toMatchObject({ status: 'error', code: 'granularity_conflict' });
    // NOTHING WRITTEN: no row for either valid day, and no event appended.
    expect(await prisma.entry.findMany({ where: { userId } })).toEqual(storedRows);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(storedEvents.length);

    // The app's isolation (R296), replayed: each item alone, once, in order.
    const statuses: number[] = [];
    for (const single of [valid1, valid2, conflicting]) {
      statuses.push((await send([single])).status);
    }

    expect(statuses).toEqual([200, 200, 400]);

    // The server ends holding exactly the two valid days beside the stored one...
    const rows = await prisma.entry.findMany({ where: { userId }, orderBy: { dayDate: 'asc' } });

    expect(rows.map((row) => [day(row.dayDate), row.portion, row.kind])).toEqual([
      ['2026-04-07', 'FULL', 'CH'],
      ['2026-04-08', 'FULL', 'HOME'],
      ['2026-04-09', 'FULL', 'CH'],
    ]);

    // ...each valid day with one CREATED event...
    const events = await prisma.entryEvent.findMany({ where: { userId }, orderBy: { dayDate: 'asc' } });
    const storedId = storedRows[0]?.id;

    expect(
      events.filter((event) => event.entryId !== storedId).map((event) => [day(event.dayDate), event.action]),
    ).toEqual([
      ['2026-04-08', 'CREATED'],
      ['2026-04-09', 'CREATED'],
    ]);

    // ...and the conflicting day untouched: the same row, its one event alone.
    expect(rows[0]).toEqual(storedRows[0]);
    expect(events.filter((event) => event.entryId === storedId)).toEqual(storedEvents);
  });
});
