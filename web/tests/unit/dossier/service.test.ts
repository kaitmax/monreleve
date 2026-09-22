// web/tests/unit/dossier/service.test.ts
//
// The dossier payload. FW24 increment 4.

import { describe, expect, it } from 'vitest';
import { type AnnexEntry, buildDossier } from '@/lib/dossier/service';
import { MissingTitulaireError } from '@/lib/dossier/service';
import type { DossierUser } from '@/lib/dossier/service';

const USER: DossierUser = {
  // SPEC 12 item 1. buildDossier refuses without one, so every fixture that
  // expects a document has to name somebody.
  name: 'Camille Rey',
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

/**
 * The LOGGED rows.
 *
 * Since FW25b the annex also carries a row for every working day nobody
 * logged (SPEC 12 item 5), so a test about entries has to say so. Filtering
 * is the honest fix; indexing annex[0] and hoping is what these did before,
 * and it worked only because gaps were missing entirely.
 */
const logged = (d: ReturnType<typeof buildDossier>) => d.annex.filter((r) => r.recorded);

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

    expect(logged(dossier).map((row) => `${row.dayDate}/${row.portion}`)).toEqual([
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

    expect(logged(dossier)[0]?.late).toBe(false);
    expect(logged(dossier)[1]?.late).toBe(true);
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

    expect(logged(dossier)).toHaveLength(2);
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

    expect(logged(dossier)[0]?.lastModifiedAt).toBeNull();
    expect(logged(dossier)[1]?.lastModifiedAt).toBe('2026-03-10T08:00:00.000Z');
  });
});

describe('the months and the year agree', () => {
  it('ends December on the annual declarable rate', () => {
    const dossier = buildDossier(USER, divergentYear(), 2026);

    expect(dossier.months.at(-1)?.cumulativeDeclarableRate).toBe(dossier.zone.declarableRate);
  });
});

describe('SPEC 12 item 5: a working day nobody logged is PRINTED, not skipped', () => {
  // ==========================================================================
  // FOUND BY READING THE DOCUMENT, NOT BY A GATE
  // ==========================================================================
  //
  // The annex mapped over ENTRIES until FW25b, so a gap simply was not there.
  // The demo year plants one on 2026-06-17, a Wednesday: 16.06 printed, 18.06
  // printed, 17.06 absent with nothing saying so. Every suite was green.
  //
  // "A document that silently omits dates invites the question of what else it
  // omits" - which is the whole argument of an evidence annex.

  it('emits a row for a weekday with no entry', () => {
    // 2026-03-03 is a Tuesday; only the Monday is logged.
    const dossier = buildDossier(USER, [entry('2026-03-02', 'HOME')], 2026);

    const gap = dossier.annex.find((row) => row.dayDate === '2026-03-03');

    expect(gap?.recorded).toBe(false);
    // It is a DAY, not an entry: nothing was recorded, so nothing was stamped.
    expect(gap?.firstRecordedAt).toBeNull();
    expect(gap?.kind).toBeNull();
    // NOT late. Lateness is a property of a recording and there was none.
    expect(gap?.late).toBe(false);
  });

  it('proves the neighbours render first, so the absence means something', () => {
    // R169's corollary, which is how this defect was actually caught: an
    // absence assertion is satisfied by absence. "17.06 is missing" holds on
    // an empty document too.
    const dossier = buildDossier(USER, [entry('2026-06-16', 'CH'), entry('2026-06-18', 'CH')], 2026);

    const days = dossier.annex.map((row) => row.dayDate);

    expect(days).toContain('2026-06-16');
    expect(days).toContain('2026-06-18');

    const gap = dossier.annex.find((row) => row.dayDate === '2026-06-17');

    expect(gap).toBeDefined();
    expect(gap?.recorded).toBe(false);
  });

  it('does NOT print an unlogged weekend, so the guard is not blanket', () => {
    // 2026-03-07 is a Saturday. Printing 104 weekend rows would bury the one
    // Wednesday that matters, which is the opposite of the requirement.
    const dossier = buildDossier(USER, [entry('2026-03-02', 'HOME')], 2026);

    expect(dossier.annex.map((row) => row.dayDate)).not.toContain('2026-03-07');
  });

  it('DOES print a weekend that was logged', () => {
    // The universe is the weekdays UNION the days actually logged, so somebody
    // who worked a Saturday still sees it.
    const dossier = buildDossier(USER, [entry('2026-03-07', 'CH')], 2026);

    const saturday = dossier.annex.find((row) => row.dayDate === '2026-03-07');

    expect(saturday?.recorded).toBe(true);
    expect(saturday?.kind).toBe('CH');
  });

  it('covers every weekday of the year exactly once', () => {
    // 2026 has 261 weekdays. A document missing one is the defect this whole
    // block exists for; a document with duplicates would be worse.
    const dossier = buildDossier(USER, [], 2026);

    expect(dossier.annex).toHaveLength(261);
    expect(new Set(dossier.annex.map((row) => row.dayDate)).size).toBe(261);
    expect(dossier.annex.every((row) => !row.recorded)).toBe(true);
  });
});

