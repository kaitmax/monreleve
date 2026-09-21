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

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: { email: 'csv@example.com', canton: 'GE', employmentRate: 100 },
    })
  ).id;

  otherId = (
    await prisma.user.create({
      data: { email: 'autre-csv@example.com', canton: 'GE', employmentRate: 100 },
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
    expect(response.headers.get('content-disposition')).toContain('releve-2026.csv');

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

    expect(daysIn(await (await GET(get('?year=2026'))).text())).toEqual([
      '2026-01-01',
      '2026-12-31',
    ]);

    // Absence is only meaningful once presence is established (R169's
    // corollary): the neighbours are fetched under their own years and found.
    expect(daysIn(await (await GET(get('?year=2025'))).text())).toEqual(['2025-12-31']);
    expect(daysIn(await (await GET(get('?year=2027'))).text())).toEqual(['2027-01-01']);
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

    expect(daysIn(mine)).toEqual(['2026-04-07']);
    expect(daysIn(theirs)).toEqual(['2026-06-11']);
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
