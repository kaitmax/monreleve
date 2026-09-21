// web/tests/db/demo-year.test.ts
//
// FW21 / AC3: `pnpm db:seed` produces the demo year, and the demo year
// contains the cases it exists for.
//
// IT RUNS THE REAL COMMAND. beforeAll shells out to `pnpm db:seed` rather than
// importing a function out of the seed file, because AC3 is about the command
// - and a seed that works when called directly and fails through the CLI is a
// seed nobody can use. R154: the mechanism is proven to deliver.
//
// IT SEEDS ITSELF RATHER THAN TRUSTING THE DATABASE IT FINDS. The other files
// in tests/db empty User between tests, so a demo year seeded by hand
// beforehand would be gone by the time this ran - and the suite would then be
// asserting against whatever happened to survive, in whatever order vitest
// chose. Seeding here makes the file independent of that order.
//
// WHY THESE CASES AND NOT A ROW COUNT. Every assertion below names a defect
// that a fixture without it would hide: a renderer that conflates an absence
// with a gap, one that flags every entry as late, one that reads the client's
// timestamp instead of the server's, one that drops the proposal a reader
// overrode. A count of 261 entries would pass against a year of identical
// Mondays.

import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import type { Entry } from '@prisma/client';
import { writeEntries } from '@/lib/entries/write';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_YEAR = 2026;

/** The working day the fixture deliberately leaves unrecorded. */
const GAP = '2026-06-17';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

let userId = '';
let entries: Entry[] = [];

beforeAll(async () => {
  execFileSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'db', 'seed'],
    { encoding: 'utf8', stdio: 'pipe' },
  );

  const user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });

  userId = user.id;
  entries = await prisma.entry.findMany({
    where: { userId },
    orderBy: [{ dayDate: 'asc' }, { portion: 'asc' }],
  });
}, 180_000);

afterAll(async () => {
  await prisma.$disconnect();
});

function on(date: string): Entry[] {
  return entries.filter((entry) => entry.dayDate.toISOString().startsWith(date));
}

describe('the demo year exists at all', () => {
  it('is seeded for one person, in the fixed demo year', () => {
    // WITHOUT THIS every assertion below is satisfied by an empty year: "no
    // entry is missing a reason" holds when there are no entries. R169's
    // corollary - an absence assertion means nothing until presence is
    // established.
    expect(entries.length).toBeGreaterThan(200);

    for (const entry of entries) {
      expect(entry.dayDate.getUTCFullYear()).toBe(DEMO_YEAR);
    }
  });

  it('records no weekend', () => {
    for (const entry of entries) {
      const weekday = entry.dayDate.getUTCDay();

      expect(`${entry.dayDate.toISOString().slice(0, 10)} weekday ${weekday}`).not.toMatch(
        /weekday [06]$/,
      );
    }
  });
});

describe('every provenance value appears', () => {
  // A fixture with only MANUAL entries cannot tell a dossier that renders
  // provenance from one that ignores it - SPEC 8 requires it rendered in the
  // calendar cell, the edit sheet, the annex, the CSV and the PDF.
  it.each(['MANUAL', 'DETECTED_CONFIRMED', 'DETECTED_CORRECTED'] as const)(
    'has at least one %s entry',
    (provenance) => {
      expect(entries.filter((entry) => entry.provenance === provenance).length).toBeGreaterThan(0);
    },
  );

  it('keeps the proposal on a corrected day', () => {
    // SPEC 8: "Whenever a proposal existed, detectedKind is stored EVEN WHEN
    // THE USER OVERRODE IT." The fixture has to contain the row where the two
    // differ, or a renderer that shows detectedKind in place of kind looks
    // right.
    const corrected = entries.filter((entry) => entry.provenance === 'DETECTED_CORRECTED');

    expect(corrected.length).toBeGreaterThan(0);

    for (const entry of corrected) {
      expect(entry.detectedKind).not.toBeNull();
      expect(entry.detectedKind).not.toBe(entry.kind);
    }
  });

  it('keeps the proposal on a confirmed day, where it agrees', () => {
    const confirmed = entries.filter((entry) => entry.provenance === 'DETECTED_CONFIRMED');

    expect(confirmed.length).toBeGreaterThan(0);

    for (const entry of confirmed) {
      expect(entry.detectedKind).toBe(entry.kind);
    }
  });
});

