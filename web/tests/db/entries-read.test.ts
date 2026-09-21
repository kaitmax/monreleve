// web/tests/db/entries-read.test.ts
//
// GET /api/v1/entries?year=, driven through the ROUTE HANDLER. FW23 increment 4.
//
// R204: THE ENTRY POINT IS THE UNIT UNDER TEST. Importing `readYear` proves the
// function; a client sends a request, and between the two sit the bearer guard,
// the coordinate scan, the query validation and the order they run in.
//
// ============================================================================
// PRESENCE BEFORE ABSENCE, THROUGHOUT
// ============================================================================
//
// R169's corollary: an absence assertion is only meaningful once presence is
// established. "No other user's rows appear" is satisfied by a route that
// returns nothing at all; "2029-01-01 is absent from ?year=2028" is satisfied
// by an empty database. So every absence assertion in this file runs in a test
// that has ALREADY proved the corresponding presence - the victim's own year is
// fetched and found non-empty, the excluded day is fetched under its own year
// and found there.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { EntryPortion } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import {
  ENTRY_DERIVED_FIELDS,
  ENTRY_NOT_EXPOSED,
  ENTRY_READ_FIELDS,
  PORTION_ORDER,
  byDayThenPortion,
} from '@/lib/entries/read';
import { GET } from '@/app/api/v1/entries/route';

const ORIGIN = 'https://monreleve.ch';

let userId = '';
let otherId = '';
let token = '';
let otherToken = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

