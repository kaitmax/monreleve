// web/tests/db/dossier-route.test.ts
//
// GET /api/v1/dossier?year=, through the ROUTE HANDLER. FW26 increment 1.
//
// ============================================================================
// THE ROUTE ASSEMBLES NOTHING
// ============================================================================
//
// `lib/dossier` computes and the route serialises. That pairing has caught
// something in three consecutive tasks, so it is asserted here by a PLANT
// rather than by a comment: a route that recomputes one figure must fail.
//
// The reason it matters is SPEC 868 - the Android Relevé screen and the PDF
// are "the same document at two widths", and they can only be that if there is
// one computation behind both. A figure recomputed in the route is a second
// implementation that agrees until the day it does not, and the surface it
// would disagree with is the one an auditor reads.

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { GET } from '@/app/api/v1/dossier/route';
import { GET as csvExport } from '@/app/api/v1/export/csv/route';
import { GET as pdfExport } from '@/app/api/v1/export/pdf/route';
import { buildDossierFor } from '@/lib/dossier/load';
import { DOSSIER_RESPONSE_FIELDS } from '@/lib/dossier/service';
import { parisDayOf } from '@/lib/entries/day';
import { currentTaxYear } from '@/lib/content/tax-year';

const ORIGIN = 'https://monreleve.ch';