describe('the year agrees with the person it belongs to', () => {
  // THE WALKTHROUGH FOUND THIS AND NOTHING ELSE COULD HAVE. The first version
  // of the fixture gave the demo user AUTO_DETECT with consent recorded on 2
  // January, and wrote 259 of 261 days as MANUAL: somebody who switched
  // detection on and then typed every day by hand for a year.
  //
  // Both halves were valid. Every test passed. The contradiction existed only
  // BETWEEN the settings and the entries - the shape R172 was written for, one
  // subject over - and it mattered because this fixture is what FW24, FW25 and
  // FW27 render. Against 259 identical MANUAL rows, a dossier that ignored
  // provenance entirely would have looked very nearly right.

  it('proposes on most worked days, because detection is switched on', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });

    expect(user.loggingMode).toBe('AUTO_DETECT');
    expect(user.detectionConsentAt).not.toBeNull();

    const worked = entries.filter((entry) => entry.kind !== 'ABSENT');
    const proposed = worked.filter((entry) => entry.detectedKind !== null);

    expect(proposed.length * 2).toBeGreaterThan(worked.length);
  });

  it('never proposes an absence', () => {
    // Detection knows which country the phone was in. It cannot propose a
    // reason somebody was away, so an absence carrying a detectedKind is a
    // fixture describing a capability the product does not have.
    for (const entry of entries.filter((candidate) => candidate.kind === 'ABSENT')) {
      expect(entry.detectedKind).toBeNull();
      expect(entry.provenance).toBe('MANUAL');
    }
  });

  it('still keeps manual days, so the three provenances are all real cases', () => {
    // The correction above must not swing the other way: a year where every
    // single day is detected cannot tell a renderer that handles MANUAL from
    // one that has never met it.
    expect(entries.filter((entry) => entry.provenance === 'MANUAL').length).toBeGreaterThan(3);
  });
});

describe('both sides of the late flag', () => {
  // SPEC 8: late is derived, firstRecordedAt - dayDate > 7 days, "uncomfortable
  // by design". A fixture with only late entries passes a renderer that flags
  // everything; one with only punctual entries passes a renderer that flags
  // nothing.
  const lateness = (entry: Entry): number => entry.firstRecordedAt.getTime() - entry.dayDate.getTime();

  it('contains at least one entry recorded more than seven days late', () => {
    expect(entries.filter((entry) => lateness(entry) > SEVEN_DAYS).length).toBeGreaterThan(0);
  });

  it('contains entries recorded on time', () => {
    expect(entries.filter((entry) => lateness(entry) <= SEVEN_DAYS).length).toBeGreaterThan(0);
  });
});

describe('an entry that was written offline', () => {
  it('claims a time earlier than the server recorded', () => {
    // SPEC 8: "the server stores BOTH the client-claimed date/time and the
    // server receipt time, and the dossier shows both". Where they agree, a
    // renderer reading the wrong one is indistinguishable from one reading the
    // right one - so the fixture needs a row where they cannot agree.
    const synced = entries.filter((entry) => entry.clientClaimedAt !== null);

    expect(synced.length).toBeGreaterThan(0);

    for (const entry of synced) {
      expect(entry.clientClaimedAt).not.toBeNull();
      expect(entry.clientClaimedAt!.getTime()).toBeLessThan(entry.firstRecordedAt.getTime());
    }
  });
});

describe('absences, which are records rather than gaps', () => {
  it.each(['CONGE', 'MALADIE', 'FERIE', 'AUTRE'] as const)('has one absence for %s', (reason) => {
    expect(entries.filter((entry) => entry.absenceReason === reason)).toHaveLength(1);
  });

  it('gives every absence a reason and no worked day one', () => {
    for (const entry of entries) {
      if (entry.kind === 'ABSENT') {
        expect(entry.absenceReason).not.toBeNull();
      } else {
        expect(entry.absenceReason).toBeNull();
      }
    }
  });
});

describe('one working day with no entry at all', () => {
  it(`records nothing for ${GAP}`, () => {
    // "Non renseigne" and "declared absent" are different facts and the
    // dossier shows them differently. A fixture with no gap lets a renderer
    // conflate them and stay green.
    expect(on(GAP)).toHaveLength(0);
  });

  it('and that day is a working day, which is what makes it a gap', () => {
    // WITHOUT THIS the test above is satisfied by naming a Sunday. The gap has
    // to be a day an entry was expected on.
    const weekday = new Date(`${GAP}T00:00:00.000Z`).getUTCDay();

    expect(weekday).not.toBe(0);
    expect(weekday).not.toBe(6);
  });
});