/** A GET as the Android client sends one. */
function get(query: string, bearer = token): Request {
  return new Request(`${ORIGIN}/api/v1/entries${query}`, {
    method: 'GET',
    headers: bearer === '' ? {} : { authorization: `Bearer ${bearer}` },
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

async function readYear(year: string, bearer = token): Promise<Record<string, unknown>> {
  return json(await GET(get(`?year=${year}`, bearer)));
}

function entriesOf(body: Record<string, unknown>): Array<Record<string, unknown>> {
  return body.entries as Array<Record<string, unknown>>;
}

/**
 * A row written straight to the database.
 *
 * THE READ PATH IS THE SUBJECT, so the rows are seeded rather than posted -
 * except where a test is about what POST and GET agree on, which says so. It
 * also reaches states POST cannot: `firstRecordedAt` is server-assigned, so a
 * late row can only be made this way.
 */
async function seed(
  owner: string,
  dayDate: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  return prisma.entry.create({
    data: {
      userId: owner,
      dayDate: new Date(`${dayDate}T00:00:00.000Z`),
      portion: 'FULL',
      kind: 'CH',
      clientMutationId: mutation(),
      ...overrides,
    },
    select: { id: true },
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (await prisma.user.create({ data: { email: 'lecteur@example.com' } })).id;
  otherId = (await prisma.user.create({ data: { email: 'autre-lecteur@example.com' } })).id;
  token = (await issueTokenPair(userId)).accessToken;
  otherToken = (await issueTokenPair(otherId)).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the year comes back', () => {
  it('returns the caller entries for that year', async () => {
    await seed(userId, '2026-04-07');
    await seed(userId, '2026-04-08');

    const body = await readYear('2026');

    expect(body.status).toBe('ok');
    expect(body.year).toBe(2026);
    expect(entriesOf(body)).toHaveLength(2);
  });

  it('answers 200 with an empty list for a year holding nothing, never 404', async () => {
    // A year with no entries is a TRUE AND USEFUL ANSWER. 404 says "no such
    // resource", which is a different claim and would make the client branch on
    // two shapes for one meaning.
    const body = await readYear('2019');

    expect(body.status).toBe('ok');
    expect(entriesOf(body)).toEqual([]);
  });

  it('serialises dayDate as a day-string, never an instant (R28)', async () => {
    await seed(userId, '2026-04-07');

    const [entry] = entriesOf(await readYear('2026'));

    // THE ONE THAT PRODUCES A WRONG RECORD rather than a parse error. An
    // instant only names a day once a zone is chosen, and a client that parses
    // one in its own zone can land on the day before.
    expect(entry?.dayDate).toBe('2026-04-07');
    expect(String(entry?.dayDate)).not.toContain('T');
  });
});

describe('the frozen field set', () => {
  it('returns exactly the frozen fields, no more and no fewer', async () => {
    await seed(userId, '2026-04-07');

    const [entry] = entriesOf(await readYear('2026'));

    // BOTH DIRECTIONS. Missing keys break a client; extra keys are a column
    // joining the wire contract by accident, which is what the allowlist
    // exists to prevent.
    expect(Object.keys(entry ?? {}).sort()).toEqual([...ENTRY_READ_FIELDS].sort());
  });

  it('never exposes userId', async () => {
    await seed(userId, '2026-04-07');

    const body = await readYear('2026');

    // Asserted on the SERIALISED BODY, not on the field list - a list is a
    // claim about intent, the body is what a client receives.
    expect(JSON.stringify(body)).not.toContain(userId);
  });

  it('writes every key explicitly, with null rather than omission', async () => {
    await seed(userId, '2026-04-07');

    const [entry] = entriesOf(await readYear('2026'));

    // `absent` and `null` are different to kotlinx.serialization and to Moshi,
    // and a test asserting a key is undefined passes both when the server
    // correctly omits it and when the server has no such field at all.
    for (const field of ENTRY_READ_FIELDS) {
      expect(Object.hasOwn(entry ?? {}, field), `${field} is missing from the body`).toBe(true);
    }

    expect(entry?.absenceReason).toBeNull();
    expect(entry?.note).toBeNull();
    expect(entry?.detectedKind).toBeNull();
    expect(entry?.detectedAt).toBeNull();
    expect(entry?.clientClaimedAt).toBeNull();
  });
});

describe('the order is total, and stated rather than inherited', () => {
  it('orders by dayDate ascending', async () => {
    await seed(userId, '2026-09-03');
    await seed(userId, '2026-01-14');
    await seed(userId, '2026-05-22');

    const days = entriesOf(await readYear('2026')).map((entry) => entry.dayDate);

    expect(days).toEqual(['2026-01-14', '2026-05-22', '2026-09-03']);
  });

  it('orders one day FULL, AM, PM - the literal sequence', async () => {
    // INSERTED IN THE WRONG ORDER ON PURPOSE, so "is sorted" cannot pass by the
    // rows happening to arrive sorted.
    await seed(userId, '2026-04-07', { portion: 'PM' });
    await seed(userId, '2026-04-07', { portion: 'FULL' });
    await seed(userId, '2026-04-07', { portion: 'AM' });

    const portions = entriesOf(await readYear('2026')).map((entry) => entry.portion);

    expect(portions).toEqual(['FULL', 'AM', 'PM']);
  });

  it('sorts adverse input, which the route-level test above cannot prove', () => {
    // WHY THIS EXISTS, and it is the finding of this increment.
    //
    // Planting `return 0` in the comparator left ALL FORTY tests passing. The
    // cause: @@unique([userId, dayDate, portion]) is a btree index on those
    // columns, so Postgres serves rows ALREADY ordered by portion - measured,
    // rows inserted PM, FULL, AM come back FULL, AM, PM with no sort at all.
    // The assertion above was satisfied by the database's index order, never by
    // the code under test.
    //
    // So the comparator is given input the database did not order. THIS test is
    // the one that goes red when the sort is removed.
    const shuffled = [
      { dayDate: '2026-05-22', portion: 'PM' },
      { dayDate: '2026-01-14', portion: 'PM' },
      { dayDate: '2026-05-22', portion: 'FULL' },
      { dayDate: '2026-01-14', portion: 'AM' },
      { dayDate: '2026-05-22', portion: 'AM' },
      { dayDate: '2026-01-14', portion: 'FULL' },
    ];

    expect([...shuffled].sort(byDayThenPortion)).toEqual([
      { dayDate: '2026-01-14', portion: 'FULL' },
      { dayDate: '2026-01-14', portion: 'AM' },
      { dayDate: '2026-01-14', portion: 'PM' },
      { dayDate: '2026-05-22', portion: 'FULL' },
      { dayDate: '2026-05-22', portion: 'AM' },
      { dayDate: '2026-05-22', portion: 'PM' },
    ]);
  });

  it('covers every portion the schema has, so adding one goes red here', async () => {
    // R171: the expectation is READ FROM THE ENUM, never typed beside it. A
    // fourth portion added to the schema and forgotten in PORTION_ORDER would
    // sort last by accident rather than by decision.
    expect([...PORTION_ORDER].sort()).toEqual(Object.keys(EntryPortion).sort());
  });
});

describe('the year window', () => {
  it('excludes the days on either side, each PROVEN to exist', async () => {
    await seed(userId, '2027-12-31');
    await seed(userId, '2028-01-01');
    await seed(userId, '2028-12-31');
    await seed(userId, '2029-01-01');

    const inside = entriesOf(await readYear('2028')).map((entry) => entry.dayDate);

    // PRESENCE FIRST: both edges of 2028 are in.
    expect(inside).toEqual(['2028-01-01', '2028-12-31']);

    // THEN ABSENCE, and the neighbours are proven to EXIST by fetching their
    // own years - without which "2029-01-01 is absent" is satisfied by an empty
    // database.
    expect(entriesOf(await readYear('2027')).map((entry) => entry.dayDate)).toEqual(['2027-12-31']);
    expect(entriesOf(await readYear('2029')).map((entry) => entry.dayDate)).toEqual(['2029-01-01']);
  });

  it('includes 31 December, which a half-open bound computed wrong would drop', async () => {
    await seed(userId, '2026-12-31');

    expect(entriesOf(await readYear('2026'))).toHaveLength(1);
  });

  it('accepts the largest four-digit year without throwing', async () => {
    // A half-open upper bound would compute the day AFTER 9999-12-31, which is
    // not a four-digit calendar day and throws inside assertDay - a 500 on an
    // input the route's own rule accepts.
    const response = await GET(get('?year=9999'));

    expect(response.status).toBe(200);
  });
});

describe('tenancy: the token decides, and nothing else does', () => {
  it('never returns another user rows, in a run that proves both years are non-empty', async () => {
    await seed(userId, '2026-04-07');
    await seed(otherId, '2026-06-11');
    await seed(otherId, '2026-06-12');

    const mine = entriesOf(await readYear('2026'));

    // PRESENCE ON BOTH SIDES FIRST. Without the second read, "the other user's
    // rows do not appear" would pass against a route that returns nothing, and
    // against a database where the other user has nothing.
    const theirs = entriesOf(await readYear('2026', otherToken));

    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(2);

    expect(mine.map((entry) => entry.dayDate)).toEqual(['2026-04-07']);
    expect(theirs.map((entry) => entry.dayDate)).toEqual(['2026-06-11', '2026-06-12']);
  });

  it('ignores a userId planted in the query string', async () => {
    await seed(userId, '2026-04-07');
    await seed(otherId, '2026-06-11');

    const url = new URL(`${ORIGIN}/api/v1/entries`);

    url.searchParams.set('year', '2026');
    url.searchParams.set('userId', otherId);

    const request = new Request(url.toString(), {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });

    // R180: VERIFY THE PLANT LANDED, and that it names a real other user.
    expect(new URL(request.url).searchParams.get('userId')).toBe(otherId);
    expect(otherId).not.toBe(userId);

    const response = await GET(request);

    // REFUSED, because `userId` is an unknown parameter and the query is
    // strict. Either outcome keeps the rows apart; refusing also tells the
    // client author.
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'unknown_parameter' });
  });

  it('returns nothing to a caller whose only identity is planted', async () => {
    // THE NON-VACUITY HALF. The two above would pass against a route that
    // ignored everything including the token.
    await seed(userId, '2026-04-07');

    const response = await GET(get('?year=2026', ''));

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ code: 'missing_token' });
  });
});