let userId = '';
let otherId = '';
let token = '';
let otherToken = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-c000-${String(counter).padStart(12, '0')}`;
}

function get(query: string, bearer = token): Request {
  return new Request(`${ORIGIN}/api/v1/dossier${query}`, {
    headers: bearer === '' ? {} : { authorization: `Bearer ${bearer}` },
  });
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

async function seed(owner: string, dayDate: string, overrides: Record<string, unknown> = {}) {
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

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: { email: 'dossier@example.com', name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    })
  ).id;

  otherId = (
    await prisma.user.create({
      data: { email: 'autre@example.com', name: 'Autre Personne', canton: 'GE', employmentRate: 100 },
    })
  ).id;

  token = (await issueTokenPair(userId)).accessToken;
  otherToken = (await issueTokenPair(otherId)).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AC1: the four refusals, each named (R198)', () => {
  it('refuses an unauthenticated caller', async () => {
    const response = await GET(get('?year=2026', ''));

    expect(response.status).toBe(401);
  });

  it('refuses a malformed year', async () => {
    const response = await GET(get('?year=abc'));

    expect(response.status).toBe(400);
    expect((await body(response)).code).toBe('invalid_year');
  });

  it('refuses a FUTURE year by its own name', async () => {
    // R171: the current year is read, never typed. A literal would be
    // accidentally correct until the clock moved past it. R582: read in
    // Europe/Paris, the product's tax-year clock, which is the guard's own.
    const next = currentTaxYear() + 1;

    const response = await GET(get(`?year=${next}`));

    expect(response.status).toBe(400);
    expect((await body(response)).code).toBe('future_year');
  });

  it('accepts the CURRENT year, so the future guard is not refusing the present', async () => {
    // R196: a guard that refuses everything passes the test above perfectly.
    const now = currentTaxYear();

    const response = await GET(get(`?year=${now}`));

    expect(response.status).toBe(200);
  });

  it('refuses a coordinate BEFORE it validates the year (SPEC 13.1)', async () => {
    const response = await GET(get('?lat=46.2&year=abc'));

    expect((await body(response)).code).toBe('coordinates_refused');
  });

  it('refuses an unknown parameter and names it', async () => {
    const response = await GET(get('?year=2026&format=json'));

    expect((await body(response)).code).toBe('unknown_parameter');
  });
});

describe('AC1: tenancy comes from the token and from nothing else', () => {
  it('IGNORES a userId planted in the query string', async () => {
    // PLANT ONE, at the HTTP boundary. The route must not read identity from
    // anything a caller controls.
    await seed(userId, '2026-03-02');
    await seed(otherId, '2026-06-11', { kind: 'CH' });

    const response = await GET(get(`?year=2026&userId=${otherId}`));

    // It is refused as an unknown parameter rather than honoured - which is
    // the stronger answer, because a route that silently ignored it would
    // still have read the caller's own data and passed a laxer test.
    expect((await body(response)).code).toBe('unknown_parameter');
  });

  it('serves each caller their OWN year, both proven non-empty', async () => {
    // PLANT TWO. Presence first (R169): two accounts that both have data, so
    // "did not leak" is not satisfied by an empty answer.
    await seed(userId, '2026-03-02');
    await seed(otherId, '2026-06-11', { kind: 'CH' });

    const mine = await body(await GET(get('?year=2026')));
    const theirs = await body(await GET(get('?year=2026', otherToken)));

    expect(mine.titulaire).toBe('Camille Rey');
    expect(theirs.titulaire).toBe('Autre Personne');

    expect(mine.tiles).toMatchObject({ teleworkDays: 1, swissDays: 0 });
    expect(theirs.tiles).toMatchObject({ teleworkDays: 0, swissDays: 1 });
  });
});

describe('AC1: the route serialises what lib/dossier computed', () => {
  it('returns exactly the frozen field set, and no more', async () => {
    await seed(userId, '2026-03-02');

    const payload = await body(await GET(get('?year=2026')));

    expect(Object.keys(payload).sort()).toEqual([...DOSSIER_RESPONSE_FIELDS].sort());
  });

  it('does NOT leak the engine result, which duplicates the zone figures', async () => {
    // `Dossier.result` carries declarableRate, rawRate and both headrooms a
    // second time. Two sources for one figure inside a FROZEN contract is the
    // drift R206 forbids, arriving where it is most expensive to undo.
    await seed(userId, '2026-03-02');

    const payload = await body(await GET(get('?year=2026')));

    expect(payload.result).toBeUndefined();
  });

  it('matches buildDossierFor field for field', async () => {
    // THE NO-RECOMPUTATION ASSERTION. Anything the route derived itself would
    // show up here as a difference from what lib/dossier produced.
    await seed(userId, '2026-03-02');
    await seed(userId, '2026-03-03', { kind: 'ABSENT', absenceReason: 'MALADIE' });

    const payload = await body(await GET(get('?year=2026')));
    const computed = await buildDossierFor(userId, 2026);

    for (const field of DOSSIER_RESPONSE_FIELDS) {
      // `generatedAt` is a server stamp and differs between two builds by
      // design - it is asserted for SHAPE rather than for equality.
      if (field === 'generatedAt') {
        expect(typeof payload[field]).toBe('string');

        continue;
      }

      expect(payload[field], field).toEqual(
        JSON.parse(JSON.stringify(computed[field as keyof typeof computed])),
      );
    }
  });
});

describe('AC1: the payload is honest about what it covers', () => {
  it('marks a provisional period with the span it computed', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { activityStartDate: new Date('2026-07-01T00:00:00.000Z') },
    });
    await seed(userId, '2026-09-02');

    const payload = await body(await GET(get('?year=2026')));
    const period = payload.period as { fraction: number; startDate: string | null };

    expect(period.fraction).toBeLessThan(1);
    expect(period.startDate).toBe('2026-07-01');
  });

  it('is HONEST about an empty year rather than reporting zeros', async () => {
    // A year with no entries returns a computed 0 % like any other. What makes
    // it honest is that the payload says how many days were actually recorded,
    // so a client can tell "nothing logged" from "logged and compliant" -
    // which are the same number and opposite facts.
    const payload = await body(await GET(get('?year=2026')));

    expect(payload.recordedEntries).toBe(0);

    const annex = payload.annex as Array<{ recorded: boolean }>;

    expect(annex.length).toBeGreaterThan(0);
    expect(annex.every((row) => !row.recorded)).toBe(true);
  });

  it('distinguishes a logged compliant year from an empty one', async () => {
    // The other direction, which is what makes the assertion above mean
    // something: both years declare 0 % telework.
    await seed(userId, '2026-03-02', { kind: 'CH' });

    const payload = await body(await GET(get('?year=2026')));

    expect(payload.recordedEntries).toBe(1);
  });

  it('carries the RULE_SET_FALLBACK warning when the year has no rules of its own', async () => {
    // R226 is a sentence in the contract; this is the sentence being true.
    // Only 2026 has a RuleSet, so 2019 is computed under 2026's thresholds and
    // the engine says so. A client that renders the rate and drops the warning
    // publishes a figure derived from rules that did not exist that year.
    await seed(userId, '2019-03-04');

    const payload = await body(await GET(get('?year=2019')));
    const zone = payload.zone as { warnings: Array<{ code: string; appliedYear?: number }> };

    const fallback = zone.warnings.find((warning) => warning.code === 'RULE_SET_FALLBACK');

    expect(fallback).toBeDefined();
    expect(fallback?.appliedYear).toBe(2026);
  });

  it('carries no fallback warning for a year that HAS its own rules', async () => {
    // R196 again: a payload that always warned would pass the test above.
    await seed(userId, '2026-03-02');

    const payload = await body(await GET(get('?year=2026')));
    const zone = payload.zone as { warnings: Array<{ code: string }> };

    expect(zone.warnings.some((warning) => warning.code === 'RULE_SET_FALLBACK')).toBe(false);
  });
});

// ============================================================================
// FW-DOSSIER-EMPTY (R514): A YEAR WITH NO DAYS, AND ITS NEIGHBOURS
// ============================================================================
//
// REPORT-AN-PULL saw GET /dossier?year=2025 answer 500 for the seeded Sam
// Bernard, who has no entries in 2025. The empty year ITSELF is not the cause:
// 'is HONEST about an empty year' above already proves a year with no entries
// answers 200 (R268: referenced, not repeated). Sam's 2025 is different in one
// fact - it ends BEFORE his activityStartDate - and that is what is reproduced
// here, with the server's own log line captured as the cause.
//
// THE CAUSE, read from the source and confirmed by that line:
//   remainingYearFraction (lib/ui/core/period.ts) returns 0 for a start date in
//   a LATER year -> periodFractionOf hands 0 to the engine -> validateInput
//   refuses it (PERIOD_OUT_OF_RANGE, and TOTAL_WORK_DAYS_NOT_POSITIVE because
//   240 x 0 is 0) -> `unwrap` in lib/dossier/monthly.ts throws
//   `the engine refused this input: ...` from annualResult -> the route's catch
//   answers 500 read_failed.
//
// The engine is right to refuse: SPEC 7.4 forbids a zero period, and NEITHER
// engine defines a rate over a zero basis. The first pass pinned today's 500s
// as KNOWN and asked; the operator ruled (FW-DOSSIER-EMPTY addendum 2), and
// these tests now pin the rulings:
//   R580  a year before the activity start is the named refusal
//         year_before_activity (400, future_year's status), on all three
//         surfaces - no 500, and no invented rate. Closes PARK-H1.
//   R583  an account with no canton is 422 canton_missing on /dossier and
//         /export/csv; the PDF keeps its dossier_incomplete. Closes PARK-H2.
//   R582  the future_year guard reads the Paris year. Closes PARK-H3.

/** Every console.error line a request writes, captured rather than printed. */
function captureErrors(): string[] {
  const lines: string[] = [];

  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });

  return lines;
}

describe('FW-DOSSIER-EMPTY R514: a year with no days, and its neighbours', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('R580: a year ending before the activity start is refused as year_before_activity, not a 500', async () => {
    // Sam's shape: started partway through the NEXT year, nothing in this one.
    await prisma.user.update({
      where: { id: userId },
      data: { activityStartDate: new Date('2026-03-02T00:00:00.000Z') },
    });

    const lines = captureErrors();
    const response = await GET(get('?year=2025'));

    // future_year's status: both are years with no meaningful figure.
    expect(response.status).toBe(400);
    expect((await body(response)).code).toBe('year_before_activity');

    // REFUSED BEFORE THE ENGINE IS ASKED, so the engine's refusal - the first
    // pass's log line - is never written, and nothing reads as a failure.
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[dossier\] refused: /u);
    expect(lines.join('\n')).not.toContain('the engine refused');
  });

  it('R580: the three surfaces answer that year the same way', async () => {
    // The first pass measured three answers (500, 500, 422). The PDF's move
    // from 422 dossier_incomplete is additive under docs/api-v1.md 6 - see the
    // report and 11.3 - so all three now name the year for what it is.
    process.env.AUTH_SECRET ??= 'dossier-route-test-secret';
    await prisma.user.update({
      where: { id: userId },
      data: { activityStartDate: new Date('2026-03-02T00:00:00.000Z') },
    });
    captureErrors();

    const csv = await csvExport(
      new Request(`${ORIGIN}/api/v1/export/csv?year=2025`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    const pdf = await pdfExport(
      new Request(`${ORIGIN}/api/v1/export/pdf?year=2025`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect([csv.status, (await body(csv)).code]).toEqual([400, 'year_before_activity']);
    expect([pdf.status, (await body(pdf)).code]).toEqual([400, 'year_before_activity']);
  });

  it('the FIRST year of the activity answers 200, prorated: the refusal above is about the year before', async () => {
    // The boundary of the cause, from the other side (R196): the same person's
    // FIRST year answers 200, so the refusal above is about the year before.
    await prisma.user.update({
      where: { id: userId },
      data: { activityStartDate: new Date('2026-03-02T00:00:00.000Z') },
    });

    const response = await GET(get('?year=2026'));
    const payload = await body(response);

    expect(response.status).toBe(200);
    expect(payload.recordedEntries).toBe(0);
    expect((payload.period as { fraction: number }).fraction).toBeGreaterThan(0);
  });

  it('a year with only absences answers 200: the absences counted, the rate over a real basis', async () => {
    await seed(userId, '2025-08-04', { kind: 'ABSENT', absenceReason: 'CONGE' });
    await seed(userId, '2025-08-05', { kind: 'ABSENT', absenceReason: 'CONGE' });

    const response = await GET(get('?year=2025'));
    const payload = await body(response);
    const tiles = payload.tiles as { workedDays: number; teleworkDays: number };
    const zone = payload.zone as { declarableRate: number };

    expect(response.status).toBe(200);
    expect(payload.recordedEntries).toBe(2);
    expect(payload.absenceDays).toBe(2);
    expect(tiles.teleworkDays).toBe(0);
    // 0 % IS THE ENGINE'S ANSWER, NOT A PLACEHOLDER: the basis it divided by is
    // positive, so nothing here invents a rate over nothing (R515).
    expect(tiles.workedDays).toBeGreaterThan(0);
    expect(zone.declarableRate).toBe(0);
  });

  it('R583: a year with entries but no canton is refused as canton_missing, not a 500', async () => {
    // "No employment settings": canton is the one setting that is null until
    // onboarding - the rate and the method have defaults, and the name has its
    // own refusal (titulaire_missing). The other direction - an account WITH a
    // canton answering 200 - is every other 200 in this file, the absences-only
    // year above among them (R268: referenced, not repeated).
    await prisma.user.update({ where: { id: userId }, data: { canton: null } });
    await seed(userId, '2025-03-03');

    const lines = captureErrors();
    const response = await GET(get('?year=2025'));

    expect(response.status).toBe(422);
    expect((await body(response)).code).toBe('canton_missing');
    expect(lines.join('\n')).toContain('the dossier needs a canton');

    // AND THE EXPORTS. The CSV names it the same way; the PDF keeps the code it
    // already had for this state, dossier_incomplete - not renamed (additive
    // only), and docs/api-v1.md 11.3 says how the two relate.
    process.env.AUTH_SECRET ??= 'dossier-route-test-secret';

    const csv = await csvExport(
      new Request(`${ORIGIN}/api/v1/export/csv?year=2025`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    const pdf = await pdfExport(
      new Request(`${ORIGIN}/api/v1/export/pdf?year=2025`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect([csv.status, (await body(csv)).code]).toEqual([422, 'canton_missing']);
    expect([pdf.status, (await body(pdf)).code]).toEqual([422, 'dossier_incomplete']);
  });

  it('R583: with no canton AND a year before the activity start, the canton is named first', async () => {
    // PRECEDENCE, stated in docs/api-v1.md 8.3 and pinned here: the canton is
    // checked before the period is computed (toTeleworkInput's order), so the
    // account-level gap is named first - on /dossier and /export/csv alike.
    await prisma.user.update({
      where: { id: userId },
      data: { canton: null, activityStartDate: new Date('2026-03-02T00:00:00.000Z') },
    });
    captureErrors();

    const dossier = await GET(get('?year=2025'));
    const csv = await csvExport(
      new Request(`${ORIGIN}/api/v1/export/csv?year=2025`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect([dossier.status, (await body(dossier)).code]).toEqual([422, 'canton_missing']);
    expect([csv.status, (await body(csv)).code]).toEqual([422, 'canton_missing']);
  });

  it('the current year on 1 January answers 200 with an empty document', async () => {
    // A CONTROLLED CLOCK, Date only: noon on New Year's Day is 1 January in
    // UTC and in Paris alike. The token is issued under the same clock, or the
    // bearer check would be measuring the real date instead.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-01T11:00:00.000Z'));

    const bearer = (await issueTokenPair(userId)).accessToken;
    const response = await GET(get('?year=2027', bearer));
    const payload = await body(response);

    expect(response.status).toBe(200);
    expect(payload.taxYear).toBe(2027);
    expect(payload.recordedEntries).toBe(0);
  });

  it('R582: at 00:30 on 1 January in Paris the new year is the CURRENT year, and the next is still future', async () => {
    // 23:30 UTC on 31 December is 00:30 on 1 January in Paris - the hour the
    // two clocks disagree, and the year the Android client asks for
    // (Year.now(Europe/Paris)). The guard reads the Paris year (R582), so the
    // new year has happened.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-31T23:30:00.000Z'));

    // R171: the Paris year is DERIVED from the instant, never typed beside it -
    // and through parisDayOf, a different home from the guard's currentTaxYear,
    // so the test does not merely restate the implementation.
    const parisYear = Number(parisDayOf(new Date()).slice(0, 4));

    // PRESENCE FIRST: this IS the hour the clocks disagree.
    expect(parisYear).toBe(new Date().getUTCFullYear() + 1);

    const bearer = (await issueTokenPair(userId)).accessToken;
    const current = await GET(get(`?year=${parisYear}`, bearer));

    expect(current.status).toBe(200);
    expect((await body(current)).taxYear).toBe(parisYear);

    // BOTH DIRECTIONS (R196): at the same instant the FOLLOWING year is still
    // refused - a guard that stopped refusing anything cannot pass this test.
    const following = await GET(get(`?year=${parisYear + 1}`, bearer));

    expect(following.status).toBe(400);
    expect((await body(following)).code).toBe('future_year');
  });
});
