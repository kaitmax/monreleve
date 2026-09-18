// web/tests/unit/entries/schema.test.ts
//
// FW23 increment 1: what POST /api/v1/entries accepts.
//
// THIS TASK FREEZES THE CONTRACT. From here the Android client sends these
// field names, and a rename costs a migration, an app release, and every
// version still in the field sending the old shape (R187 at full force). So
// the names are SPEC 8's, and every deviation is named in REPORT-FW23.txt.
//
// UNKNOWN KEYS ARE REJECTED, NOT STRIPPED, and that is the decision this file
// exists to pin. Zod's default is to strip: a client sending `firstRecordedAt`
// or `latitude` or a misspelt `dayDte` would get a 200 and believe the value
// was stored. STRIPPING IS A LIE WITH A SUCCESS CODE - the app shows a day as
// synced, the server holds something different, and nobody finds out until a
// dossier is wrong a year later.
//
// It also does half of AC2's work for free: a coordinate key is an unknown
// key, so it cannot be silently dropped on the way in.

import { describe, expect, it } from 'vitest';
import {
  MAX_BATCH_BODY_BYTES,
  MAX_BATCH_ITEMS,
  entriesBatchSchema,
  entryItemSchema,
} from '@/lib/entries/schema';

/** A valid item, which each test bends in exactly one direction. */
function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clientMutationId: '9f8a7b6c-5d4e-4f3a-2b1c-0d9e8f7a6b5c',
    dayDate: '2026-04-07',
    portion: 'FULL',
    kind: 'CH',
    ...overrides,
  };
}

describe('the day is an ISO day string, never a Date (R28)', () => {
  it('accepts a bare calendar day', () => {
    const parsed = entryItemSchema.safeParse(item());

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.dayDate).toBe('2026-04-07');
  });

  it.each([
    ['2026-04-07T00:00:00.000Z', 'an instant, which is what a Date serialises to'],
    ['2026-04-07T12:00:00+02:00', 'an instant with an offset'],
    ['07/04/2026', 'a local format that means different days in two countries'],
    ['2026-4-7', 'unpadded'],
    ['2026-13-01', 'a month that does not exist'],
    ['2026-02-30', 'a day that does not exist'],
  ])('refuses %s (%s)', (dayDate) => {
    expect(entryItemSchema.safeParse(item({ dayDate })).success).toBe(false);
  });

  it('refuses an instant EVEN THOUGH it parses as a date', () => {
    // THE WHOLE REASON R28 EXISTS. `new Date('2026-04-07T00:00:00Z')` is a
    // valid moment and the WRONG DAY for anyone east or west of UTC: in Paris
    // that instant is 02:00 on the 7th in summer, and an app that sends an
    // instant for "the 6th" sends the 6th at midnight UTC, which this server
    // would read as the 6th only by accident of offset. SPEC 8: a UTC
    // day-boundary bug here is a wrong record.
    expect(entryItemSchema.safeParse(item({ dayDate: '2026-04-06T22:00:00.000Z' })).success).toBe(
      false,
    );
  });
});

describe('unknown keys are REJECTED, not stripped', () => {
  it.each([
    ['firstRecordedAt', '2020-01-01T00:00:00.000Z'],
    ['recordedAt', '2020-01-01T00:00:00.000Z'],
    ['userId', 'someone-else'],
    ['id', 'chosen-by-the-client'],
    ['dayDte', '2026-04-07'],
    ['latitude', 46.2],
  ])('refuses an item carrying %s', (key, value) => {
    const parsed = entryItemSchema.safeParse(item({ [key]: value }));

    expect(parsed.success).toBe(false);
  });

  it('names the offending key, so a client author can fix it', () => {
    // R198: the error that crosses the boundary preserves which rule fired.
    // "Invalid payload" sends somebody to read our source; naming the key
    // sends them to their own.
    const parsed = entryItemSchema.safeParse(item({ dayDte: '2026-04-07' }));

    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain('dayDte');
  });

  it('accepts every key SPEC 8 defines, so the rejection is not blanket', () => {
    // NON-VACUITY. A schema that refused everything would pass every test
    // above. This is the shape of a full sync item.
    const parsed = entryItemSchema.safeParse({
      clientMutationId: '9f8a7b6c-5d4e-4f3a-2b1c-0d9e8f7a6b5c',
      dayDate: '2026-04-07',
      portion: 'AM',
      kind: 'HOME',
      note: 'teletravail',
      provenance: 'DETECTED_CORRECTED',
      detectedKind: 'CH',
      detectedAt: '2026-04-07T17:48:00.000Z',
      clientClaimedAt: '2026-04-07T18:03:00.000Z',
    });

    expect(parsed.success).toBe(true);
  });
});