describe('lastModifiedAt says whether the day was edited (R215)', () => {
  it('is null on a day nobody has edited', async () => {
    // PROVEN BEFORE IT WAS DESIGNED: Entry.updatedAt is stamped by Prisma at
    // query execution while firstRecordedAt is the batch clock, so they differ
    // by milliseconds on a row nobody touched. Backing this field with
    // updatedAt would make SPEC 12's "last-modified timestamp when different"
    // fire on EVERY row, and the annex column would stop meaning anything.
    await seed(userId, '2026-04-07');

    const [entry] = entriesOf(await readYear('2026'));

    expect(entry?.lastModifiedAt).toBeNull();
  });

  it('carries the MODIFIED event instant once the day is edited', async () => {
    const created = await seed(userId, '2026-04-07');

    await prisma.entryEvent.create({
      data: {
        userId,
        entryId: created.id,
        action: 'MODIFIED',
        kind: 'HOME',
        provenance: 'MANUAL',
        dayDate: new Date('2026-04-07T00:00:00.000Z'),
        portion: 'FULL',
        recordedAt: new Date('2026-04-09T07:15:02.870Z'),
      },
    });

    const [entry] = entriesOf(await readYear('2026'));

    expect(entry?.lastModifiedAt).toBe('2026-04-09T07:15:02.870Z');
  });

  it('ignores a CREATED event, which is not a modification', async () => {
    // BOTH DIRECTIONS. A derivation that took max(recordedAt) over ALL events
    // would report every freshly created day as modified, which is the same
    // defect as using updatedAt and would pass a test that only ever looked at
    // an edited row.
    const created = await seed(userId, '2026-04-07');

    await prisma.entryEvent.create({
      data: {
        userId,
        entryId: created.id,
        action: 'CREATED',
        kind: 'CH',
        provenance: 'MANUAL',
        dayDate: new Date('2026-04-07T00:00:00.000Z'),
        portion: 'FULL',
      },
    });

    const [entry] = entriesOf(await readYear('2026'));

    expect(entry?.lastModifiedAt).toBeNull();
  });

  it('takes the LATEST modification when a day was edited twice', async () => {
    const created = await seed(userId, '2026-04-07');

    for (const recordedAt of ['2026-04-09T07:15:02.870Z', '2026-05-02T11:00:00.000Z']) {
      await prisma.entryEvent.create({
        data: {
          userId,
          entryId: created.id,
          action: 'MODIFIED',
          kind: 'HOME',
          provenance: 'MANUAL',
          dayDate: new Date('2026-04-07T00:00:00.000Z'),
          portion: 'FULL',
          recordedAt: new Date(recordedAt),
        },
      });
    }

    const [entry] = entriesOf(await readYear('2026'));

    expect(entry?.lastModifiedAt).toBe('2026-05-02T11:00:00.000Z');
  });

  it('attributes each modification to its own day', async () => {
    // A grouped query keyed wrongly - or a join that fans out - would give both
    // days the same instant. Two days, one edited, is what catches it.
    const edited = await seed(userId, '2026-04-07');

    await seed(userId, '2026-04-08');

    await prisma.entryEvent.create({
      data: {
        userId,
        entryId: edited.id,
        action: 'MODIFIED',
        kind: 'HOME',
        provenance: 'MANUAL',
        dayDate: new Date('2026-04-07T00:00:00.000Z'),
        portion: 'FULL',
        recordedAt: new Date('2026-04-09T07:15:02.870Z'),
      },
    });

    const entries = entriesOf(await readYear('2026'));

    expect(entries.map((entry) => entry.lastModifiedAt)).toEqual([
      '2026-04-09T07:15:02.870Z',
      null,
    ]);
  });
});

