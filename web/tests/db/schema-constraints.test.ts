// web/tests/db/schema-constraints.test.ts
//
// FW21: the invariants SPEC 8 states about the data, asserted against the
// database that is supposed to be enforcing them.
//
// R196 - AN INVARIANT SPEC STATES ABOUT THE DATA IS ENFORCED IN THE DATABASE
// WHERE THE DATABASE CAN EXPRESS IT. The prompt names the absence rule as a
// database concern; SPEC 8 states two more in exactly the same grammatical
// form ("1-100", "required iff"), so all of them are check constraints and
// this file is where they are proven.
//
// WHY THIS FILE EXISTS AT ALL, rather than a transcript. Increment 1's three
// constraints were proven once, in a session, by hand. A constraint proven
// once and never again is the same artefact as a convention in a service
// file: it is believed rather than checked, and the next migration that drops
// it passes every gate. The prompt's own words about AC2 - "a convention in a
// service file is not enforcement" - apply to the proof as much as to the
// rule.
//
// BOTH DIRECTIONS, ALWAYS, and that is the half that matters. A constraint
// that rejects EVERYTHING passes a negative test perfectly: CHECK (false)
// would satisfy every "is rejected" case in this file and nothing else. Each
// describe block therefore states what must be REFUSED and what must still be
// ACCEPTED, and the accepted cases are not padding - they are what
// distinguishes a correct constraint from a locked table.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';

/**
 * Run a write that must fail, and hand back what PostgreSQL said.
 *
 * ASSERTED BY CONSTRAINT NAME, never by "it threw". A test that only checks
 * for rejection is satisfied by a typo in a column name, by a foreign key
 * that was not set up, by the database being down - by every failure except
 * the one it means. The name is the only evidence that the rule under test is
 * the rule that fired.
 */
