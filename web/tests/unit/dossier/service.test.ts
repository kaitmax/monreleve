// web/tests/unit/dossier/service.test.ts
//
// The dossier payload. FW24 increment 4.

import { describe, expect, it } from 'vitest';
import { type AnnexEntry, buildDossier } from '@/lib/dossier/service';
import type { AggregatableUser } from '@/lib/dossier/aggregate';

const USER: AggregatableUser = {
  canton: 'GE',
  employmentRate: 100,
  denominatorKind: 'SIMPLIFIED240',
  exactTotalWorkDays: null,
  granularity: 'DAY',
  activityStartDate: null,
};

function entry(
  iso: string,
  kind: AnnexEntry['kind'],
  overrides: Partial<AnnexEntry> = {},
): AnnexEntry {
  return {
    dayDate: new Date(`${iso}T00:00:00.000Z`),
    portion: 'FULL',
    kind,
    absenceReason: kind === 'ABSENT' ? 'CONGE' : null,
    note: null,
    provenance: 'MANUAL',
    detectedKind: null,
    firstRecordedAt: new Date(`${iso}T18:00:00.000Z`),
    lastModifiedAt: null,
    clientClaimedAt: null,
    ...overrides,
  };
}

/** A year whose telework is high enough that the two rates diverge. */
function divergentYear(): AnnexEntry[] {
  const entries: AnnexEntry[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const mm = String(month).padStart(2, '0');

    for (let d = 1; d <= 8; d += 1) {
      entries.push(entry(`2026-${mm}-${String(d).padStart(2, '0')}`, 'HOME'));
    }

    // Missions are what make rawRate exceed declarableRate: they are days
    // outside Switzerland that the declarable numerator does not count.
    entries.push(entry(`2026-${mm}-15`, 'MISSION_FR'));
    entries.push(entry(`2026-${mm}-16`, 'CH'));
  }

  return entries;
}

describe('R224: both rates travel, and the figure is the declarable one', () => {
  it('carries declarableRate AND rawRate', () => {
    const dossier = buildDossier(USER, divergentYear(), 2026);

    expect(typeof dossier.zone.declarableRate).toBe('number');
    expect(typeof dossier.zone.rawRate).toBe('number');
  });

  it('reports that they differ, on a year where they do', () => {
    // NON-VACUITY FIRST: this fixture is built so the two diverge. A test
    // asserting `ratesDiffer` against a year where they happen to agree would
    // pass for the wrong reason, and so would its opposite.
    const dossier = buildDossier(USER, divergentYear(), 2026);

    expect(dossier.zone.rawRate).not.toBe(dossier.zone.declarableRate);
    expect(dossier.zone.ratesDiffer).toBe(true);
  });

  it('reports that they agree when no mission days exist', () => {
    // THE OTHER DIRECTION. Without missions the two numerators coincide, and a
    // service that hardcoded `ratesDiffer: true` would pass everything above.
    const telework = Array.from({ length: 24 }, (_, i) =>
      entry(`2026-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`, 'HOME'),
    );

    const dossier = buildDossier(USER, telework, 2026);

    expect(dossier.zone.declarableRate).toBe(dossier.zone.rawRate);
    expect(dossier.zone.ratesDiffer).toBe(false);
  });

  it('never drops rawRate, which FD3 needs to render the two-rate state', () => {
    // The temptation is to carry only the figure. FD3 specifies a state with
    // BOTH and an explanatory sentence; discarding the raw rate here would make
    // that state unbuildable in FW25 and the discovery would be a redesign.
    const dossier = buildDossier(USER, divergentYear(), 2026);

    expect(Object.keys(dossier.zone)).toContain('rawRate');
  });
});

describe('the tiles report the engine denominator, not a row count', () => {
  it('takes workedDays from the engine rather than counting entries', () => {
    // 20 rows, and a 240-day denominator under the simplified basis. A tile
    // that counted rows would say 20, which is not what the rate was computed
    // against - and a reader checking the arithmetic would find it did not
    // divide.
    const entries = Array.from({ length: 20 }, (_, i) =>
      entry(`2026-03-${String(i + 1).padStart(2, '0')}`, 'HOME'),
    );

    const dossier = buildDossier(USER, entries, 2026);

    expect(dossier.tiles.workedDays).toBe(240);
    expect(dossier.tiles.teleworkDays).toBe(20);
  });

  it('sums both mission kinds into one tile', () => {
    const dossier = buildDossier(
      USER,
      [entry('2026-03-02', 'MISSION_FR'), entry('2026-03-03', 'MISSION_THIRD')],
      2026,
    );

    expect(dossier.tiles.missionDays).toBe(2);
  });
});

describe('the annex is an evidence record', () => {
  it('sorts by day, then FULL AM PM, so two regenerations agree', () => {
    const dossier = buildDossier(
      USER,
      [
        { ...entry('2026-03-05', 'HOME'), portion: 'PM' },
        entry('2026-03-01', 'CH'),
        { ...entry('2026-03-05', 'HOME'), portion: 'AM' },
      ],
      2026,
    );

    expect(dossier.annex.map((row) => `${row.dayDate}/${row.portion}`)).toEqual([
      '2026-03-01/FULL',
      '2026-03-05/AM',
      '2026-03-05/PM',
    ]);
  });

  it('flags a late entry and leaves an on-time one alone', () => {
    // BOTH SIDES. A renderer that flagged everything would pass a test that
    // only looked at the late row.
    const dossier = buildDossier(
      USER,
      [
        entry('2026-03-02', 'HOME', { firstRecordedAt: new Date('2026-03-02T18:00:00.000Z') }),
        entry('2026-03-03', 'HOME', { firstRecordedAt: new Date('2026-04-30T09:00:00.000Z') }),
      ],
      2026,
    );

    expect(dossier.annex[0]?.late).toBe(false);
    expect(dossier.annex[1]?.late).toBe(true);
  });

  it('keeps ABSENT rows in the annex while keeping them out of every figure', () => {
    // D28 in its exact form: counted once, shown in the record, and in no other
    // figure. An annex that omitted absences would be a document that silently
    // drops days - the thing SPEC 12 forbids for unlogged days too.
    const dossier = buildDossier(
      USER,
      [entry('2026-03-02', 'HOME'), entry('2026-03-03', 'ABSENT')],
      2026,
    );

    expect(dossier.annex).toHaveLength(2);
    expect(dossier.absenceDays).toBe(1);
    expect(dossier.tiles.swissDays).toBe(0);
    expect(dossier.tiles.teleworkDays).toBe(1);
  });

  it('carries lastModifiedAt only where there is one', () => {
    const dossier = buildDossier(
      USER,
      [
        entry('2026-03-02', 'HOME'),
        entry('2026-03-03', 'HOME', { lastModifiedAt: new Date('2026-03-10T08:00:00.000Z') }),
      ],
      2026,
    );

    expect(dossier.annex[0]?.lastModifiedAt).toBeNull();
    expect(dossier.annex[1]?.lastModifiedAt).toBe('2026-03-10T08:00:00.000Z');
  });
});

describe('the months and the year agree', () => {
  it('ends December on the annual declarable rate', () => {
    const dossier = buildDossier(USER, divergentYear(), 2026);

    expect(dossier.months.at(-1)?.cumulativeDeclarableRate).toBe(dossier.zone.declarableRate);
  });
});