describe('a half-day pair', () => {
  it('splits one date into a morning and an afternoon of different kinds', () => {
    const pairs = entries.filter((entry) => entry.portion !== 'FULL');

    expect(pairs).toHaveLength(2);

    const [am, pm] = pairs;

    expect(am?.portion).toBe('AM');
    expect(pm?.portion).toBe('PM');
    expect(am?.dayDate.toISOString()).toBe(pm?.dayDate.toISOString());
    // DIFFERENT KINDS, or the pair proves nothing: a morning and an afternoon
    // both in Switzerland count the same as one full day there, and a
    // calculation that ignored portion entirely would still be right.
    expect(am?.kind).not.toBe(pm?.kind);
  });
});

describe('the append-only trail', () => {
  it('holds a superseded value the entry no longer shows', async () => {
    // The product's main interaction is correcting a day. SPEC 8: the edit
    // updates Entry.kind - latest wins - and APPENDS an event. The fixture has
    // to contain a day where the trail and the row disagree, or a dossier that
    // renders the trail by reading the current row looks correct.
    const events = await prisma.entryEvent.findMany({
      where: { userId },
      orderBy: { recordedAt: 'asc' },
    });

    const byEntry = new Map<string, typeof events>();

    for (const event of events) {
      byEntry.set(event.entryId, [...(byEntry.get(event.entryId) ?? []), event]);
    }

    const edited = [...byEntry.values()].filter((trail) => trail.length > 1);

    expect(edited.length).toBeGreaterThan(0);

    for (const trail of edited) {
      const created = trail.find((event) => event.action === 'CREATED');
      const modified = trail.find((event) => event.action === 'MODIFIED');
      const entry = entries.find((candidate) => candidate.id === trail[0]?.entryId);

      expect(created).toBeDefined();
      expect(modified).toBeDefined();
      expect(created?.kind).not.toBe(modified?.kind);
      // The row shows the latest, and the trail still holds what it replaced.
      expect(entry?.kind).toBe(modified?.kind);
      expect(entry?.kind).not.toBe(created?.kind);
    }
  });

  it('gives every entry a CREATED event stamped when the server first heard', async () => {
    const created = await prisma.entryEvent.findMany({
      where: { userId, action: 'CREATED' },
    });

    expect(created).toHaveLength(entries.length);

    const stamps = new Map(entries.map((entry) => [entry.id, entry.firstRecordedAt.getTime()]));

    for (const event of created) {
      expect(event.recordedAt.getTime()).toBe(stamps.get(event.entryId));
    }
  });
});

describe('R120: two derivations of one figure, and they disagree', () => {
  // The FW12 tile defect: a figure two code paths computed differently, in a
  // fixture where both happened to agree, so the test passed using the wrong
  // one. This asserts the fixture cannot do that - not that the figures are
  // any particular value.
  const weight = (entry: Entry): number => (entry.portion === 'FULL' ? 1 : 0.5);

  it('telework rows and telework days cannot be confused', () => {
    const rows = entries.filter((entry) => entry.kind === 'HOME').length;
    const days = entries
      .filter((entry) => entry.kind === 'HOME')
      .reduce((total, entry) => total + weight(entry), 0);

    expect(rows).not.toBe(days);
  });

  it('total entries and worked days cannot be confused', () => {
    const total = entries.length;
    const worked = entries
      .filter((entry) => entry.kind !== 'ABSENT')
      .reduce((total_, entry) => total_ + weight(entry), 0);

    expect(total).not.toBe(worked);
  });
});

describe('the seed refuses a database it was not meant for', () => {
  it('will not run against a non-local host', () => {
    // FW14's precedent, re-asserted because the seed now writes a year of a
    // person's movements rather than four invented addresses. The cost of
    // pointing it at the wrong database went up with this increment.
    let failure = '';

    try {
      execFileSync(process.execPath, ['--experimental-strip-types', 'prisma/seed.ts'], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: {
          ...process.env,
          DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/frontalier',
        },
      });
    } catch (error) {
      failure = error instanceof Error ? `${error.message}${String((error as { stderr?: string }).stderr ?? '')}` : String(error);
    }

    expect(failure).toContain('Refusing to seed a non-local database');
    expect(failure).toContain('db.example.com');
  });
});