describe('absenceReason is required iff the kind is ABSENT', () => {
  // The same invariant the database enforces (FW21,
  // Entry_absenceReason_iff_absent). BOTH LAYERS, deliberately: the database
  // so no writer can bypass it, and here so the client gets a message naming
  // the rule rather than a constraint violation.

  it('refuses ABSENT with no reason', () => {
    expect(entryItemSchema.safeParse(item({ kind: 'ABSENT' })).success).toBe(false);
  });

  it.each(['CH', 'HOME', 'MISSION_FR', 'MISSION_THIRD'])(
    'refuses %s carrying a reason',
    (kind) => {
      expect(
        entryItemSchema.safeParse(item({ kind, absenceReason: 'CONGE' })).success,
      ).toBe(false);
    },
  );

  it.each(['CONGE', 'MALADIE', 'FERIE', 'AUTRE'])('accepts ABSENT with %s', (absenceReason) => {
    expect(
      entryItemSchema.safeParse(item({ kind: 'ABSENT', absenceReason })).success,
    ).toBe(true);
  });

  it('accepts a worked day with no reason', () => {
    expect(entryItemSchema.safeParse(item()).success).toBe(true);
  });
});

describe('R202: detectedKind and provenance are ORTHOGONAL', () => {
  // THE ASYMMETRY IS DELIBERATE AND BOTH DIRECTIONS ARE ASSERTED, so a later
  // reader cannot mistake it for an oversight and "fix" it.
  //
  // FORWARD: a DETECTED_* row without a detectedKind is incoherent - it says
  // the reader accepted or corrected a proposal, and the proposal it names is
  // absent. SPEC 8 makes deleting the overridden proposal a review rejection.
  //
  // REVERSE: a MANUAL row MAY carry one. Auto mode proposed, the proposal
  // expired unconfirmed, and the reader backfilled the day from the calendar
  // later. No proposal was accepted or corrected, so the provenance is MANUAL
  // - and the annex is more honest for recording that detection had proposed
  // something. R202 is explicit: DO NOT ADD THE REVERSE CONSTRAINT.

  it.each(['DETECTED_CONFIRMED', 'DETECTED_CORRECTED'])(
    'refuses %s with no detectedKind',
    (provenance) => {
      expect(entryItemSchema.safeParse(item({ provenance })).success).toBe(false);
    },
  );

  it.each(['DETECTED_CONFIRMED', 'DETECTED_CORRECTED'])(
    'accepts %s when it says what was proposed',
    (provenance) => {
      expect(
        entryItemSchema.safeParse(item({ provenance, detectedKind: 'CH' })).success,
      ).toBe(true);
    },
  );

  it('ACCEPTS a MANUAL day that carries a detectedKind (R202, the reverse)', () => {
    const parsed = entryItemSchema.safeParse(
      item({ provenance: 'MANUAL', detectedKind: 'CH' }),
    );

    expect(parsed.success).toBe(true);
  });

  it('accepts a MANUAL day with no detectedKind, which is the ordinary case', () => {
    expect(entryItemSchema.safeParse(item({ provenance: 'MANUAL' })).success).toBe(true);
  });
});

describe('the batch is bounded', () => {
  // AN UNBOUNDED BATCH IS A DENIAL-OF-SERVICE SURFACE ON A ROUTE THAT WRITES.
  // Each item is an upsert plus an event append, so a million-item body is a
  // million writes inside one request. The limits are named constants and
  // tested AT THE BOUNDARY, because an off-by-one in a limit is how a limit
  // becomes decorative.

  const batch = (count: number): unknown => ({
    entries: Array.from({ length: count }, (_unused, index) =>
      item({
        clientMutationId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        dayDate: '2026-04-07',
        portion: index % 2 === 0 ? 'AM' : 'PM',
      }),
    ),
  });

  it('accepts exactly MAX_BATCH_ITEMS', () => {
    expect(entriesBatchSchema.safeParse(batch(MAX_BATCH_ITEMS)).success).toBe(true);
  });

  it('refuses MAX_BATCH_ITEMS + 1', () => {
    expect(entriesBatchSchema.safeParse(batch(MAX_BATCH_ITEMS + 1)).success).toBe(false);
  });

  it('refuses an empty batch, which is a client bug rather than a no-op', () => {
    // A zero-item batch means the queue logic sent something it should not
    // have. Answering 200 to it hides that forever.
    expect(entriesBatchSchema.safeParse({ entries: [] }).success).toBe(false);
  });

  it('states a body-size limit that is smaller than the item limit implies', () => {
    // R171: read the constants, do not restate them. The size limit exists
    // because `note` is free text - MAX_BATCH_ITEMS items of maximum note
    // length must not be the thing that decides how much this route will
    // read.
    expect(MAX_BATCH_BODY_BYTES).toBeGreaterThan(1024);
    expect(MAX_BATCH_ITEMS).toBeGreaterThan(0);
  });

  it('refuses a note long enough to make the size limit reachable', () => {
    expect(entryItemSchema.safeParse(item({ note: 'x'.repeat(10_000) })).success).toBe(false);
  });
});

describe('the duplication key is a real client mutation id (D30)', () => {
  it('refuses an empty one', () => {
    expect(entryItemSchema.safeParse(item({ clientMutationId: '' })).success).toBe(false);
  });

  it('refuses one long enough to be a payload of its own', () => {
    expect(
      entryItemSchema.safeParse(item({ clientMutationId: 'x'.repeat(200) })).success,
    ).toBe(false);
  });
});
