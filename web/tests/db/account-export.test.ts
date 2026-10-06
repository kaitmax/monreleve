// web/tests/db/account-export.test.ts
//
// GET /api/v1/account/export. FW26 increment 3, AC2.
//
// ============================================================================
// THE CENSUS IS THE POINT, NOT THE ROW COUNTS
// ============================================================================
//
// Counting rows proves today's export. What AC2 asks for is a test that fails
// when a TABLE is added later - because the way an export goes wrong is not
// that somebody breaks it, it is that somebody adds a column of personal data
// two years from now and nobody remembers this file exists.
//
// So the enumeration is read from `prisma/schema.prisma`, and every user-owned
// model must be either exported or excluded WITH A REASON. That is R175 in its
// original form: two lists that between them must cover everything, with the
// space between them named rather than left.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { GET } from '@/app/api/v1/account/export/route';
import { EXCLUDED, EXPORTED } from '@/lib/account/export';
import { DOSSIER_COPY as COPY } from '@/lib/fr/dossier';

const ORIGIN = 'https://monreleve.ch';
const SCHEMA = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

let userId = '';
let token = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-d000-${String(counter).padStart(12, '0')}`;
}

function get(query = '', bearer = token): Request {
  return new Request(`${ORIGIN}/api/v1/account/export${query}`, {
    headers: bearer === '' ? {} : { authorization: `Bearer ${bearer}` },
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: { email: 'export@example.com', name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    })
  ).id;

  token = (await issueTokenPair(userId)).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AC2: every user-owned table is exported or excluded with a reason', () => {
  /**
   * Models in the schema that carry a `userId` column.
   *
   * IT FINDS DIRECT OWNERSHIP ONLY, and that is a stated limit rather than an
   * oversight. `SessionToken` belongs to a person through `sessionId ->
   * DeviceSession.userId` and this census cannot see it; it is in EXCLUDED
   * with a reason anyway, so today's partition is complete. A future table
   * owned only indirectly would slip past - PARKED, because closing it means
   * walking the relation graph, and a census that walked it wrongly would be
   * worse than one whose reach is written down.
   */
  function userOwnedModels(): string[] {
    const models: string[] = [];
    let current = '';

    for (const line of SCHEMA.split('\n')) {
      const header = /^model\s+(\w+)\s*\{/u.exec(line);

      if (header !== null) current = header[1]!;

      if (/^\s*userId\s+String/u.test(line) && current !== '') models.push(current);
    }

    return [...new Set(models)];
  }

  it('finds the schema and some user-owned models, so the census is not vacuous', () => {
    // R133. An empty census passes every partition assertion below.
    expect(SCHEMA.length).toBeGreaterThan(1000);
    expect(userOwnedModels().length).toBeGreaterThan(3);
  });

  it('partitions them: nothing is both, nothing is neither', () => {
    // THE ASSERTION AC2 ASKS FOR. A table added later lands in neither list
    // and fails here, which is the whole reason this is derived from the
    // schema rather than typed beside it.
    const exported = new Set(Object.keys(EXPORTED));
    const excluded = new Set(Object.keys(EXCLUDED));

    const uncovered = userOwnedModels().filter(
      (model) => !exported.has(model) && !excluded.has(model),
    );

    expect(uncovered, `user-owned and neither exported nor excluded: ${uncovered.join(', ')}`).toEqual(
      [],
    );

    const both = [...exported].filter((model) => excluded.has(model));

    expect(both, 'a table cannot be both').toEqual([]);
  });

  it('refuses an exclusion that does not argue for itself', () => {
    // "Not useful" is not a reason. Same rule as R238's allow-list: an
    // exemption survives challenge or it is not one.
    for (const [table, reason] of Object.entries(EXCLUDED)) {
      expect(reason.length, `${table} has no stated reason`).toBeGreaterThan(60);
    }
  });
});

describe('AC2: the export contains every row belonging to the caller', () => {
  beforeEach(async () => {
    // THE TRAIL IS WRITTEN BY THE WRITE PATH, not by the database. A direct
    // insert leaves EntryEvent empty, which is how the first run of this file
    // reported a trail of zero - a fixture that never created one, reading as
    // an export that had dropped it.
    for (const day of ['2026-03-02', '2026-03-03', '2026-03-04']) {
      const entry = await prisma.entry.create({
        data: {
          userId,
          dayDate: new Date(`${day}T00:00:00.000Z`),
          portion: 'FULL',
          kind: 'HOME',
          clientMutationId: mutation(),
        },
      });

      await prisma.entryEvent.create({
        data: {
          userId,
          entryId: entry.id,
          action: 'CREATED',
          kind: 'HOME',
          provenance: 'MANUAL',
          dayDate: entry.dayDate,
          portion: 'FULL',
          clientMutationId: entry.clientMutationId,
        },
      });
    }
  });

  it('matches the database row counts, table by table', async () => {
    const payload = (await (await GET(get())).json()) as Record<string, unknown[]>;

    const [entries, trail, devices, sessions] = await Promise.all([
      prisma.entry.count({ where: { userId } }),
      prisma.entryEvent.count({ where: { userId } }),
      prisma.device.count({ where: { userId } }),
      prisma.deviceSession.count({ where: { userId } }),
    ]);

    // PRESENCE FIRST (R169): counts of zero on both sides are equal.
    expect(entries).toBeGreaterThan(0);
    expect(trail).toBeGreaterThan(0);
    expect(sessions).toBeGreaterThan(0);

    expect(payload.entries).toHaveLength(entries);
    expect(payload.trail).toHaveLength(trail);
    expect(payload.devices).toHaveLength(devices);
    expect(payload.sessions).toHaveLength(sessions);
  });

  it('INCLUDES THE TRAIL, because an export without it cannot be verified', async () => {
    const payload = (await (await GET(get())).json()) as { trail: Record<string, unknown>[] };

    expect(payload.trail.length).toBeGreaterThan(0);
    expect(payload.trail[0]).toHaveProperty('action');
    expect(payload.trail[0]).toHaveProperty('recordedAt');
  });

  it('never carries another account rows, with both proven non-empty', async () => {
    const otherId = (
      await prisma.user.create({
        data: { email: 'autre-x@example.com', name: 'Autre', canton: 'GE', employmentRate: 100 },
      })
    ).id;

    await prisma.entry.create({
      data: {
        userId: otherId,
        dayDate: new Date('2026-06-11T00:00:00.000Z'),
        portion: 'FULL',
        kind: 'CH',
        clientMutationId: mutation(),
      },
    });

    const mine = (await (await GET(get())).json()) as { entries: { dayDate: string }[] };

    expect(mine.entries.length).toBeGreaterThan(0);
    expect(mine.entries.map((entry) => entry.dayDate)).not.toContain('2026-06-11');
  });

  it('never carries a credential', async () => {
    // SessionToken and the device push token are excluded, and this asserts it
    // on the produced file rather than on the list that says so.
    const text = await (await GET(get())).text();

    expect(text).not.toContain('tokenHash');
    expect(text).not.toContain('pushToken');
  });

  it('refuses an unauthenticated caller', async () => {
    expect((await GET(get('', ''))).status).toBe(401);
  });

  it('refuses an unknown format by name', async () => {
    const response = await GET(get('?format=xml'));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe('invalid_format');
  });
});

describe('FW-VERIFY: the issuance records are the caller own data, so they are exported', () => {
  it('carries every issued-releve record under its key', async () => {
    await prisma.issuanceRecord.create({
      data: {
        code: 'export-issuance-code',
        userId,
        taxYear: 2026,
        version: 1,
        name: 'Camille Rey',
        declarableRate: 39.16,
        teleworkDays: 94,
        missionDaysFrance: 6,
        missionDaysThirdState: 2,
        periodFraction: 1,
        sha256: 'a'.repeat(64),
        generatedAt: new Date('2026-04-01T09:00:00.000Z'),
      },
    });

    const payload = (await (await GET(get())).json()) as {
      issuances: { code: string; version: number; sha256: string }[];
    };

    // PRESENCE FIRST (R169): the fixture made one, so an empty array is a
    // dropped table rather than an honest absence.
    expect(payload.issuances).toHaveLength(1);
    expect(payload.issuances[0]?.code).toBe('export-issuance-code');
    expect(payload.issuances[0]?.version).toBe(1);
    expect(payload.issuances[0]?.sha256).toBe('a'.repeat(64));
  });
});

describe('R230: the CSV escapes a formula and the JSON does not', () => {
  beforeEach(async () => {
    await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date('2026-03-02T00:00:00.000Z'),
        portion: 'FULL',
        kind: 'HOME',
        note: '=SUM(A1)',
        clientMutationId: mutation(),
      },
    });
  });

  it('carries the note byte for byte in the JSON, which IS the record', async () => {
    const payload = (await (await GET(get())).json()) as { entries: { note: string }[] };

    expect(payload.entries[0]?.note).toBe('=SUM(A1)');
  });

  it('neutralises it in the CSV, which a spreadsheet executes', async () => {
    const csv = await (await GET(get('?format=csv'))).text();

    // NOT quoted. `=SUM(A1)` contains no comma, semicolon, quote or newline,
    // so RFC 4180 requires no quoting and `toCsv` adds none. The apostrophe is
    // the whole mitigation; asserting a quoted form would have been asserting
    // the quoting rules rather than R230.
    expect(csv).toContain("'=SUM(A1)");
  });

  it('names the file after the person (R237)', async () => {
    const response = await GET(get('?format=csv'));

    expect(response.headers.get('content-disposition')).toContain('camille-rey');
  });
});

describe('the export is readable by the person it belongs to', () => {
  // FOUND BY READING IT, not by counting rows. The first version shipped
  // "kind": "HOME", "portion": "FULL", "provenance": "DETECTED_CONFIRMED" -
  // enum tokens, to a French reader, in a product whose every other surface is
  // carefully French. The row counts were all correct.

  beforeEach(async () => {
    const absent = await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date('2026-03-05T00:00:00.000Z'),
        portion: 'AM',
        kind: 'ABSENT',
        absenceReason: 'MALADIE',
        provenance: 'DETECTED_CORRECTED',
        detectedKind: 'CH',
        clientMutationId: mutation(),
      },
    });

    // A TRAIL ROW AND A SECOND KIND, because the assertions below are about
    // both. The first version of this fixture made one ABSENT entry and no
    // event, so "the trail is labelled" failed on an empty trail and "the
    // words come from DOSSIER_COPY" failed looking for a day that was never
    // created - two tests failing for a reason that was not the subject.
    await prisma.entryEvent.create({
      data: {
        userId,
        entryId: absent.id,
        action: 'CREATED',
        kind: 'ABSENT',
        provenance: 'DETECTED_CORRECTED',
        dayDate: absent.dayDate,
        portion: 'AM',
      },
    });

    await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date('2026-03-06T00:00:00.000Z'),
        portion: 'FULL',
        kind: 'HOME',
        clientMutationId: mutation(),
      },
    });
  });

  it('gives every code the word for it, in French', async () => {
    const payload = (await (await GET(get())).json()) as {
      entries: Record<string, string>[];
    };

    const row = payload.entries.find((entry) => entry.dayDate === '2026-03-05');

    expect(row?.portionLabel).toBe(COPY.annex.portionMorning);
    expect(row?.kindLabel).toBe(COPY.annex.absenceAutre);
    expect(row?.absenceLabel).toBe(COPY.annex.absenceMaladie);
    expect(row?.provenanceLabel).toBe(COPY.annex.provenanceCorrected);
  });

  it('KEEPS the code beside the word, because an export is also machine-readable', async () => {
    // Replacing the token would break re-import and make the file useless to
    // anything but a human reader. Both, rather than either.
    const payload = (await (await GET(get())).json()) as {
      entries: Record<string, string>[];
    };

    const row = payload.entries.find((entry) => entry.dayDate === '2026-03-05');

    expect(row?.portion).toBe('AM');
    expect(row?.kind).toBe('ABSENT');
    expect(row?.provenance).toBe('DETECTED_CORRECTED');
  });

  it('labels the TRAIL too, which is the half a person most needs explained', async () => {
    const payload = (await (await GET(get())).json()) as {
      trail: Record<string, string>[];
    };

    expect(payload.trail.length).toBeGreaterThan(0);
    expect(payload.trail[0]?.kindLabel).toBeTruthy();
    expect(payload.trail[0]?.provenanceLabel).toBeTruthy();
  });

  it('takes the words from DOSSIER_COPY, so the export and the PDF agree', async () => {
    // R206: one home. An export that said "Détection corrigée" while the
    // document said something else would be two descriptions of one day.
    const payload = (await (await GET(get())).json()) as {
      entries: Record<string, string>[];
    };

    const words = payload.entries.map((entry) => entry.kindLabel);

    expect(words).toContain(COPY.annex.kindHome);
  });
});