describe('the read is unbounded, and that is a proven claim', () => {
  it('returns a saturated leap year whole - every row, no truncation', async () => {
    // THE CEILING IS COMPUTED, NEVER TYPED (R171). It is a structural
    // consequence of @@unique([userId, dayDate, portion]): one row per portion
    // per day. Growing EntryPortion changes this number and the test follows.
    const portions = Object.keys(EntryPortion);
    const days: string[] = [];
    const cursor = new Date('2028-01-01T00:00:00.000Z');

    while (cursor.getUTCFullYear() === 2028) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    expect(days).toHaveLength(366);

    const expected = days.length * portions.length;

    await prisma.entry.createMany({
      data: days.flatMap((dayDate) =>
        portions.map((portion) => ({
          userId,
          dayDate: new Date(`${dayDate}T00:00:00.000Z`),
          portion: portion as 'FULL',
          kind: 'CH' as const,
          clientMutationId: mutation(),
          note: 'x'.repeat(500),
        })),
      ),
    });

    const body = await readYear('2028');
    const entries = entriesOf(body);

    expect(entries).toHaveLength(expected);

    // NOT MERELY THE COUNT. A wrong window holding the right number of rows
    // satisfies a count; the last element and the day set do not.
    expect(entries.at(-1)?.dayDate).toBe('2028-12-31');
    expect(entries.at(-1)?.portion).toBe('PM');
    expect(new Set(entries.map((entry) => entry.dayDate)).size).toBe(366);

    // ONLY NOW is the absence of pagination meaningful - asserted after the
    // full set is established, never before. On an empty response every one of
    // these holds for the wrong reason.
    for (const key of ['nextCursor', 'cursor', 'page', 'hasMore', 'total', 'count', 'limit']) {
      expect(Object.hasOwn(body, key), `${key} must not be in the envelope`).toBe(false);
    }
  });
});

