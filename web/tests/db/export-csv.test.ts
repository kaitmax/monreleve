// web/tests/db/export-csv.test.ts
//
// GET /api/v1/export/csv, through the route handler. FW25 increment 1.
//
// R204: the entry point is the unit under test. Between `toCsv` and a client
// sit the bearer guard, the coordinate scan, the query validation and the
// loader's year window - and the last of those is the one most likely to be
// wrong in a way the unit tests cannot see.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { GET } from '@/app/api/v1/export/csv/route';
import { buildDossierFor } from '@/lib/dossier/load';
import { CSV_COLUMNS } from '@/lib/export/csv';

const ORIGIN = 'https://monreleve.ch';
const BOM = '﻿';

let userId = '';
let otherId = '';
let token = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-9000-${String(counter).padStart(12, '0')}`;
}

function get(query: string, bearer = token): Request {
  return new Request(`${ORIGIN}/api/v1/export/csv${query}`, {
    headers: bearer === '' ? {} : { authorization: `Bearer ${bearer}` },
  });
}

async function seed(
  owner: string,
  dayDate: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await prisma.entry.create({
    data: {
      userId: owner,
      dayDate: new Date(`${dayDate}T00:00:00.000Z`),
      portion: 'FULL',
      kind: 'HOME',
      clientMutationId: mutation(),
      ...overrides,
    },
  });
}

/** The day column of every record, in file order. */
function daysIn(csv: string): string[] {
  return csv
    .slice(BOM.length)
    .split('\r\n')
    .filter((line) => line !== '')
    .slice(1)
    .map((line) => line.split(',')[0] ?? '');
}

/**
 * The days that carry an ENTRY, as opposed to every day the year prints.
 *
 * Since FW25b the CSV carries a row for every working day with no entry
 * (SPEC 12 item 5), because R175 binds it to the annex and the annex prints
 * them. A test about which entries were exported therefore has to say so -
 * the alternative is comparing against all 261 weekdays, which asserts the
 * calendar rather than the query.
 *
 * A gap row has an empty `portion`, the second column.
 */
function loggedDaysIn(csv: string): string[] {
  return csv
    .slice(BOM.length)
    .split('\r\n')
    .filter((line) => line !== '')
    .slice(1)
    .filter((line) => (line.split(',')[1] ?? '') !== '')
    .map((line) => line.split(',')[0] ?? '');
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      // SPEC 12 item 1: buildDossier refuses without a titulaire, and the CSV
      // is built from the same dossier the document is.
      data: { email: 'csv@example.com', name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    })
  ).id;

  otherId = (
    await prisma.user.create({
      data: { email: 'autre-csv@example.com', name: 'Autre Personne', canton: 'GE', employmentRate: 100 },
    })
  ).id;

  token = (await issueTokenPair(userId)).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the export comes back', () => {
  it('serves a CSV with the right headers', async () => {
    await seed(userId, '2026-04-07');

    const response = await GET(get('?year=2026'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    // R237: the year AND the titulaire, because the filename is the only place
    // this export names anybody.
    expect(response.headers.get('content-disposition')).toContain('releve-2026-camille-rey.csv');

    // An authenticated export is the one shape a proxy treats as static, and
    // the failure mode is one person's year served to another.
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('vary')).toContain('Authorization');
  });

  it('starts with the BOM IN THE BYTES, which text() cannot tell you', async () => {
    // THE FIRST VERSION OF THIS TEST USED response.text() AND FAILED, and the
    // reason is worth keeping: the WHATWG UTF-8 decoder STRIPS a leading BOM,
    // so `text()` never shows one. A test written that way can neither confirm
    // nor deny it - and the inverse assertion, `not.toContain(BOM)`, would
    // "prove" the BOM absent on a file that has it.
    //
    // The BOM is three bytes whose entire job is to be read by a decoder that
    // is NOT ours, so the only honest assertion is on the bytes.
    await seed(userId, '2026-04-07');

    const bytes = new Uint8Array(await (await GET(get('?year=2026'))).arrayBuffer());

    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe('R175: the CSV and the annex carry the SAME day set', () => {
  // The two bound one property - "which days are in this year" - from opposite
  // sides. Neither test alone catches a window that is wrong in both.
  it('agrees with the dossier the document would print', async () => {
    await seed(userId, '2026-01-01');
    await seed(userId, '2026-06-15', { kind: 'CH' });
    await seed(userId, '2026-12-31', { kind: 'ABSENT', absenceReason: 'CONGE' });

    const csv = await (await GET(get('?year=2026'))).text();
    const dossier = await buildDossierFor(userId, 2026);

    expect(daysIn(csv)).toEqual(dossier.annex.map((row) => row.dayDate));

    // PRESENCE FIRST: without this, two empty lists compare equal.
    expect(dossier.annex.length).toBeGreaterThan(0);
  });

  it('includes ABSENCES as rows, which D28 requires and no figure counts', async () => {
    await seed(userId, '2026-03-02', { kind: 'ABSENT', absenceReason: 'MALADIE' });

    const csv = await (await GET(get('?year=2026'))).text();

    expect(csv).toContain('2026-03-02');
    expect(csv).toContain('MALADIE');
  });

  it('excludes the neighbouring years, each PROVEN to exist', async () => {
    await seed(userId, '2025-12-31');
    await seed(userId, '2026-01-01');
    await seed(userId, '2026-12-31');
    await seed(userId, '2027-01-01');

    const year2026 = await (await GET(get('?year=2026'))).text();

    // THE LOGGED days, because every weekday of 2026 is now a row.
    expect(loggedDaysIn(year2026)).toEqual(['2026-01-01', '2026-12-31']);

    // AND THE NEIGHBOURS ARE ABSENT ALTOGETHER - not merely unlogged. A gap
    // row for 2025-12-31 inside the 2026 export would be a window defect that
    // the logged-days assertion above could not see.
    expect(daysIn(year2026)).not.toContain('2025-12-31');
    expect(daysIn(year2026)).not.toContain('2027-01-01');

    // Absence is only meaningful once presence is established (R169's
    // corollary): the neighbours are fetched under their own years and found.
    expect(loggedDaysIn(await (await GET(get('?year=2025'))).text())).toEqual(['2025-12-31']);
    expect(loggedDaysIn(await (await GET(get('?year=2027'))).text())).toEqual(['2027-01-01']);
  });
});

describe('tenancy and refusals', () => {
  it('returns 401 without a token', async () => {
    const response = await GET(get('?year=2026', ''));

    expect(response.status).toBe(401);
  });

  it('never exports another account rows, in a run proving both have some', async () => {
    await seed(userId, '2026-04-07');
    await seed(otherId, '2026-06-11');

    const mine = await (await GET(get('?year=2026'))).text();
    const otherToken = (await issueTokenPair(otherId)).accessToken;
    const theirs = await (await GET(get('?year=2026', otherToken))).text();

    // The LOGGED days: both exports carry all 261 weekdays of 2026, and the
    // question this test asks is whose ENTRIES are in them.
    expect(loggedDaysIn(mine)).toEqual(['2026-04-07']);
    expect(loggedDaysIn(theirs)).toEqual(['2026-06-11']);

    // AND NEITHER CARRIES THE OTHER'S DAY AS AN ENTRY, stated from the other
    // side so a serialiser that emitted both would fail here too.
    expect(loggedDaysIn(mine)).not.toContain('2026-06-11');
    expect(loggedDaysIn(theirs)).not.toContain('2026-04-07');
  });

  it('refuses a coordinate in the query string, before the year is validated', async () => {
    const response = await GET(get('?year=2026&latitude=46.2'));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'coordinates_refused' });
  });

  it('refuses an unknown parameter and names it', async () => {
    const response = await GET(get('?year=2026&delimiter=;'));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: 'unknown_parameter' });
    expect(JSON.stringify(body)).toContain('delimiter');
  });

  it('refuses a malformed year', async () => {
    expect((await GET(get('?year=20xx'))).status).toBe(400);
  });
});

describe('R237: the filename is where the CSV names its titulaire', () => {
  it('carries both the year and the person, through the ROUTE', () => {
    // R204: the unit test proves the slug; this proves the route uses it. The
    // two are different claims, and the second is the one a client sees.
    return (async () => {
      await seed(userId, '2026-04-07');

      const response = await GET(get('?year=2026'));
      const disposition = response.headers.get('content-disposition') ?? '';

      expect(disposition).toContain('2026');
      expect(disposition).toContain('camille-rey');
    })();
  });

  it('is the ONLY place the export names anybody', () => {
    // The bytes themselves carry no identity, and that is the decision rather
    // than an omission - SPEC 12 freezes the columns and the PDF is the
    // document of record. Asserting it here stops somebody "fixing" it later
    // by quietly adding a column.
    return (async () => {
      await seed(userId, '2026-04-07');

      const body = await (await GET(get('?year=2026'))).text();

      expect(body).not.toContain('Camille');
      expect(body).not.toContain('camille');
    })();
  });
});

// ============================================================================
// FW-DOSSIER-EMPTY (R516): AN EMPTY YEAR EXPORTS, AND EVERY ROW SAYS "NO ENTRY"
// ============================================================================
//
// The CSV cannot carry a sentence: SPEC 12 freezes its columns, and R237 has
// already refused a comment row because it breaks RFC 4180 for every reader
// that is not Excel. What it CAN do is what it already does - one row per
// working day, each with no portion - and this pins that for a year with
// nothing in it, so an empty year is a file rather than a failure.
describe('FW-DOSSIER-EMPTY R516: a year with no day recorded', () => {
  it('exports every working day of the year, none of them carrying an entry', async () => {
    const response = await GET(get('?year=2025'));

    expect(response.status).toBe(200);

    const csv = await response.text();
    const dossier = await buildDossierFor(userId, 2025);

    // R171: the day count is READ from the annex the CSV serialises, never a
    // typed 261 - a typed figure is correct for one calendar year only.
    expect(dossier.recordedEntries).toBe(0);
    expect(daysIn(csv)).toEqual(dossier.annex.map((row) => row.dayDate));
    // PRESENCE FIRST: the rows exist, so "none is logged" is about real rows.
    expect(daysIn(csv).length).toBeGreaterThan(0);
    expect(loggedDaysIn(csv)).toEqual([]);
  });
});

// ============================================================================
// FW-DOSSIER-EMPTY R581: THE COLUMNS ARE A FROZEN CONTRACT, EMPTY YEAR OR NOT
// ============================================================================
//
// The operator accepted Q2: the CSV does not say "no day recorded" in words -
// the PDF carries the explanation - and only has to stay well-formed. So an
// empty year's file carries the header row, and its columns are EXACTLY those
// of a year with days. Both are read from CSV_COLUMNS, the module the header is
// written from (R181): typing the eleven names here would be a second copy of
// SPEC 12's list that agrees until somebody changes one of them.
describe('FW-DOSSIER-EMPTY R581: an empty year is a well-formed file with the frozen columns', () => {
  /** The file's lines, BOM-tolerant (text() strips it; a raw body would not). */
  function linesOf(csv: string): string[] {
    return (csv.startsWith(BOM) ? csv.slice(BOM.length) : csv)
      .split('\r\n')
      .filter((line) => line !== '');
  }

  it('has the header row, and exactly the columns of a year with days', async () => {
    await seed(userId, '2026-04-07');

    const empty = linesOf(await (await GET(get('?year=2025'))).text());
    const withDays = linesOf(await (await GET(get('?year=2026'))).text());

    // PRESENCE FIRST: the year with days really has a logged day, and the
    // empty year really has none - or the comparison below is about nothing.
    expect(loggedDaysIn(`${BOM}${withDays.join('\r\n')}`)).toEqual(['2026-04-07']);
    expect(loggedDaysIn(`${BOM}${empty.join('\r\n')}`)).toEqual([]);

    expect(withDays[0]).toBe(CSV_COLUMNS.join(','));
    expect(empty[0]).toBe(withDays[0]);

    // AND EVERY RECORD HAS THAT MANY FIELDS. An empty year's rows carry no
    // note, so no field is quoted and a plain split counts them exactly.
    const records = empty.slice(1);

    expect(records.length).toBeGreaterThan(0);

    for (const record of records) {
      expect(record.split(',')).toHaveLength(CSV_COLUMNS.length);
    }
  });
});