async function rejection(write: Promise<unknown>): Promise<string> {
  try {
    await write;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error('the write was ACCEPTED, and this test exists because it must not be');
}

let seq = 0;

/** A user the Entry cases can hang off. The table is emptied per test. */
async function aUser(overrides: Record<string, unknown> = {}): Promise<string> {
  seq += 1;

  const user = await prisma.user.create({
    data: { email: `entry-${seq}@example.com`, ...overrides },
  });

  return user.id;
}

beforeEach(async () => {
  // Entry cascades from User, so the second delete would be enough. It is
  // written out because a reader should not have to know the cascade to know
  // the table is empty.
  await prisma.entry.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('User.employmentRate is 1-100, in the database', () => {
  it.each([
    [0, 'zero percent is not a part-timer, it is somebody who does not work here'],
    [101, 'over full time'],
    [-40, 'negative'],
  ])('refuses %i (%s)', async (employmentRate) => {
    const message = await rejection(
      prisma.user.create({ data: { email: 'rate@example.com', employmentRate } }),
    );

    expect(message).toContain('User_employmentRate_range');
  });

  it.each([1, 50, 80, 100])('accepts %i', async (employmentRate) => {
    const user = await prisma.user.create({
      data: { email: `rate-${employmentRate}@example.com`, employmentRate },
    });

    expect(user.employmentRate).toBe(employmentRate);
  });
});

describe('User.exactTotalWorkDays is present iff the denominator is EXACT', () => {
  // BOTH DIRECTIONS. The forward one is obvious: EXACT with no total leaves
  // the engine without a denominator. The reverse is the one that bites - a
  // total left on a SIMPLIFIED240 row is a number a later reader will use,
  // and the engine takes its denominator from the KIND, so the row carries a
  // figure that disagrees with the calculation with nothing saying which
  // wins. That is the FW12 tile defect, in a column.

  it('refuses EXACT with no total', async () => {
    const message = await rejection(
      prisma.user.create({
        data: { email: 'exact@example.com', denominatorKind: 'EXACT' },
      }),
    );

    expect(message).toContain('User_exactTotalWorkDays_iff_exact');
  });

  it('refuses SIMPLIFIED240 carrying a total', async () => {
    const message = await rejection(
      prisma.user.create({
        data: {
          email: 'simplified@example.com',
          denominatorKind: 'SIMPLIFIED240',
          exactTotalWorkDays: 215,
        },
      }),
    );

    expect(message).toContain('User_exactTotalWorkDays_iff_exact');
  });

  it('accepts EXACT with a total, and SIMPLIFIED240 without one', async () => {
    const exact = await prisma.user.create({
      data: {
        email: 'exact-ok@example.com',
        denominatorKind: 'EXACT',
        exactTotalWorkDays: 215,
      },
    });
    const simplified = await prisma.user.create({
      data: { email: 'simplified-ok@example.com' },
    });

    expect(exact.exactTotalWorkDays).toBe(215);
    expect(simplified.denominatorKind).toBe('SIMPLIFIED240');
    expect(simplified.exactTotalWorkDays).toBeNull();
  });
});

describe('Entry.absenceReason is present iff the kind is ABSENT', () => {
  // THE PROMPT IS EXPLICIT: "enforce it, do not merely document it", and "a
  // check constraint or equivalent so an ABSENT row without a reason, or a
  // non-ABSENT row with one, cannot exist".
  //
  // It matters beyond tidiness because ABSENT never reaches the engine (SPEC
  // 8): absences are filtered out before counting. A CH row carrying an
  // absence reason is a day that reads as absent in the dossier and counts as
  // worked in the calculation - the record and the figure disagreeing, which
  // is the one thing this product cannot afford.

  it('refuses ABSENT with no reason', async () => {
    const userId = await aUser();

    const message = await rejection(
      prisma.entry.create({
        data: {
          userId,
          dayDate: new Date('2026-03-02'),
          kind: 'ABSENT',
          clientMutationId: 'absent-no-reason',
        },
      }),
    );

    expect(message).toContain('Entry_absenceReason_iff_absent');
  });

  it.each(['CH', 'HOME', 'MISSION_FR', 'MISSION_THIRD'] as const)(
    'refuses %s carrying a reason',
    async (kind) => {
      const userId = await aUser();

      const message = await rejection(
        prisma.entry.create({
          data: {
            userId,
            dayDate: new Date('2026-03-03'),
            kind,
            absenceReason: 'CONGE',
            clientMutationId: `worked-with-reason-${kind}`,
          },
        }),
      );

      expect(message).toContain('Entry_absenceReason_iff_absent');
    },
  );

  it.each(['CONGE', 'MALADIE', 'FERIE', 'AUTRE'] as const)(
    'accepts ABSENT with reason %s',
    async (absenceReason) => {
      const userId = await aUser();

      const entry = await prisma.entry.create({
        data: {
          userId,
          dayDate: new Date('2026-03-04'),
          kind: 'ABSENT',
          absenceReason,
          clientMutationId: `absent-${absenceReason}`,
        },
      });

      expect(entry.absenceReason).toBe(absenceReason);
    },
  );

  it('accepts a worked day with no reason', async () => {
    const userId = await aUser();

    const entry = await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date('2026-03-05'),
        kind: 'CH',
        clientMutationId: 'worked-no-reason',
      },
    });

    expect(entry.absenceReason).toBeNull();
  });
});

describe('a corrected detection keeps the proposal it corrected (D17)', () => {
  // SPEC 8, provenance rules: "Whenever a proposal existed, detectedKind is
  // stored EVEN WHEN THE USER OVERRODE IT. Deleting the overridden detection
  // to make the record look tidier is a review rejection."
  //
  // A DETECTED_CORRECTED row with no detectedKind is exactly that tidied
  // record: it says the reader changed a proposal, and the proposal it says
  // they changed is gone. The correction then has nothing to be a correction
  // OF - the audit trail the product sells is the part that went missing.
  //
  // THIS BLOCK EXISTS BECAUSE THE ABLATION FOUND IT MISSING. Dropping both of
  // Entry's check constraints failed only the absence tests: the constraint
  // below had no test at all, so it could have been dropped by a later
  // migration with every suite still green. A constraint nobody asserts is a
  // constraint that is believed rather than checked, which is the whole
  // defect this file was written against.

  it.each(['DETECTED_CONFIRMED', 'DETECTED_CORRECTED'] as const)(
    'refuses %s with no detectedKind',
    async (provenance) => {
      const userId = await aUser();

      const message = await rejection(
        prisma.entry.create({
          data: {
            userId,
            dayDate: new Date('2026-03-10'),
            kind: 'HOME',
            provenance,
            clientMutationId: `detected-no-proposal-${provenance}`,
          },
        }),
      );

      expect(message).toContain('Entry_detectedKind_when_detected');
    },
  );

  it('accepts a correction that discloses what was proposed', async () => {
    // The row SPEC 8 describes in full: detection said Switzerland, the
    // reader said home, and both are on the record.
    const userId = await aUser();

    const entry = await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date('2026-03-11'),
        kind: 'HOME',
        provenance: 'DETECTED_CORRECTED',
        detectedKind: 'CH',
        detectedAt: new Date('2026-03-11T18:02:00Z'),
        clientMutationId: 'corrected-with-proposal',
      },
    });

    expect(entry.kind).toBe('HOME');
    expect(entry.detectedKind).toBe('CH');
  });

  it('accepts a MANUAL day, which had no proposal to keep', async () => {
    // The constraint is deliberately one-directional. MANUAL means the reader
    // chose outright, so there is nothing to disclose - and SPEC does not
    // state the reverse rule, so the database does not invent it. See
    // REPORT-FW21.txt QUESTIONS.
    const userId = await aUser();

    const entry = await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date('2026-03-12'),
        kind: 'CH',
        clientMutationId: 'manual-no-proposal',
      },
    });

    expect(entry.provenance).toBe('MANUAL');
    expect(entry.detectedKind).toBeNull();
  });
});