describe('SPEC 12 item 1: a document that cannot be attributed is not a dossier', () => {
  it('REFUSES when the person has no name', () => {
    // R205 on a document: served only when it can be believed. Every other gap
    // makes it incomplete; this one makes it unattributable, and a PDF that
    // cannot be filed against a person is a table of numbers.
    expect(() => buildDossier({ ...USER, name: null }, [entry('2026-03-02', 'HOME')], 2026)).toThrow(
      MissingTitulaireError,
    );
  });

  it('REFUSES a name that is only whitespace', () => {
    expect(() => buildDossier({ ...USER, name: '   ' }, [], 2026)).toThrow(MissingTitulaireError);
  });

  it('accepts a real name, so the guard is not refusing everything', () => {
    // R196: rejection alone proves a guard is STRICT, never that it is RIGHT.
    const dossier = buildDossier(USER, [entry('2026-03-02', 'HOME')], 2026);

    expect(dossier.titulaire).toBe('Camille Rey');
  });

  it('carries a generation date, because two exports of one year differ', () => {
    const dossier = buildDossier(USER, [], 2026, new Date('2027-02-01T10:30:00.000Z'));

    expect(dossier.generatedAt).toBe('2027-02-01T10:30:00.000Z');
  });
});

describe('SPEC 12 item 1: the period covered, and it is keyed on what the ENGINE computed', () => {
  // ==========================================================================
  // THE DOCUMENT STATED SOMETHING FALSE, WHICH IS WORSE THAN OMITTING ONE
  // ==========================================================================
  //
  // `periodFractionOf` prorates from `activityStartDate` and feeds
  // `periodFraction` into the engine, so a mid-year starter's figures are all
  // computed for a PART year. The header rendered "Année 2026 entière"
  // unconditionally, and `COPY.header.fromDate` - written for exactly this -
  // rendered nowhere.
  //
  // So a person who began on 1 July saw roughly 120 jours ouvrés under a line
  // claiming the whole year. Every figure below it was right; the one line
  // that frames them was wrong.
  //
  // THE PAYLOAD CARRIES THE FRACTION THE ENGINE USED, not the start date it
  // came from. Those coincide today. If a future path prorates for another
  // reason, a header keyed to the start date goes stale silently - which is
  // exactly how this defect happened.

  it('reports a whole year when nothing prorated it', () => {
    const dossier = buildDossier(USER, [entry('2026-03-02', 'HOME')], 2026);

    expect(dossier.period.fraction).toBe(1);
    expect(dossier.period.startDate).toBeNull();
  });

  it('reports the fraction the engine used for a mid-year start', () => {
    const dossier = buildDossier(
      { ...USER, activityStartDate: new Date('2026-07-01T00:00:00.000Z') },
      [entry('2026-09-02', 'HOME')],
      2026,
    );

    expect(dossier.period.fraction).toBeLessThan(1);
    expect(dossier.period.fraction).toBeGreaterThan(0);
    expect(dossier.period.startDate).toBe('2026-07-01');
  });

  it('prorates the BASIS in step with it, which is what made the old header false', () => {
    // The two halves of the defect, asserted together: the figure moved and
    // the label did not. A test for the label alone would pass on a document
    // whose figures were never prorated at all.
    const whole = buildDossier(USER, [], 2026);
    const half = buildDossier(
      { ...USER, activityStartDate: new Date('2026-07-01T00:00:00.000Z') },
      [],
      2026,
    );

    expect(half.tiles.workedDays).toBeLessThan(whole.tiles.workedDays);
    expect(half.period.fraction).toBeLessThan(whole.period.fraction);
  });
});
