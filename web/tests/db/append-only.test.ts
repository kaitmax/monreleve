// web/tests/db/append-only.test.ts
//
// FW21 / AC2: the evidence layer's foundation, asserted against the database
// rather than against a convention.
//
// THE PROMPT IS EXPLICIT: "Prove each by attempting it and capturing the
// rejection - this is the evidence layer's foundation and a convention in a
// service file is not enforcement." Everything this product claims about its
// records rests on two properties, and both have to survive a writer who does
// not know the rule, a migration script, a support query and a future ORM:
//
//   1. EntryEvent is append-only.
//   2. Entry.firstRecordedAt never changes after the row is created.
//
// BOTH DIRECTIONS THROUGHOUT. A table nobody can write to at all satisfies
// every "is rejected" case here perfectly, and would also be useless. So each
// block states what must be REFUSED and what must still WORK - and for this
// pair, what must still work is the part with a published promise behind it:
//
//   - an EntryEvent can still be INSERTED, or there is no audit trail;
//   - an Entry can still be EDITED (SPEC 8: "Edits update Entry.kind - latest
//     wins for calculation - but append an EntryEvent");
//   - D11's account deletion still "removes user, entries, events, devices".
//
// THAT LAST ONE IS WHY DELETE IS NOT SIMPLY REFUSED. Append-only exists to
// prevent a record being CORRECTED or an inconvenient event being removed
// selectively. Erasing a person is a different act with a different promise
// behind it: it destroys the whole record, the reader asked for it, and
// /confidentialite says it happens. A trigger that refused every DELETE would
// enforce the audit rule by breaking the privacy one.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';