describe('the query string is strict', () => {
  it('refuses an unknown parameter and NAMES it', async () => {
    const response = await GET(get('?year=2026&limit=50'));
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: 'unknown_parameter' });

    // NAMED, so the failure is diagnosable from the client own crash report.
    // A strict refusal whose cause is invisible turns a one-line server fix
    // into a hunt through somebody else infrastructure.
    expect(JSON.stringify(body)).toContain('limit');
  });

  it('refuses a missing year', async () => {
    const response = await GET(get(''));

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'invalid_year' });
  });

  it.each([
    ['not a number', 'deux-mille-vingt-six'],
    ['too few digits', '202'],
    ['too many digits', '20260'],
    ['a float', '2026.0'],
    ['signed', '+2026'],
    ['padded', ' 2026'],
    ['empty', ''],
  ])('refuses a year that is %s', async (_label, year) => {
    const response = await GET(get(`?year=${encodeURIComponent(year)}`));

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'invalid_year' });
  });

  it('refuses a repeated year parameter rather than picking one', async () => {
    const response = await GET(get('?year=2026&year=2027'));

    expect(response.status).toBe(400);
  });
});

describe('AC2 reaches the read path too: no coordinate, in either direction', () => {
  it.each([
    ['latitude', '?year=2026&latitude=46.2'],
    ['a contained name', '?year=2026&lastKnownLongitude=6.1'],
    ['accuracy', '?year=2026&accuracy=12'],
    ['mixed case', '?year=2026&Lat=46.2'],
  ])('refuses %s in the query string', async (_label, query) => {
    const request = get(query);

    // R180: the plant is in the URL the handler will see.
    expect(new URL(request.url).search).toContain('=');

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'coordinates_refused' });
  });

  it('says nothing about the VALUE in its answer', async () => {
    const response = await GET(get('?year=2026&latitude=46.20731'));

    expect(JSON.stringify(await json(response))).not.toContain('46.20731');
  });

  it('prefers the coordinate refusal over the unknown-parameter one', async () => {
    // THE ORDER IS THE POINT. `latitude` is BOTH a coordinate and an unknown
    // parameter. If validation ran first, the more interesting fact - that a
    // client is sending coordinates - would never be recorded.
    const response = await GET(get('?year=2026&latitude=46.2'));

    expect(await json(response)).toMatchObject({ code: 'coordinates_refused' });
  });
});