describe('one row per person per portion of a day', () => {
  it('refuses a second FULL entry for the same day', async () => {
    // THE CASE THIS PREVENTS IS A RETRY, not a user mistake. An Android
    // client that posts, loses the response and posts again would otherwise
    // put two rows on one day - and the ratio this whole product computes is
    // a count of days.
    const userId = await aUser();

    await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date('2026-04-07'),
        kind: 'CH',
        clientMutationId: 'first-post',
      },
    });

    const message = await rejection(
      prisma.entry.create({
        data: {
          userId,
          dayDate: new Date('2026-04-07'),
          kind: 'HOME',
          clientMutationId: 'second-post',
        },
      }),
    );

    expect(message).toMatch(/userId.*dayDate.*portion|Entry_userId_dayDate_portion_key/s);
  });

  it('accepts AM and PM on the same day, and the same day for two people', async () => {
    // THE CONSTRAINT MUST NOT BE (userId, dayDate). A half-day pair is the
    // shape D9 exists for, and a person working a morning in Geneva and an
    // afternoon at home is exactly what the threshold is about.
    const one = await aUser({ granularity: 'HALF_DAY' });
    const two = await aUser({ granularity: 'HALF_DAY' });

    const rows = await Promise.all([
      prisma.entry.create({
        data: {
          userId: one,
          dayDate: new Date('2026-04-08'),
          portion: 'AM',
          kind: 'CH',
          clientMutationId: 'one-am',
        },
      }),
      prisma.entry.create({
        data: {
          userId: one,
          dayDate: new Date('2026-04-08'),
          portion: 'PM',
          kind: 'HOME',
          clientMutationId: 'one-pm',
        },
      }),
      prisma.entry.create({
        data: {
          userId: two,
          dayDate: new Date('2026-04-08'),
          kind: 'CH',
          clientMutationId: 'two-full',
        },
      }),
    ]);

    expect(rows).toHaveLength(3);
  });
});

describe('clientMutationId deduplicates a replayed batch (D30)', () => {
  it('refuses a second row with an id already seen', async () => {
    // SPEC 8: "a replayed batch containing an already-seen id is acknowledged
    // and ignored". FW23 will do the acknowledging; this is what stands
    // behind it when two copies of the batch arrive at once and both pass
    // that check.
    const userId = await aUser();

    await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date('2026-05-11'),
        kind: 'CH',
        clientMutationId: 'a-replayed-uuid',
      },
    });

    const message = await rejection(
      prisma.entry.create({
        data: {
          userId,
          dayDate: new Date('2026-05-12'),
          kind: 'CH',
          clientMutationId: 'a-replayed-uuid',
        },
      }),
    );

    expect(message).toMatch(/clientMutationId/);
  });
});