async function rejection(write: Promise<unknown>): Promise<string> {
  try {
    await write;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error('the write was ACCEPTED, and this test exists because it must not be');
}

let seq = 0;

/** A user, one entry, and one event recording its creation. */
async function aRecord(): Promise<{ userId: string; entryId: string; eventId: string }> {
  seq += 1;

  const user = await prisma.user.create({ data: { email: `event-${seq}@example.com` } });
  const entry = await prisma.entry.create({
    data: {
      userId: user.id,
      dayDate: new Date('2026-02-03'),
      kind: 'CH',
      clientMutationId: `event-fixture-${seq}`,
    },
  });
  const event = await prisma.entryEvent.create({
    data: {
      userId: user.id,
      entryId: entry.id,
      action: 'CREATED',
      kind: 'CH',
      provenance: 'MANUAL',
      dayDate: new Date('2026-02-03'),
      portion: 'FULL',
    },
  });

  return { userId: user.id, entryId: entry.id, eventId: event.id };
}

beforeEach(async () => {
  // EntryEvent cannot be deleted while its user exists - which is the whole
  // point of this file - so the only way to empty it is the cascade, and the
  // order here is not optional.
  await prisma.user.deleteMany();
  await prisma.entry.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('EntryEvent is append-only', () => {
  it('refuses an UPDATE', async () => {
    // THE CASE THIS PREVENTS IS A PLAUSIBLE ONE, not vandalism: somebody
    // fixing a kind that looks wrong, in the table that exists to record what
    // was said at the time. An audit trail that can be corrected in place
    // makes every dossier it backs unverifiable.
    const { eventId } = await aRecord();

    const message = await rejection(
      prisma.entryEvent.update({ where: { id: eventId }, data: { kind: 'HOME' } }),
    );

    expect(message).toContain('EntryEvent is append-only');
  });

  it('refuses an UPDATE that changes nothing', async () => {
    // A no-op UPDATE is refused too, and deliberately. The rule is about the
    // STATEMENT, not about whether the bytes moved: a trigger that let
    // harmless updates through would have to decide what harmless means, and
    // it would be deciding it inside the one table that must not be argued
    // with.
    const { eventId } = await aRecord();

    const message = await rejection(
      prisma.entryEvent.update({ where: { id: eventId }, data: { action: 'CREATED' } }),
    );

    expect(message).toContain('EntryEvent is append-only');
  });

  it('refuses a DELETE while the person still exists', async () => {
    const { eventId } = await aRecord();

    const message = await rejection(prisma.entryEvent.delete({ where: { id: eventId } }));

    expect(message).toContain('EntryEvent is append-only');
  });

  it('refuses a bulk DELETE, which is the same statement with no WHERE', async () => {
    await aRecord();

    const message = await rejection(prisma.entryEvent.deleteMany({}));

    expect(message).toContain('EntryEvent is append-only');
  });

  it('still accepts an INSERT, which is the half that makes it a trail', async () => {
    // WITHOUT THIS ASSERTION the three above are satisfied by a table nobody
    // can write to at all. SPEC 8's edit path appends an event on every
    // change, so an append that failed would stop the product recording
    // anything rather than stop it lying.
    const { userId, entryId } = await aRecord();

    const second = await prisma.entryEvent.create({
      data: {
        userId,
        entryId,
        action: 'MODIFIED',
        kind: 'HOME',
        provenance: 'MANUAL',
        dayDate: new Date('2026-02-03'),
        portion: 'FULL',
      },
    });

    const trail = await prisma.entryEvent.findMany({ where: { entryId }, orderBy: { recordedAt: 'asc' } });

    expect(second.action).toBe('MODIFIED');
    expect(trail.map((event) => event.action)).toEqual(['CREATED', 'MODIFIED']);
  });
});

describe('D11: erasing a person still erases their events', () => {
  it('removes user, entries and events together', async () => {
    // SPEC 8.4 / D11: "suppression du compte - removes user, entries, events,
    // devices, and all local Room data". /confidentialite publishes it.
    //
    // THIS IS THE ONE DELETE THAT IS ALLOWED, and the distinction the trigger
    // draws is exactly the distinction between the two promises: an event may
    // not be removed ON ITS OWN, because that is a record being tidied. It may
    // disappear WITH the person it describes, because that is the record being
    // destroyed at their request, and nothing is left behind to be misread.
    const { userId, entryId } = await aRecord();

    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(0);
    expect(await prisma.entry.count({ where: { id: entryId } })).toBe(0);
    expect(await prisma.user.count({ where: { id: userId } })).toBe(0);
  });
});

describe('Entry.firstRecordedAt is immutable', () => {
  it('refuses an UPDATE that changes it', async () => {
    // A CLIENT CLOCK IS TRIVIALLY CHANGED, which is why the server stamps
    // this field, and moving it afterwards would undo that in one statement.
    // The late flag is derived from it (firstRecordedAt - dayDate > 7 days),
    // so an editable firstRecordedAt is an editable "saisie tardive" - the
    // one label on the document that exists to be uncomfortable.
    const { entryId } = await aRecord();

    const message = await rejection(
      prisma.$executeRaw`UPDATE "Entry" SET "firstRecordedAt" = '2020-01-01T00:00:00Z' WHERE id = ${entryId}`,
    );

    expect(message).toContain('Entry.firstRecordedAt is immutable');
  });

  it('refuses it even when the new value is later, not earlier', async () => {
    // The rule is not "cannot be backdated". Moving a receipt forward hides a
    // record that was made on time just as effectively as moving one back
    // hides a late one, and a trigger that only caught backdating would be a
    // trigger somebody worked around by accident.
    const { entryId } = await aRecord();

    const message = await rejection(
      prisma.$executeRaw`UPDATE "Entry" SET "firstRecordedAt" = '2030-01-01T00:00:00Z' WHERE id = ${entryId}`,
    );

    expect(message).toContain('Entry.firstRecordedAt is immutable');
  });

  it('still allows the edit path SPEC 8 describes', async () => {
    // "Edits update Entry.kind (latest wins for calculation) but append an
    // EntryEvent." WITHOUT THIS the two tests above are satisfied by an Entry
    // table that refuses every UPDATE, which would break the product's main
    // interaction - correcting a day.
    const { entryId } = await aRecord();
    const before = await prisma.entry.findUniqueOrThrow({ where: { id: entryId } });

    const after = await prisma.entry.update({
      where: { id: entryId },
      data: { kind: 'HOME', provenance: 'DETECTED_CORRECTED', detectedKind: 'CH', note: 'corrige' },
    });

    expect(after.kind).toBe('HOME');
    expect(after.detectedKind).toBe('CH');
    expect(after.firstRecordedAt.getTime()).toBe(before.firstRecordedAt.getTime());
  });

  it('allows an UPDATE that names firstRecordedAt without moving it', async () => {
    // AN ORM IS ENTITLED TO WRITE EVERY COLUMN. Prisma sends only changed
    // fields, but a future writer - an admin tool, a repair script, a
    // different client - may well issue a full-row UPDATE with the value it
    // just read. The trigger compares values rather than inspecting which
    // columns the statement mentioned, so that costs nobody anything.
    const { entryId } = await aRecord();
    const before = await prisma.entry.findUniqueOrThrow({ where: { id: entryId } });

    await prisma.$executeRaw`
      UPDATE "Entry" SET "kind" = 'HOME', "firstRecordedAt" = ${before.firstRecordedAt}
      WHERE id = ${entryId}
    `;

    const after = await prisma.entry.findUniqueOrThrow({ where: { id: entryId } });

    expect(after.kind).toBe('HOME');
    expect(after.firstRecordedAt.getTime()).toBe(before.firstRecordedAt.getTime());
  });
});
