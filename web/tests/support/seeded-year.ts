// web/tests/support/seeded-year.ts
//
// THE SEEDED YEAR, ONE HOME (R206, R986). FW-DOSSIER-ENGINE wrote it inside
// tests/db/dossier-engine.test.ts, where it proved the dossier PAYLOAD against
// a direct engine call. FW-ANNEX-RENDERED reads the same year back from the
// RENDERED document (tests/db/annex-rendered.test.ts). Two tests asserting one
// year from two sides need one year: a second copy of the table would be a
// second seed that can drift from the first while both files stay green.
//
// What lives here: the person, the rows, the calendar of the year, and the
// act of writing them. What does NOT: each test's own reading of the rows
// (dossier-engine.test.ts's engine derivation, annex-rendered.test.ts's
// column reading). Those are the assertions, and they stay with their tests.
//
// It deletes nothing. Each caller empties the tables it owns before seeding,
// as every tests/db file does.
//
// It is not a .test.ts file, so no include glob collects it. It imports the
// Prisma client, so R218's import closure selects test:db when it changes.

import { prisma } from '@/lib/db/client';

/** The seeded year. 2026 has a RuleSet of its own, so no fallback warning. */
export const YEAR = 2026;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type Kind = 'CH' | 'HOME' | 'MISSION_FR' | 'MISSION_THIRD' | 'ABSENT';
export type Portion = 'FULL' | 'AM' | 'PM';
export type Provenance = 'MANUAL' | 'DETECTED_CONFIRMED' | 'DETECTED_CORRECTED';
type Reason = 'CONGE' | 'MALADIE' | 'FERIE' | 'AUTRE';

/**
 * The person. NON-DEFAULT settings on purpose: a dossier that ignored the
 * person's rate or granularity and computed a 100 %, whole-day year would
 * agree with an engine called on the defaults. 80 % makes the basis 192 and
 * the mission cap 8; HALF_DAY lets a day be split.
 */
export const PERSON = {
  email: 'dossier-engine@example.com',
  name: 'Camille Rey',
  canton: 'GE',
  employmentRate: 80,
  granularity: 'HALF_DAY',
  denominatorKind: 'SIMPLIFIED240',
} as const;

/** One seeded row, and everything the annex must say back about it. */
export interface SeedRow {
  /** The stored @db.Date, as an ISO day. */
  readonly day: string;
  readonly portion: Portion;
  readonly kind: Kind;
  readonly absenceReason: Reason | null;
  readonly provenance: Provenance;
  readonly detectedKind: Kind | null;
  readonly note: string | null;
  /** The server's first-receipt stamp, as written. Distinct on every row. */
  readonly firstRecordedAt: string;
  readonly clientClaimedAt: string | null;
  /** The recordedAt of a MODIFIED event seeded for this row, or null. */
  readonly lastModifiedAt: string | null;
  /**
   * SPEC 11.3, typed rather than computed: the value IS the assertion (R171).
   * True on exactly one row, recorded fifteen days after its day.
   */
  readonly late: boolean;
}

/** A row with the defaults every ordinary day shares; the stamp is per portion. */
function row(day: string, portion: Portion, kind: Kind, extra: Partial<SeedRow> = {}): SeedRow {
  return {
    day,
    portion,
    kind,
    absenceReason: null,
    provenance: 'MANUAL',
    detectedKind: null,
    note: null,
    // AM at 12:30, PM and FULL at 18:05: distinct within a day, and every day
    // is distinct, so no two rows share a stamp (asserted by both tests'
    // PRESENCE FIRST checks).
    firstRecordedAt: `${day}T${portion === 'AM' ? '12:30' : '18:05'}:00.000Z`,
    clientClaimedAt: null,
    lastModifiedAt: null,
    late: false,
    ...extra,
  };
}

const PROVENANCE_CYCLE: readonly Provenance[] = ['MANUAL', 'DETECTED_CONFIRMED', 'DETECTED_CORRECTED'];

/**
 * Seven ordinary weeks, 9 February to 27 March: Monday and Tuesday at home,
 * Wednesday to Friday in Geneva, the three provenances in turn. Detection
 * proposes only CH or HOME, so a corrected day's proposal is the other one.
 */
function ordinaryWeeks(): SeedRow[] {
  const rows: SeedRow[] = [];

  for (let t = Date.UTC(YEAR, 1, 9); t <= Date.UTC(YEAR, 2, 27); t += MS_PER_DAY) {
    const date = new Date(t);
    const weekday = date.getUTCDay();

    if (weekday === 0 || weekday === 6) continue;

    const kind: Kind = weekday <= 2 ? 'HOME' : 'CH';
    const provenance = PROVENANCE_CYCLE[rows.length % PROVENANCE_CYCLE.length] ?? 'MANUAL';
    const detectedKind: Kind | null =
      provenance === 'MANUAL'
        ? null
        : provenance === 'DETECTED_CONFIRMED'
          ? kind
          : kind === 'HOME'
            ? 'CH'
            : 'HOME';

    rows.push(row(date.toISOString().slice(0, 10), 'FULL', kind, { provenance, detectedKind }));
  }

  return rows;
}

/**
 * THE SEEDED YEAR - the one source of every expectation in the tests that
 * import it.
 *
 * What it has to contain (R941), and where:
 *   mixed kinds         CH, HOME, MISSION_FR, MISSION_THIRD and ABSENT
 *   a mission day       six in France, four in a third state - ten against a
 *                       cap of eight, so credited (8) differs from logged (10)
 *                       and the engine warns MISSION_CAP_EXCEEDED
 *   an absence          a congé, a half-day maladie, Good Friday as FERIE
 *   a month boundary    HOME on 30 and 31 March and on 1 April, so the
 *                       cumulative rate moves across it
 * And for the annex: two half-day pairs of DIFFERENT kinds (nothing to
 * collapse into one row), a logged Saturday, all three provenances, a late
 * row, an offline-synced row and a modified row.
 */
