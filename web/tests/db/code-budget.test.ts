// web/tests/db/code-budget.test.ts
//
// FW-CODE-CAP increment 3: the persistent six-digit-code budget (R358, R359).
//
// ============================================================================
// WHAT WAS WRONG, AND WHY NO EXISTING TEST COULD SEE IT
// ============================================================================
//
// `consumeCode` allows five attempts against one issued code, and
// tests/db/code-exchange.test.ts proves that limit precisely. It is true and
// it was never the ceiling, because `issueMagicLink` DELETES the previous row
// on every new request - so asking for a fresh email resets the counter to
// zero. Five per code, and codes are free.
//
// The only thing bounding the total was the code route's in-memory window:
// about 2 880 guesses a day against one chosen address, out of 10^6, and the
// Map empties on every deploy. Every test in the suite passed throughout,
// because each was asking about ONE code.
//
// THIS FILE ASKS ABOUT THE ADDRESS, ACROSS CODES, and it is a database test
// rather than a unit test for the same reason magic-link.test.ts is: the
// guarantee is a property of PostgreSQL, and a fake would assert my model of
// PostgreSQL rather than PostgreSQL.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  CODE_ATTEMPT_WINDOW_MS,
  MAX_CODE_ATTEMPTS,
  MAX_CODE_ATTEMPTS_PER_DAY,
  consumeCode,
  issueMagicLink,
} from '@/lib/auth/magic-link';

const EMAIL = 'budget@example.com';
const OTHER = 'voisine@example.com';

/** Never the issued code: six digits that are wrong by construction here. */
const WRONG = '000001';

beforeEach(async () => {
  await prisma.codeAttempt.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Spend `n` attempts against a freshly issued code, staying under the per-code limit. */
async function spend(email: string, n: number): Promise<void> {
  let left = n;

  while (left > 0) {
    await issueMagicLink(email);

    const burst = Math.min(left, MAX_CODE_ATTEMPTS);

    for (let i = 0; i < burst; i += 1) {
      await consumeCode(email, WRONG);
    }

    left -= burst;
  }
}

describe('the constants say what the budget is', () => {
  it('names ten attempts per address per rolling twenty-four hours', () => {
    expect(MAX_CODE_ATTEMPTS_PER_DAY).toBe(10);
    expect(CODE_ATTEMPT_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('is a tighter ceiling than the per-code limit it sits above', () => {
    // The point of the budget: the per-code limit resets on every new request,
    // so the two numbers are not comparable one-to-one - what matters is that
    // this one is NOT reset by a new request, which the tests below assert.
    expect(MAX_CODE_ATTEMPTS_PER_DAY).toBeGreaterThan(MAX_CODE_ATTEMPTS);
  });
});

describe('the budget is spent across every code issued in the window', () => {
  it('refuses the eleventh attempt even when the code is CORRECT', async () => {
    // Ten attempts spread over three successive requests - which is exactly
    // the move the per-code counter cannot see, because each request replaces
    // the row the counter lives in.
    await spend(EMAIL, MAX_CODE_ATTEMPTS_PER_DAY);

    // A brand new request, and the right code for it.
    const issued = await issueMagicLink(EMAIL);
    const result = await consumeCode(EMAIL, issued.code);

    expect(result).toEqual({ ok: false, reason: 'too_many_attempts' });
  });

  it('counts every attempt, whichever code it was aimed at', async () => {
    await spend(EMAIL, MAX_CODE_ATTEMPTS_PER_DAY);

    expect(await prisma.codeAttempt.count()).toBe(MAX_CODE_ATTEMPTS_PER_DAY);
  });

  it('leaves the ninth and tenth attempts inside the budget', async () => {
    // R196's shape: a budget that refuses EVERYTHING passes the test above
    // perfectly. The tenth attempt must still be compared.
    await spend(EMAIL, MAX_CODE_ATTEMPTS_PER_DAY - 1);

    const issued = await issueMagicLink(EMAIL);

    expect(await consumeCode(EMAIL, issued.code)).toEqual({ ok: true, email: EMAIL });
  });

  it('is per address - a neighbour who has spent nothing is unaffected', async () => {
    await spend(EMAIL, MAX_CODE_ATTEMPTS_PER_DAY);

    const issued = await issueMagicLink(OTHER);

    expect(await consumeCode(OTHER, issued.code)).toEqual({ ok: true, email: OTHER });
  });
});

describe('the window rolls', () => {
  it('stops counting an attempt older than the window', async () => {
    await spend(EMAIL, MAX_CODE_ATTEMPTS_PER_DAY);

    // Age every attempt past the window. Done by moving the rows rather than
    // by waiting a day, and by moving them through Prisma rather than by
    // computing the address hash here - the hash is the module's business.
    await prisma.codeAttempt.updateMany({
      data: { attemptedAt: new Date(Date.now() - CODE_ATTEMPT_WINDOW_MS - 60_000) },
    });

    const issued = await issueMagicLink(EMAIL);

    expect(await consumeCode(EMAIL, issued.code)).toEqual({ ok: true, email: EMAIL });
  });

  it('still counts an attempt made an hour inside the window', async () => {
    await spend(EMAIL, MAX_CODE_ATTEMPTS_PER_DAY);

    await prisma.codeAttempt.updateMany({
      data: { attemptedAt: new Date(Date.now() - CODE_ATTEMPT_WINDOW_MS + 60 * 60 * 1000) },
    });

    const issued = await issueMagicLink(EMAIL);

    expect(await consumeCode(EMAIL, issued.code)).toEqual({ ok: false, reason: 'too_many_attempts' });
  });
});

describe('a success does not buy the budget back', () => {
  it('keeps every attempt on the record after a correct code is accepted', async () => {
    await spend(EMAIL, 3);

    const issued = await issueMagicLink(EMAIL);

    expect(await consumeCode(EMAIL, issued.code)).toEqual({ ok: true, email: EMAIL });

    // Three wrong guesses plus the successful exchange: four slots taken, and
    // none of them refunded. A budget that cleared on success would be a
    // budget an attacker resets by signing in to an address they do hold.
    expect(await prisma.codeAttempt.count()).toBe(4);
  });
});

describe('the slot is claimed atomically, so a burst cannot overspend', () => {
  it('grants exactly ten slots to a burst of thirty parallel guesses', async () => {
    // NO OUTSTANDING CODE, deliberately. With one issued, the per-code counter
    // would stop the comparisons at five and this test would pass while
    // proving nothing about the budget. With none, the ONLY thing that can
    // distinguish the thirty answers is whether the budget slot was granted:
    // a granted slot falls through to `invalid_code`, a refused one answers
    // `too_many_attempts`.
    const results = await Promise.all(
      Array.from({ length: 30 }, () => consumeCode(EMAIL, WRONG)),
    );

    const compared = results.filter(
      (one) => !one.ok && one.reason === 'invalid_code',
    ).length;
    const refused = results.filter(
      (one) => !one.ok && one.reason === 'too_many_attempts',
    ).length;

    expect(compared).toBe(MAX_CODE_ATTEMPTS_PER_DAY);
    expect(refused).toBe(30 - MAX_CODE_ATTEMPTS_PER_DAY);

    // And the table agrees with the answers, which is the half that catches a
    // claim that was granted and then not recorded.
    expect(await prisma.codeAttempt.count()).toBe(MAX_CODE_ATTEMPTS_PER_DAY);
  });
});