describe('the response is never cached', () => {
  it('carries no-store and varies on Authorization', async () => {
    await seed(userId, '2026-04-07');

    const response = await GET(get('?year=2026'));

    // ASSERTED ON THE SERVED RESPONSE, not trusted to a route config. An
    // authenticated GET is the one shape a cache will happily treat as public,
    // and the failure mode is one person year served to another.
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('vary')).toContain('Authorization');
  });
});

describe('what POST wrote is what GET returns', () => {
  it('round-trips a batch through both routes (R204)', async () => {
    const { POST } = await import('@/app/api/v1/entries/route');

    const posted = await POST(
      new Request(`${ORIGIN}/api/v1/entries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          entries: [
            {
              clientMutationId: mutation(),
              dayDate: '2026-04-07',
              kind: 'CH',
              note: 'journee en Suisse',
              provenance: 'DETECTED_CORRECTED',
              detectedKind: 'HOME',
              detectedAt: '2026-04-07T17:02:11.000Z',
              clientClaimedAt: '2026-04-07T18:44:02.000Z',
            },
          ],
        }),
      }),
    );

    expect(posted.status).toBe(200);

    const [entry] = entriesOf(await readYear('2026'));

    // EVERY FIELD THE CLIENT SENT, BACK AS IT WAS SENT - and the two the server
    // assigned. This is the pair FW22 proved was worth testing: the sign-in
    // email addressed a route nobody had written, and every module test passed.
    expect(entry).toMatchObject({
      dayDate: '2026-04-07',
      portion: 'FULL',
      kind: 'CH',
      note: 'journee en Suisse',
      provenance: 'DETECTED_CORRECTED',
      detectedKind: 'HOME',
      detectedAt: '2026-04-07T17:02:11.000Z',
      clientClaimedAt: '2026-04-07T18:44:02.000Z',
      lastModifiedAt: null,
    });

    expect(typeof entry?.firstRecordedAt).toBe('string');
    expect(entry?.clientMutationId).toEqual(expect.any(String));
  });

  it('reports the server clock, not the client claim, as firstRecordedAt', async () => {
    const { POST } = await import('@/app/api/v1/entries/route');

    const claimed = '2020-01-01T00:00:00.000Z';

    await POST(
      new Request(`${ORIGIN}/api/v1/entries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          entries: [
            {
              clientMutationId: mutation(),
              dayDate: '2026-04-07',
              kind: 'CH',
              clientClaimedAt: claimed,
            },
          ],
        }),
      }),
    );

    const [entry] = entriesOf(await readYear('2026'));

    // SPEC 8, END TO END. The client asserted 2020; the server recorded now,
    // and the read path shows BOTH so a reader can see the gap rather than
    // being told one number and asked to believe it.
    expect(entry?.clientClaimedAt).toBe(claimed);
    expect(new Date(String(entry?.firstRecordedAt)).getUTCFullYear()).toBeGreaterThan(2020);
  });
});

