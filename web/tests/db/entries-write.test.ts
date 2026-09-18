// web/tests/db/entries-write.test.ts
//
// FW23 increment 3: what a batch does to the database.
//
// AGAINST A REAL POSTGRESQL, because every property here is one the DATABASE
// holds: a unique constraint deciding what "the same day" means, a trigger
// refusing to move firstRecordedAt, a cascade, and an append-only table. A
// fake would assert my model of those, and the model is the thing in question.
//
// AC3: "Every write appends an EntryEvent; editing preserves firstRecordedAt
// and detectedKind; a replayed batch carrying a seen clientMutationId writes
// no row and no event and is ACKNOWLEDGED, not errored."

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { writeEntries } from '@/lib/entries/write';
import { type EntryItem, entryItemSchema } from '@/lib/entries/schema';

let userId = '';
let otherId = '';
let counter = 0;

/** A fresh mutation id per call, so a test never accidentally replays. */
function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

/**
 * An item, PARSED THROUGH THE REAL CONTRACT.
 *
 * R204's lesson applied to a fixture: writeEntries takes the PARSED type, where
 * Zod has already applied `portion` and `provenance` defaults. Hand-building
 * that type would let a test pass an object production can never produce - and
 * the first draft did exactly that, omitting `provenance` and failing every
 * test against a missing column. Parsing here means the fixture cannot drift
 * from what the route accepts.
 */
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

  userId = (await prisma.user.create({ data: { email: 'ecrit@example.com' } })).id;
  otherId = (await prisma.user.create({ data: { email: 'autre-ecrit@example.com' } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('a new day', () => {
  it('is written, with the server assigning its own timestamp', async () => {
    const before = Date.now();
    const result = await writeEntries(userId, [item()]);

    expect(result.written).toBe(1);

    const entry = await prisma.entry.findFirstOrThrow({ where: { userId } });

    expect(entry.kind).toBe('CH');
    expect(entry.dayDate.toISOString().slice(0, 10)).toBe('2026-04-07');
    // AC1. The client supplied no timestamp and could not have: the schema
    // rejects firstRecordedAt as an unknown key.
    expect(entry.firstRecordedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('appends a CREATED event', async () => {
    await writeEntries(userId, [item()]);

    const events = await prisma.entryEvent.findMany({ where: { userId } });

    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe('CREATED');
    expect(events[0]?.kind).toBe('CH');
    // The event's clock is the server's, and it agrees with the entry's.
    const entry = await prisma.entry.findFirstOrThrow({ where: { userId } });

    expect(events[0]?.recordedAt.getTime()).toBe(entry.firstRecordedAt.getTime());
  });

  it('stores clientClaimedAt verbatim when the client supplies one', async () => {
    // AC1's other half. SPEC 8 keeps both the client's claim and the server's
    // receipt, and the dossier shows both - the point being that a reader sees
    // the gap rather than being handed one number and asked to believe it.
    await writeEntries(userId, [item({ clientClaimedAt: '2026-04-07T18:03:00.000Z' })]);

    const entry = await prisma.entry.findFirstOrThrow({ where: { userId } });

    expect(entry.clientClaimedAt?.toISOString()).toBe('2026-04-07T18:03:00.000Z');
    // AND IT IS NOT THE EVIDENCE TIMESTAMP. The two must not be conflated:
    // firstRecordedAt is the server's and is what the dossier rests on.
    expect(entry.firstRecordedAt.getTime()).not.toBe(entry.clientClaimedAt?.getTime());
  });

  it('writes a half-day pair as two rows', async () => {
    const result = await writeEntries(userId, [
      item({ portion: 'AM', kind: 'CH' }),
      item({ portion: 'PM', kind: 'HOME' }),
    ]);

    expect(result.written).toBe(2);
    expect(await prisma.entry.count({ where: { userId } })).toBe(2);
  });
});

describe('editing a day', () => {
  it('updates the kind - latest server receipt wins', async () => {
    // SPEC 13.2's conflict rule, verbatim: "latest server receipt wins for
    // Entry.kind; every attempt lands in EntryEvent regardless."
    await writeEntries(userId, [item({ kind: 'CH' })]);
    await writeEntries(userId, [item({ kind: 'HOME' })]);

    const entries = await prisma.entry.findMany({ where: { userId } });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('HOME');
  });

  it('PRESERVES firstRecordedAt, which is the whole evidence claim (AC3)', async () => {
    await writeEntries(userId, [item({ kind: 'CH' })]);

    const first = await prisma.entry.findFirstOrThrow({ where: { userId } });

    await new Promise((resolve) => setTimeout(resolve, 20));
    await writeEntries(userId, [item({ kind: 'HOME' })]);

    const edited = await prisma.entry.findFirstOrThrow({ where: { userId } });

    expect(edited.firstRecordedAt.getTime()).toBe(first.firstRecordedAt.getTime());
    // The row moved, so this is not passing because nothing happened.
    expect(edited.kind).toBe('HOME');
    expect(edited.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
  });

  it('PRESERVES detectedKind when the edit does not mention it (AC3)', async () => {
    // SPEC 8: deleting the overridden proposal to make the record look tidier
    // is a review rejection. An edit that says nothing about detection must
    // not erase what detection proposed.
    await writeEntries(userId, [
      item({ kind: 'HOME', provenance: 'DETECTED_CORRECTED', detectedKind: 'CH' }),
    ]);

    await writeEntries(userId, [item({ kind: 'MISSION_FR' })]);

    const edited = await prisma.entry.findFirstOrThrow({ where: { userId } });

    expect(edited.kind).toBe('MISSION_FR');
    expect(edited.detectedKind).toBe('CH');
  });

  it('DOES replace detectedKind when the edit supplies one', async () => {
    // Preserving is about omission, not about immutability. A client that
    // sends a new proposal is correcting the record, not tidying it.
    await writeEntries(userId, [
      item({ kind: 'HOME', provenance: 'DETECTED_CORRECTED', detectedKind: 'CH' }),
    ]);

    await writeEntries(userId, [
      item({ kind: 'CH', provenance: 'DETECTED_CONFIRMED', detectedKind: 'HOME' }),
    ]);

    expect((await prisma.entry.findFirstOrThrow({ where: { userId } })).detectedKind).toBe('HOME');
  });

  it('appends a MODIFIED event and keeps the CREATED one', async () => {
    await writeEntries(userId, [item({ kind: 'CH' })]);
    await writeEntries(userId, [item({ kind: 'HOME' })]);

    const events = await prisma.entryEvent.findMany({
      where: { userId },
      orderBy: { recordedAt: 'asc' },
    });

    expect(events.map((event) => event.action)).toEqual(['CREATED', 'MODIFIED']);
    // THE TRAIL HOLDS WHAT THE ROW NO LONGER SHOWS. That is what makes it a
    // trail rather than a duplicate of the current state.
    expect(events[0]?.kind).toBe('CH');
    expect(events[1]?.kind).toBe('HOME');
  });
});

describe('AC3: a replayed batch is acknowledged, not errored', () => {
  it('writes no row and no event the second time', async () => {
    const payload = item({ kind: 'CH' });

    const first = await writeEntries(userId, [payload]);
    const replay = await writeEntries(userId, [payload]);

    expect(first.written).toBe(1);
    expect(replay.written).toBe(0);
    expect(replay.duplicates).toBe(1);

    expect(await prisma.entry.count({ where: { userId } })).toBe(1);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(1);
  });

  it('is acknowledged rather than refused', async () => {
    // SPEC 8: "a replayed batch containing an already-seen id is ACKNOWLEDGED
    // AND IGNORED." An error would make WorkManager retry forever, and the
    // retry is the thing that produced the replay.
    const payload = item();

    await writeEntries(userId, [payload]);

    const replay = await writeEntries(userId, [payload]);

    expect(replay.ok).toBe(true);
  });

  it('writes the new items in a batch that is partly a replay', async () => {
    // The realistic case: the queue re-sends a batch whose first half landed
    // before the connection dropped.
    const seen = item({ dayDate: '2026-04-07' });
    const fresh = item({ dayDate: '2026-04-08' });

    await writeEntries(userId, [seen]);

    const mixed = await writeEntries(userId, [seen, fresh]);

    expect(mixed.written).toBe(1);
    expect(mixed.duplicates).toBe(1);
    expect(await prisma.entry.count({ where: { userId } })).toBe(2);
  });

  it('scopes the id to the user, so two people cannot collide', async () => {
    // A client-generated id is only unique per client. Two devices could in
    // principle produce the same one, and one person's write must never be
    // swallowed as the other's duplicate.
    const shared = item();

    await writeEntries(userId, [shared]);

    const other = await writeEntries(otherId, [{ ...shared, clientMutationId: mutation() }]);

    expect(other.written).toBe(1);
    expect(await prisma.entry.count({ where: { userId: otherId } })).toBe(1);
  });
});

describe('TENANCY: the rows belong to the caller and nobody else', () => {
  it('writes to the caller even when the item names another user', async () => {
    // R180: the plant is verified to have LANDED before its result is read. A
    // plant that silently failed would produce a passing test and be recorded
    // as proof.
    // THE SCHEMA ALREADY REFUSES A userId KEY - tests/unit/entries/schema.test.ts
    // asserts that, and TypeScript refuses it here without a cast. This is the
    // SECOND line: even if one arrived, the writer never reads it.
    const planted = { ...item(), userId: otherId } as EntryItem & { userId: string };

    expect(planted.userId).toBe(otherId);
    expect(otherId).not.toBe(userId);

    await writeEntries(userId, [planted]);

    expect(await prisma.entry.count({ where: { userId } })).toBe(1);
    expect(await prisma.entry.count({ where: { userId: otherId } })).toBe(0);
  });

  it('never lets one person edit another person\'s day', async () => {
    // The sharper case: the same day and portion, written by someone else.
    // The unique key is (userId, dayDate, portion), so these are two rows and
    // not one - and the second write must not touch the first.
    await writeEntries(userId, [item({ kind: 'CH' })]);
    await writeEntries(otherId, [item({ kind: 'HOME' })]);

    expect((await prisma.entry.findFirstOrThrow({ where: { userId } })).kind).toBe('CH');
    expect((await prisma.entry.findFirstOrThrow({ where: { userId: otherId } })).kind).toBe('HOME');
  });

  it('attributes every event to the caller too', async () => {
    await writeEntries(userId, [{ ...item(), userId: otherId } as EntryItem]);

    expect(await prisma.entryEvent.count({ where: { userId: otherId } })).toBe(0);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(1);
  });
});

describe('the whole batch, or none of it', () => {
  it('writes nothing when one item would violate a database rule', async () => {
    // A batch is one user action - the queue flushing - and a half-applied
    // batch leaves the client unable to say what happened. The client retries
    // the whole thing, and dedup makes that safe.
    //
    // THE FIRST VERSION OF THIS TEST WAS WRONG AND FOUND A REAL DEFECT. It
    // sent two items for the same day-and-portion, expecting the unique key to
    // refuse the second. IT DOES NOT: the write path UPSERTS on that key, so
    // the second silently UPDATED the first and the batch succeeded. The row
    // would have held whichever item happened to be last in the array.
    //
    // The database cannot catch that - an upsert is the instruction not to -
    // so entriesBatchSchema refuses it instead, and this test now uses a
    // conflict the database really does hold: one clientMutationId on two
    // items. The unique index refuses the second, and the transaction takes
    // the first one back with it.
    const shared = item({ dayDate: '2026-04-07' });

    const result = await writeEntries(userId, [
      shared,
      { ...item({ dayDate: '2026-04-08' }), clientMutationId: shared.clientMutationId },
    ]);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('conflict');

    // NOTHING SURVIVED, including the item that would have succeeded alone.
    expect(await prisma.entry.count({ where: { userId } })).toBe(0);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(0);
  });
});