describe('R222: the trail carries both eras, because a real database does', () => {
  // R219 gave EntryEvent a clientMutationId and could not backfill it - the id
  // on a legacy event's Entry is the LAST write's, not the one that created it.
  // So every real database has a long stretch whose events carry no id and a
  // recent stretch whose events do, and a fixture with only one of them is
  // unrealistic in a way that matters: only the mixed version exercises BOTH
  // duplicate-detection paths.

  it('has a legacy stretch AND a modern one, neither of them empty', async () => {
    // BOTH DIRECTIONS, and each is the other's non-vacuity guard. A seed that
    // populated everything would pass a "modern exists" test; one that
    // populated nothing would pass a "legacy exists" test. Only the pair says
    // the fixture is mixed.
    const modern = await prisma.entryEvent.count({
      where: { userId, clientMutationId: { not: null } },
    });
    const legacy = await prisma.entryEvent.count({
      where: { userId, clientMutationId: null },
    });

    expect(modern, 'no modern events - the trail path is not exercised').toBeGreaterThan(10);
    expect(legacy, 'no legacy events - the fallback is not exercised').toBeGreaterThan(100);
  });

  it('reads the id from the row rather than deriving it twice', async () => {
    // R181: a second derivation of one value is the defect, and it would be
    // invisible here because both derivations would look right. The event's id
    // must BE the entry's, not a string built from the same template.
    const events = await prisma.entryEvent.findMany({
      where: { userId, clientMutationId: { not: null } },
      select: { entryId: true, clientMutationId: true },
    });

    expect(events.length).toBeGreaterThan(10);

    for (const event of events) {
      const row = await prisma.entry.findUniqueOrThrow({ where: { id: event.entryId } });

      expect(event.clientMutationId).toBe(row.clientMutationId);
    }
  });

  it('keeps the EDITED day in the legacy stretch, which is the point of it', async () => {
    // 2026-07-07 is the day the fixture edits, so its Entry.clientMutationId
    // has been overwritten by the second mutation. That is R219's exact
    // scenario, and keeping it legacy means the Entry fallback is exercised
    // against a row whose evidence the old check would have destroyed.
    const events = await prisma.entryEvent.findMany({
      where: { userId, dayDate: new Date('2026-07-07T00:00:00.000Z') },
      orderBy: { recordedAt: 'asc' },
    });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.action)).toEqual(['CREATED', 'MODIFIED']);

    for (const event of events) {
      expect(event.clientMutationId).toBeNull();
    }
  });

  it('recognises a replay of a LEGACY mutation, through the Entry fallback', async () => {
    // THE FIXTURE EXERCISING R219, rather than R219's own test exercising a
    // fixture built for it. This is the path that has no trail to consult.
    const legacyRow = await prisma.entry.findFirstOrThrow({
      where: { userId, dayDate: { lt: new Date('2026-12-01T00:00:00.000Z') } },
      orderBy: { dayDate: 'asc' },
    });

    const result = await writeEntries(userId, [
      {
        clientMutationId: legacyRow.clientMutationId,
        dayDate: legacyRow.dayDate.toISOString().slice(0, 10),
        portion: legacyRow.portion,
        kind: 'MISSION_FR',
        provenance: 'MANUAL',
      },
    ]);

    expect(result.written).toBe(0);
    expect(result.duplicates).toBe(1);

    // AND THE DAY IS UNTOUCHED - the count alone would pass against a route
    // that reported 0 and wrote anyway.
    const after = await prisma.entry.findUniqueOrThrow({ where: { id: legacyRow.id } });

    expect(after.kind).toBe(legacyRow.kind);
  });

  it('recognises a replay of a MODERN mutation, through the trail', async () => {
    const modernRow = await prisma.entry.findFirstOrThrow({
      where: { userId, dayDate: { gte: new Date('2026-12-01T00:00:00.000Z') } },
      orderBy: { dayDate: 'asc' },
    });

    const result = await writeEntries(userId, [
      {
        clientMutationId: modernRow.clientMutationId,
        dayDate: modernRow.dayDate.toISOString().slice(0, 10),
        portion: modernRow.portion,
        kind: 'MISSION_FR',
        provenance: 'MANUAL',
      },
    ]);

    expect(result.written).toBe(0);
    expect(result.duplicates).toBe(1);

    const after = await prisma.entry.findUniqueOrThrow({ where: { id: modernRow.id } });

    expect(after.kind).toBe(modernRow.kind);
  });
});
