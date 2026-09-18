// web/tests/db/magic-link.test.ts
//
// FW22 increment 2: the sign-in token is single-use, short-lived, and
// consumed ATOMICALLY.
//
// THE PROMPT SAYS "PROVE THE RACE, DO NOT REASON ABOUT IT", and that
// instruction is the whole design of this file. It is easy to write a
// consume function that looks single-use:
//
//     const row = await prisma.verificationToken.findUnique(...)
//     if (row === null) return null
//     await prisma.verificationToken.delete(...)
//     return row
//
// and that code is correct in every sequential test anybody writes for it.
// Two requests arriving together both pass the findUnique, both return the
// row, and the link signs in twice - once for the person who asked, once for
// whoever else has the URL. A mail forwarded to a colleague, a link preview
// fetcher that follows URLs, a phone that retries a tap: none of these are
// exotic, and none of them show up in a sequential test.
//
// So the test below fires the consumptions CONCURRENTLY and asserts that
// exactly one wins. An ablation at the bottom of the FW22 report shows the
// non-atomic version failing it, because a race test that has never been seen
// to fail is a race test nobody should trust.
//
// WHY IT IS A DATABASE TEST rather than a unit test with a fake: atomicity is
// a property OF POSTGRESQL. A fake would assert my model of it, and my model
// is exactly the thing in question.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { MAGIC_LINK_TTL_MS, consumeMagicLink, issueMagicLink } from '@/lib/auth/magic-link';

const EMAIL = 'connexion@example.com';

beforeEach(async () => {
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('issuing a sign-in token', () => {
  it('stores the token against the address and returns it once', async () => {
    const issued = await issueMagicLink(EMAIL);

    expect(issued.token).not.toBe('');

    const rows = await prisma.verificationToken.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.identifier).toBe(EMAIL);
  });

  it('gives the token a short life, stated by the module rather than guessed', async () => {
    // R171: the expectation reads the TTL from the source of truth. A literal
    // here would pass while the constant moved, which is the defect the rule
    // names.
    const before = Date.now();
    const issued = await issueMagicLink(EMAIL);
    const row = await prisma.verificationToken.findFirstOrThrow();

    const life = row.expires.getTime() - before;

    expect(life).toBeGreaterThan(MAGIC_LINK_TTL_MS - 5_000);
    expect(life).toBeLessThanOrEqual(MAGIC_LINK_TTL_MS + 5_000);
    expect(issued.expires.toISOString()).toBe(row.expires.toISOString());
  });

  it('stores a HASH, never the token that went in the email', async () => {
    // THE TABLE IS NOT A LIST OF VALID LINKS. Anyone who can read this table -
    // a backup, a support query, a leaked dump - would otherwise be able to
    // sign in as every person with an unexpired link. The token travels in
    // the email; its hash is what is kept.
    const issued = await issueMagicLink(EMAIL);
    const row = await prisma.verificationToken.findFirstOrThrow();

    expect(row.token).not.toBe(issued.token);
    expect(row.token).toHaveLength(64);
  });
});

describe('consuming it', () => {
  it('returns the address on the first use and null on the second', async () => {
    const issued = await issueMagicLink(EMAIL);

    expect(await consumeMagicLink(EMAIL, issued.token)).toBe(EMAIL);
    expect(await consumeMagicLink(EMAIL, issued.token)).toBeNull();
  });

  it('refuses a token that never existed', async () => {
    expect(await consumeMagicLink(EMAIL, 'jamais-emis')).toBeNull();
  });

  it('refuses a token belonging to another address', async () => {
    // The identifier is part of the key, so a token lifted from one person's
    // mail cannot be replayed against another address.
    const issued = await issueMagicLink(EMAIL);

    expect(await consumeMagicLink('autre@example.com', issued.token)).toBeNull();
    // And the real owner can still use it - the failed attempt consumed
    // nothing.
    expect(await consumeMagicLink(EMAIL, issued.token)).toBe(EMAIL);
  });

  it('refuses an expired token, and removes it', async () => {
    const issued = await issueMagicLink(EMAIL);

    await prisma.verificationToken.updateMany({
      data: { expires: new Date(Date.now() - 1_000) },
    });

    expect(await consumeMagicLink(EMAIL, issued.token)).toBeNull();

    // AN EXPIRED ROW IS DELETED RATHER THAN LEFT. /confidentialite's argument
    // is that this product keeps what it needs for as long as it needs it; a
    // table of dead sign-in attempts is a record of when somebody tried to
    // log in, kept for no purpose.
    expect(await prisma.verificationToken.count()).toBe(0);
  });
});

describe('THE RACE: two consumptions at once, exactly one wins', () => {
  it('lets exactly one of two concurrent uses through', async () => {
    const issued = await issueMagicLink(EMAIL);

    const [first, second] = await Promise.all([
      consumeMagicLink(EMAIL, issued.token),
      consumeMagicLink(EMAIL, issued.token),
    ]);

    const winners = [first, second].filter((result) => result !== null);

    expect(winners).toEqual([EMAIL]);
  });

  it('lets exactly one of ten concurrent uses through', async () => {
    // TWO IS THE CASE; TEN IS THE MARGIN. A lock that is merely narrow rather
    // than atomic can win a two-way race by luck often enough to look green,
    // and this file would then certify it. Ten attempts arriving together
    // make that luck much harder to come by, and the assertion is the same
    // either way: exactly one.
    const issued = await issueMagicLink(EMAIL);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeMagicLink(EMAIL, issued.token)),
    );

    expect(results.filter((result) => result === EMAIL)).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(9);
  });

  it('leaves no row behind after the race', async () => {
    const issued = await issueMagicLink(EMAIL);

    await Promise.all(Array.from({ length: 10 }, () => consumeMagicLink(EMAIL, issued.token)));

    expect(await prisma.verificationToken.count()).toBe(0);
  });
});