describe('a day is a day', () => {
  it('stores dayDate as a DATE column, not a timestamp', async () => {
    // SPEC 8: "Day boundaries and reminder times are computed in
    // Europe/Paris ... A UTC day-boundary bug here is a wrong record."
    //
    // A timestamp column would make the day a reader recorded depend on the
    // offset of whatever wrote it: 2026-04-07 in Paris is 2026-04-06T22:00Z,
    // and a naive read gives back the sixth. The column type is the only
    // place this can be settled once; everything above it is a convention
    // somebody has to remember.
    //
    // IT ASKS EVERY TABLE, not Entry alone, because EntryEvent carries a
    // dayDate too and the audit trail disagreeing with the row it records
    // would be worse than either being wrong on its own.
    const columns = await prisma.$queryRaw<{ table_name: string; data_type: string }[]>`
      SELECT table_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'dayDate'
      ORDER BY table_name
    `;

    expect(columns.length).toBeGreaterThan(0);

    for (const column of columns) {
      expect(`${column.table_name}: ${column.data_type}`).toBe(`${column.table_name}: date`);
    }
  });

  it('assigns firstRecordedAt from the server clock, with no help from the caller', async () => {
    // The evidence claim in one assertion: nothing was passed, and the row
    // came back stamped. FW23 is where "no API path accepts a client
    // recordedAt" gets enforced; this is the default it stands on.
    const before = Date.now();
    const userId = await aUser();

    const entry = await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date('2026-06-01'),
        kind: 'CH',
        clientMutationId: 'server-stamped',
      },
    });

    expect(entry.firstRecordedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(entry.firstRecordedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe('Entry.clientMutationId is unique within the account, not globally (R220)', () => {
  // ============================================================================
  // ASSERTED IN THE DATABASE, NOT INFERRED FROM BEHAVIOUR
  // ============================================================================
  //
  // The two tests below prove what the INDEX permits and refuses. They are not
  // a second copy of the route tests: those prove the write path behaves
  // correctly, and this proves the database would still refuse a bad row
  // written by something that is not the write path - a seed, a migration, a
  // future admin script (R196).
  //
  // It was `@unique` globally. `clientMutationId` is the CLIENT's own id, so a
  // global namespace meant two devices generating UUIDs independently could
  // collide and the second account's legitimate write was refused. A key the
  // client issues is unique within the account that issued it.

  it('permits two accounts to hold the same client-generated id', async () => {
    const first = await prisma.user.create({ data: { email: 'r220-a@example.com' } });
    const second = await prisma.user.create({ data: { email: 'r220-b@example.com' } });

    const shared = 'r220-shared-id';

    await prisma.entry.create({
      data: {
        userId: first.id,
        dayDate: new Date('2026-04-07T00:00:00.000Z'),
        portion: 'FULL',
        kind: 'CH',
        clientMutationId: shared,
        firstRecordedAt: new Date(),
      },
    });

    // THE ONE THE OLD INDEX REFUSED. Written straight to the database, so the
    // claim is about the CONSTRAINT rather than about the route.
    await expect(
      prisma.entry.create({
        data: {
          userId: second.id,
          dayDate: new Date('2026-04-07T00:00:00.000Z'),
          portion: 'FULL',
          kind: 'HOME',
          clientMutationId: shared,
          firstRecordedAt: new Date(),
        },
      }),
    ).resolves.toBeDefined();

    expect(await prisma.entry.count({ where: { clientMutationId: shared } })).toBe(2);
  });

  it('still refuses the SAME account holding it twice', async () => {
    // BOTH DIRECTIONS, and this is the half that says the index was scoped
    // rather than dropped. A migration that deleted the constraint outright
    // would pass the test above perfectly.
    const owner = await prisma.user.create({ data: { email: 'r220-c@example.com' } });
    const shared = 'r220-own-id';

    await prisma.entry.create({
      data: {
        userId: owner.id,
        dayDate: new Date('2026-04-07T00:00:00.000Z'),
        portion: 'FULL',
        kind: 'CH',
        clientMutationId: shared,
        firstRecordedAt: new Date(),
      },
    });

    await expect(
      prisma.entry.create({
        data: {
          userId: owner.id,
          // A DIFFERENT DAY, so the (userId, dayDate, portion) key cannot be
          // what refuses it - otherwise this test would pass for the wrong
          // reason and say nothing about the id at all.
          dayDate: new Date('2026-04-08T00:00:00.000Z'),
          portion: 'FULL',
          kind: 'HOME',
          clientMutationId: shared,
          firstRecordedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/Entry_userId_clientMutationId_key|Unique constraint/u);
  });
});
