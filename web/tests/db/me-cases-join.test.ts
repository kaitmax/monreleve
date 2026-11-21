// web/tests/db/me-cases-join.test.ts
//
// IOS-MOVE-ME (R1271, R204). THE /api/v1/me ROUTE AND THE APP'S /me CODEC,
// joined through the REAL route handlers with the one fixture both sides read:
// fixtures/me-cases.json.
//
// The app's /me codec moved from org.json in :app to :shared commonMain
// (kotlinx.serialization), so iOS can compile it. Its Kotlin half of this join
// is android/app/src/test/kotlin/ch/monreleve/app/startup/MeRouteJoinTest.kt:
// it hands every answer case's `body` to the app's RESOLVING decision and every
// patch case's settings to the encoder the app sends, requiring `body` exactly.
// This file is the server half:
//
//   - `answers` carrying a `row`: that row is seeded, and GET /api/v1/me must
//     answer the case's `body` BYTE FOR BYTE - so the bodies the app's codec is
//     proven on are the ones the route really writes, not a hand-typed likeness.
//     (The other answer cases are bodies no route writes - refusals, wrong
//     types, text that is not JSON - and exist for the codec's golden only.)
//   - `patches`: each `body`, exactly as the app sends it, is PATCHed to the
//     real handler; it must answer 200 and the next GET must hold every value.
//
// So a field renamed on either side, a serialisation that changed, or a PATCH
// the strict schema would refuse fails a build, in whichever language moved.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { GET, PATCH } from '@/app/api/v1/me/route';
import { issueTokenPair } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db/client';

interface AnswerCase {
  readonly name: string;
  readonly row?: Record<string, unknown>;
  readonly body: string;
}

interface PatchCase {
  readonly name: string;
  readonly body: string;
}

interface MeCases {
  readonly answers: readonly AnswerCase[];
  readonly patches: readonly PatchCase[];
}

const CASES = JSON.parse(
  readFileSync(join(process.cwd(), '..', 'fixtures', 'me-cases.json'), 'utf8'),
) as MeCases;

const ORIGIN = 'https://monreleve.ch';

const ROUTE_ANSWERS = CASES.answers.filter((c) => c.row !== undefined);

/** The fixture's row as Prisma data: the two instants are Dates there, ISO strings here. */
function rowData(row: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...row };

  for (const key of ['activityStartDate', 'detectionConsentAt']) {
    if (typeof data[key] === 'string') {
      data[key] = new Date(
        key === 'activityStartDate' ? `${data[key] as string}T00:00:00.000Z` : (data[key] as string),
      );
    }
  }

  return data;
}

async function signedIn(row: Record<string, unknown>): Promise<string> {
  const user = await prisma.user.create({
    data: { email: 'me-cases-join@example.invalid', ...rowData(row) },
  });

  return (await issueTokenPair(user.id)).accessToken;
}

function get(bearer: string): Request {
  return new Request(`${ORIGIN}/api/v1/me`, { headers: { authorization: `Bearer ${bearer}` } });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('fixtures/me-cases.json - the route half of the join', () => {
  it('R133: the fixture was read, and holds route answers and patches', () => {
    expect(CASES.answers.length).toBeGreaterThanOrEqual(50);
    expect(ROUTE_ANSWERS.length).toBeGreaterThanOrEqual(4);
    expect(CASES.patches.length).toBeGreaterThanOrEqual(5);
  });

  it.each(ROUTE_ANSWERS.map((c) => [c.name, c] as const))(
    'R204: GET /api/v1/me answers %s byte for byte',
    async (_name, answer) => {
      const response = await GET(get(await signedIn(answer.row ?? {})));

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(answer.body);
    },
  );

  it.each(CASES.patches.map((c) => [c.name, c] as const))(
    'R204: PATCH /api/v1/me accepts the bytes the app sends for %s, and GET holds them',
    async (_name, patch) => {
      const bearer = await signedIn({});
      const sent = JSON.parse(patch.body) as Record<string, unknown>;

      const response = await PATCH(
        new Request(`${ORIGIN}/api/v1/me`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
          body: patch.body,
        }),
      );

      expect(response.status).toBe(200);

      const held = (await (await GET(get(bearer))).json()) as Record<string, unknown>;

      for (const [key, value] of Object.entries(sent)) {
        if (key === 'detectionConsent') {
          // The server stamps the moment; the client only says yes or no.
          expect(held.detectionConsentAt !== null).toBe(value);
        } else {
          expect(held[key]).toEqual(value);
        }
      }
    },
  );
});
