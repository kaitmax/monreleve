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

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { GET } from '@/app/api/v1/dossier/route';
import { buildDossierFor } from '@/lib/dossier/load';
import { DOSSIER_RESPONSE_FIELDS } from '@/lib/dossier/service';

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
    // accidentally correct until the clock moved past it.
    const next = new Date().getUTCFullYear() + 1;

    const response = await GET(get(`?year=${next}`));

    expect(response.status).toBe(400);
    expect((await body(response)).code).toBe('future_year');
  });

  it('accepts the CURRENT year, so the future guard is not refusing the present', async () => {
    // R196: a guard that refuses everything passes the test above perfectly.
    const now = new Date().getUTCFullYear();

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