describe('the census: no column joins or leaves the wire contract by accident', () => {
  it('accounts for every Entry column as exposed, derived or deliberately withheld', async () => {
    // AGAINST THE LIVE TABLE, NOT THE DMMF. Prisma's datamodel is produced by
    // `prisma generate`, and FW23-CI established that a generated client can
    // exist on one machine and not on a fresh install - so a census against it
    // can be green while the real table has a column the route is about to
    // expose. information_schema is what the route actually reads from, and
    // this test runs in tests/db, after migrate: the right subject at the right
    // moment (R182).
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Entry' AND table_schema = current_schema()
    `;

    // PRESENCE FIRST. A query returning nothing would make every assertion
    // below hold vacuously - the census would certify a table it never read.
    expect(columns.length, 'no columns found for Entry').toBeGreaterThan(0);

    const live = columns.map((row) => row.column_name).sort();
    const exposedColumns = ENTRY_READ_FIELDS.filter(
      (field) => !ENTRY_DERIVED_FIELDS.includes(field as 'lastModifiedAt'),
    );

    // BOTH DIRECTIONS.
    //
    // A column the table has and neither list names is a column somebody added
    // without deciding whether a client may see it - the decision that must not
    // be made by default.
    const unaccounted = live.filter(
      (column) =>
        !exposedColumns.includes(column as 'id') &&
        !ENTRY_NOT_EXPOSED.includes(column as 'userId'),
    );

    expect(
      unaccounted,
      'Entry has columns that are neither exposed nor deliberately withheld. ' +
        'Add each to ENTRY_READ_FIELDS or to ENTRY_NOT_EXPOSED - by decision, ' +
        'not by default.',
    ).toEqual([]);

    // And a name in either list that the table does not have is a promise to a
    // client that nothing can keep.
    const invented = [...exposedColumns, ...ENTRY_NOT_EXPOSED].filter(
      (field) => !live.includes(field),
    );

    expect(
      invented,
      'these are named as Entry columns and the table has no such column',
    ).toEqual([]);
  });

  it('keeps the withheld list from growing quietly', async () => {
    // ASSERTED, NOT MERELY SMALL (R206's corollary). Exemption lists growing
    // quietly is how the contrast audit, the threshold guard and maxDiffPixels
    // each nearly failed. Adding a third entry here must be a deliberate act
    // that survives challenge on its own.
    expect([...ENTRY_NOT_EXPOSED].sort()).toEqual(['updatedAt', 'userId']);
    expect([...ENTRY_DERIVED_FIELDS]).toEqual(['lastModifiedAt']);
  });
});

describe('what an edit keeps and what it clears - found by the walkthrough', () => {
  // THE WALKTHROUGH FOUND THIS, and it is the instrument working as R176
  // describes: the returned row contradicted the document that describes it.
  //
  // The frozen document said `clientClaimedAt` was "what the client asserted,
  // verbatim as sent". Posting a day with a claim and then EDITING it returned
  // null - because the edit asserted none. Nothing is lost (the original claim
  // is in the append-only trail) and the behaviour is right; the SENTENCE was
  // wrong, and a sentence in a frozen contract is the thing being frozen.
  //
  // So the asymmetry is now documented AND asserted. A reader would otherwise
  // assume one rule for all three fields and be wrong about two of them.
  async function post(body: unknown, bearer = token): Promise<Response> {
    const { POST } = await import('@/app/api/v1/entries/route');

    return POST(
      new Request(`${ORIGIN}/api/v1/entries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
        body: JSON.stringify(body),
      }),
    );
  }

  it('KEEPS detectedKind and detectedAt when an edit does not mention them', async () => {
    await post({
      entries: [
        {
          clientMutationId: mutation(),
          dayDate: '2026-04-08',
          kind: 'HOME',
          provenance: 'DETECTED_CONFIRMED',
          detectedKind: 'HOME',
          detectedAt: '2026-04-08T17:02:11.000Z',
        },
      ],
    });

    await post({
      entries: [{ clientMutationId: mutation(), dayDate: '2026-04-08', kind: 'CH' }],
    });

    const [entry] = entriesOf(await readYear('2026'));

    // SPEC 8: deleting the overridden proposal is a review rejection. The pair
    // is what gives the dossier its meaning - detection proposed HOME, the
    // reader said CH, and BOTH are on the record.
    expect(entry).toMatchObject({
      kind: 'CH',
      provenance: 'MANUAL',
      detectedKind: 'HOME',
      detectedAt: '2026-04-08T17:02:11.000Z',
    });
  });

  it('CLEARS clientClaimedAt when an edit does not mention it', async () => {
    await post({
      entries: [
        {
          clientMutationId: mutation(),
          dayDate: '2026-04-07',
          kind: 'CH',
          clientClaimedAt: '2026-04-07T18:44:02.000Z',
        },
      ],
    });

    await post({
      entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'HOME' }],
    });

    const [entry] = entriesOf(await readYear('2026'));

    // AND THIS IS CORRECT, not a bug to fix. `clientClaimedAt` describes the
    // write that produced the row's CURRENT state; the edit asserted nothing,
    // so there is nothing to report. The earlier claim is not lost - see below.
    expect(entry?.clientClaimedAt).toBeNull();
    expect(entry?.kind).toBe('HOME');
  });

  it('keeps the earlier claim in the trail, which is why clearing it is safe', async () => {
    // THE HALF THAT MAKES THE ABOVE ACCEPTABLE. Without this, "an edit clears
    // clientClaimedAt" would be evidence loss rather than a field describing
    // the latest write. Asserted, not assumed.
    await post({
      entries: [
        {
          clientMutationId: mutation(),
          dayDate: '2026-04-07',
          kind: 'CH',
          clientClaimedAt: '2026-04-07T18:44:02.000Z',
        },
      ],
    });

    await post({
      entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'HOME' }],
    });

    const events = await prisma.entryEvent.findMany({
      where: { userId },
      orderBy: { recordedAt: 'asc' },
      select: { action: true, kind: true, clientClaimedAt: true },
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ action: 'CREATED', kind: 'CH' });
    expect(events[0]?.clientClaimedAt?.toISOString()).toBe('2026-04-07T18:44:02.000Z');
    expect(events[1]).toMatchObject({ action: 'MODIFIED', kind: 'HOME', clientClaimedAt: null });
  });

  it('never moves firstRecordedAt, end to end through both routes', async () => {
    await post({
      entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'CH' }],
    });

    const before = entriesOf(await readYear('2026'))[0]?.firstRecordedAt;

    await post({
      entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'HOME' }],
    });

    const after = entriesOf(await readYear('2026'))[0];

    // THE WHOLE EVIDENCE CLAIM. A database trigger refuses any update that
    // moves it; this proves the guarantee survives the route, the write path
    // and the read path rather than only the trigger.
    expect(after?.firstRecordedAt).toBe(before);
    expect(after?.kind).toBe('HOME');
    expect(after?.lastModifiedAt).not.toBeNull();
  });
});

