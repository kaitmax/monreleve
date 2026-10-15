// web/tests/db/code-sign-in.test.ts
//
// AN-ONBOARD: a six-digit code alongside the link.
//
// ============================================================================
// WHY A SECOND WAY IN, AND WHY IT IS BUILT HERE
// ============================================================================
//
// The sign-in link can open the app only once monreleve.ch exists and its App
// Link is verified; until then tapping it opens a browser and the sign-in
// fails. And people read mail on another device. A six-digit code in the SAME
// email works from anywhere and does not depend on the domain.
//
// The code and the link belong to ONE sign-in request: issued together,
// expiring together, and using either one kills both. That is what makes "the
// code is an additional way in" true rather than "a second, independent
// credential" - two live credentials for one person is two chances to leak.
//
// ============================================================================
// SIX DIGITS ARE SAFE ONLY WITH AN ATTEMPT LIMIT, AND THIS FILE PROVES IT
// ============================================================================
//
// A million combinations is nothing to a script. The defence is the per-request
// attempt counter (MAX_CODE_ATTEMPTS), after which the request is DEAD and the
// person asks for a new one - so the search space a guesser gets is the limit,
// not the million. These tests pin that the counter advances, that the request
// dies at the limit, and that it dies even against the correct code once dead.
//
// Like magic-link.test.ts, this is a DATABASE test: the single-use guarantee
// and the atomic attempt claim are properties of PostgreSQL, and a fake would
// assert my model of them rather than them.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  MAGIC_LINK_TTL_MS,
  MAX_CODE_ATTEMPTS,
  consumeCode,
  consumeMagicLink,
  issueMagicLink,
} from '@/lib/auth/magic-link';

const EMAIL = 'connexion@example.com';

beforeEach(async () => {
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  // FW-CODE-CAP: the per-address budget (R358) OUTLIVES a request on purpose,
  // so it also outlives a test in this file unless it is cleared here. Two
  // tests below failed the moment the budget became real - not because either
  // was wrong, but because each spends attempts against the same address and
  // the sixth test in the file was starting with the first five already gone.
  // That is the behaviour the budget exists to have; this is the fixture
  // catching up with it.
  await prisma.codeAttempt.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('issuing the code beside the link', () => {
  it('returns a six-digit code once, and stores it HASHED', async () => {
    const issued = await issueMagicLink(EMAIL);

    // Six decimal digits, leading zeros kept.
    expect(issued.code).toMatch(/^\d{6}$/u);

    const row = await prisma.verificationToken.findFirstOrThrow();

    // THE TABLE IS NOT A LIST OF VALID CODES. The code travels in the email;
    // its SHA-256 is what is kept, the same rule the link token follows.
    expect(row.code).not.toBeNull();
    expect(row.code).not.toBe(issued.code);
    expect(row.code).toHaveLength(64);
    expect(row.attempts).toBe(0);
  });

  it('expires the code with the link - one request, one lifetime', async () => {
    const before = Date.now();
    const issued = await issueMagicLink(EMAIL);
    const row = await prisma.verificationToken.findFirstOrThrow();

    const life = row.expires.getTime() - before;

    expect(life).toBeGreaterThan(MAGIC_LINK_TTL_MS - 5_000);
    expect(life).toBeLessThanOrEqual(MAGIC_LINK_TTL_MS + 5_000);
    expect(issued.expires.toISOString()).toBe(row.expires.toISOString());
  });
});

describe('exchanging the code', () => {
  it('returns the address on the first use and refuses the second', async () => {
    const issued = await issueMagicLink(EMAIL);

    expect(await consumeCode(EMAIL, issued.code)).toEqual({ ok: true, email: EMAIL });
    // The row is gone, so the code and the link are both spent.
    expect(await prisma.verificationToken.count()).toBe(0);
    expect(await consumeCode(EMAIL, issued.code)).toEqual({ ok: false, reason: 'invalid_code' });
  });

  it('USING THE CODE KILLS THE LINK', async () => {
    const issued = await issueMagicLink(EMAIL);

    expect(await consumeCode(EMAIL, issued.code)).toEqual({ ok: true, email: EMAIL });
    // Same single request: the link token no longer consumes anything.
    expect(await consumeMagicLink(EMAIL, issued.token)).toBeNull();
  });

  it('USING THE LINK KILLS THE CODE', async () => {
    const issued = await issueMagicLink(EMAIL);

    expect(await consumeMagicLink(EMAIL, issued.token)).toBe(EMAIL);
    expect(await consumeCode(EMAIL, issued.code)).toEqual({ ok: false, reason: 'invalid_code' });
  });

  it('refuses a code for an address with no pending request', async () => {
    // No enumeration: the same answer a wrong code gets. An address nobody has
    // requested a link for is indistinguishable from a wrong guess.
    expect(await consumeCode('inconnu@example.com', '123456')).toEqual({
      ok: false,
      reason: 'invalid_code',
    });
  });

  it('refuses a code issued to another address', async () => {
    const issued = await issueMagicLink(EMAIL);

    expect(await consumeCode('autre@example.com', issued.code)).toEqual({
      ok: false,
      reason: 'invalid_code',
    });
    // The real owner's code is untouched by someone else's wrong attempt.
    expect(await consumeCode(EMAIL, issued.code)).toEqual({ ok: true, email: EMAIL });
  });

  it('names an expired request, and removes it', async () => {
    const issued = await issueMagicLink(EMAIL);

    await prisma.verificationToken.updateMany({
      data: { expires: new Date(Date.now() - 1_000) },
    });

    expect(await consumeCode(EMAIL, issued.code)).toEqual({ ok: false, reason: 'code_expired' });
    // Swept, like an expired link: a table of dead sign-in attempts is kept for
    // no purpose.
    expect(await prisma.verificationToken.count()).toBe(0);
  });
});

describe('the attempt limit: six digits are safe only with one', () => {
  /** A wrong six-digit code that is never the issued one. */
  function wrong(issued: string): string {
    return issued === '000000' ? '111111' : '000000';
  }

  it('counts each wrong attempt', async () => {
    const issued = await issueMagicLink(EMAIL);

    expect(await consumeCode(EMAIL, wrong(issued.code))).toEqual({
      ok: false,
      reason: 'invalid_code',
    });

    const row = await prisma.verificationToken.findFirstOrThrow();
    expect(row.attempts).toBe(1);
  });

  it('kills the request at the limit, then refuses even the correct code', async () => {
    const issued = await issueMagicLink(EMAIL);

    for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) {
      expect(await consumeCode(EMAIL, wrong(issued.code))).toEqual({
        ok: false,
        reason: 'invalid_code',
      });
    }

    // The request is now dead. A further attempt - even the RIGHT code - is
    // told the request is spent, not that the code is wrong: the user asks for
    // a new one.
    expect(await consumeCode(EMAIL, issued.code)).toEqual({
      ok: false,
      reason: 'too_many_attempts',
    });
  });
});

describe('THE RACE: two correct exchanges at once, exactly one wins', () => {
  it('lets exactly one of ten concurrent exchanges through', async () => {
    const issued = await issueMagicLink(EMAIL);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeCode(EMAIL, issued.code)),
    );

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.verificationToken.count()).toBe(0);
  });
});