export const SEED: readonly SeedRow[] = [
  // January: the provenances, a split day, a mission and a logged Saturday.
  row('2026-01-05', 'FULL', 'HOME'),
  row('2026-01-06', 'FULL', 'CH', { provenance: 'DETECTED_CONFIRMED', detectedKind: 'CH' }),
  row('2026-01-07', 'FULL', 'HOME', {
    provenance: 'DETECTED_CORRECTED',
    detectedKind: 'CH',
    lastModifiedAt: '2026-01-07T19:40:00.000Z',
  }),
  row('2026-01-08', 'AM', 'HOME'),
  row('2026-01-08', 'PM', 'CH', { provenance: 'DETECTED_CONFIRMED', detectedKind: 'CH' }),
  row('2026-01-09', 'FULL', 'MISSION_FR', { note: 'Lyon' }),
  row('2026-01-10', 'FULL', 'MISSION_THIRD', { note: 'Milan' }),

  // February: the absences, a late row, a corrected Swiss day.
  row('2026-02-02', 'FULL', 'ABSENT', { absenceReason: 'CONGE' }),
  row('2026-02-03', 'AM', 'ABSENT', { absenceReason: 'MALADIE' }),
  row('2026-02-03', 'PM', 'HOME'),
  row('2026-02-04', 'FULL', 'MISSION_THIRD'),
  row('2026-02-05', 'FULL', 'HOME', { firstRecordedAt: '2026-02-20T09:00:00.000Z', late: true }),
  row('2026-02-06', 'FULL', 'CH', { provenance: 'DETECTED_CORRECTED', detectedKind: 'HOME' }),

  ...ordinaryWeeks(),

  // The month boundary. 31 March was written offline and synced the next
  // morning: the client's claim and the server's stamp are different facts.
  row('2026-03-30', 'FULL', 'HOME'),
  row('2026-03-31', 'FULL', 'HOME', {
    clientClaimedAt: '2026-03-31T17:45:00.000Z',
    firstRecordedAt: '2026-04-01T07:12:00.000Z',
  }),
  row('2026-04-01', 'FULL', 'HOME', { provenance: 'DETECTED_CONFIRMED', detectedKind: 'HOME' }),
  row('2026-04-02', 'FULL', 'MISSION_FR'),
  row('2026-04-03', 'FULL', 'ABSENT', { absenceReason: 'FERIE' }),

  // The rest of the missions, past the cap.
  row('2026-04-13', 'FULL', 'MISSION_FR'),
  row('2026-04-14', 'FULL', 'MISSION_FR'),
  row('2026-04-20', 'FULL', 'MISSION_THIRD'),
  row('2026-04-21', 'FULL', 'MISSION_THIRD'),
  row('2026-05-04', 'FULL', 'MISSION_FR'),
  row('2026-05-05', 'FULL', 'MISSION_FR'),
];

/** Every Monday-to-Friday of the year, the universe SPEC 12 item 5 prints gaps from. */
export function weekdaysOfYear(): string[] {
  const days: string[] = [];

  for (let t = Date.UTC(YEAR, 0, 1); new Date(t).getUTCFullYear() === YEAR; t += MS_PER_DAY) {
    const weekday = new Date(t).getUTCDay();

    if (weekday !== 0 && weekday !== 6) days.push(new Date(t).toISOString().slice(0, 10));
  }

  return days;
}

/**
 * Write PERSON and the SEED rows, and return the person's id.
 *
 * Every row's firstRecordedAt is written explicitly rather than taken from
 * the column default, so every expected stamp is known and distinct.
 */
export async function seedYear(): Promise<string> {
  const { id: userId } = await prisma.user.create({
    data: {
      email: PERSON.email,
      name: PERSON.name,
      canton: PERSON.canton,
      employmentRate: PERSON.employmentRate,
      granularity: PERSON.granularity,
      denominatorKind: PERSON.denominatorKind,
    },
  });

  let mutation = 0;

  for (const seeded of SEED) {
    mutation += 1;

    const entry = await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date(`${seeded.day}T00:00:00.000Z`),
        portion: seeded.portion,
        kind: seeded.kind,
        absenceReason: seeded.absenceReason,
        provenance: seeded.provenance,
        detectedKind: seeded.detectedKind,
        note: seeded.note,
        firstRecordedAt: new Date(seeded.firstRecordedAt),
        clientClaimedAt: seeded.clientClaimedAt === null ? null : new Date(seeded.clientClaimedAt),
        clientMutationId: `00000000-0000-4000-e000-${String(mutation).padStart(12, '0')}`,
      },
    });

    if (seeded.lastModifiedAt !== null) {
      // The correction, on the append-only trail: R215 reads lastModifiedAt
      // from the MODIFIED events, never from updatedAt.
      await prisma.entryEvent.create({
        data: {
          userId,
          entryId: entry.id,
          action: 'MODIFIED',
          kind: seeded.kind,
          provenance: seeded.provenance,
          detectedKind: seeded.detectedKind,
          dayDate: entry.dayDate,
          portion: seeded.portion,
          recordedAt: new Date(seeded.lastModifiedAt),
        },
      });
    }
  }

  return userId;
}