describe('R230: the API payload is the record, and carries the note unaltered', () => {
  // ==========================================================================
  // THE BOUND ON THE CSV MITIGATION, ASSERTED FROM THE OTHER SIDE
  // ==========================================================================
  //
  // `lib/export/csv.ts` prefixes an apostrophe on a note opening with `=`,
  // `+`, `-` or `@`, because a spreadsheet EXECUTES it. This route is not a
  // spreadsheet: it is the record the Android client reads back and the client
  // re-displays, so the note has to arrive exactly as the user typed it.
  //
  // WITHOUT THIS TEST THE MITIGATION HAS NO UPPER BOUND. Somebody moving it
  // "closer to the data" - into the read path, into the write path, into the
  // serialiser - would be tidying, every CSV test would still pass, and the
  // product would silently rewrite what people wrote.

  it('returns a formula-shaped note byte for byte', async () => {
    await seed(userId, '2026-03-02', { note: '=1+1' });

    const [entry] = entriesOf(await readYear('2026'));

    expect(entry?.note).toBe('=1+1');
  });

  it('adds no apostrophe, which is the specific thing the CSV does add', async () => {
    await seed(userId, '2026-03-03', { note: '@SUM(1)' });

    const [entry] = entriesOf(await readYear('2026'));

    expect(entry?.note).not.toBe("'@SUM(1)");
    expect(String(entry?.note).startsWith("'")).toBe(false);
  });
});
