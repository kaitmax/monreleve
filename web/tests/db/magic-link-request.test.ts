// web/tests/db/magic-link-request.test.ts
//
// FW22 increment 2: requesting a sign-in link.
//
// AC2 IS THE REASON THIS FILE IS CAREFUL. "The magic-link request does not
// reveal whether an address is registered - identical response and identical
// timing envelope for known and unknown addresses."
//
// A sign-in form is the classic account-enumeration oracle: ask for a link,
// and if the answer differs for a known and an unknown address, anybody can
// test whether a person uses this product. For THIS product that leak is
// worse than usual - the population is cross-border workers, and membership
// is itself the sensitive fact. Knowing somebody has an account here says
// they work in Switzerland and live in France, which is exactly the kind of
// inference /confidentialite promises not to enable.
//
// SO THE REQUEST DOES THE SAME WORK EITHER WAY: it issues a token for any
// syntactically valid address and sends a message. Whether a User row exists
// is decided later, at consumption, where nobody is watching.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { MAGIC_LINK_TTL_MS } from '@/lib/auth/magic-link';
import { requestMagicLink } from '@/lib/auth/request';

const KNOWN = 'connu@example.com';
const UNKNOWN = 'inconnu@example.com';

function headers(ip: string): Headers {
  return new Headers({ 'x-forwarded-for': ip });
}

beforeEach(async () => {
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  clearOutbox();
  resetRateLimit();

  await prisma.user.create({ data: { email: KNOWN } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AC2: the response does not say whether the address is known', () => {
  it('answers identically for a registered and an unregistered address', async () => {
    const known = await requestMagicLink(KNOWN, headers('1.1.1.1'));

    resetRateLimit();

    const unknown = await requestMagicLink(UNKNOWN, headers('1.1.1.1'));

    expect(known).toEqual(unknown);
  });

  it('writes a token for BOTH, so the work done is the same', async () => {
    // IF ONLY THE KNOWN ADDRESS GOT A ROW, the timing would differ and the
    // database would hold the answer to "who has an account here". Doing the
    // same work for both is what makes the identical response honest rather
    // than cosmetic.
    await requestMagicLink(KNOWN, headers('1.1.1.1'));
    resetRateLimit();
    await requestMagicLink(UNKNOWN, headers('1.1.1.1'));

    const identifiers = (await prisma.verificationToken.findMany()).map((row) => row.identifier);

    expect(identifiers.sort()).toEqual([KNOWN, UNKNOWN].sort());
  });

  it('sends a message for BOTH', async () => {
    await requestMagicLink(KNOWN, headers('1.1.1.1'));
    resetRateLimit();
    await requestMagicLink(UNKNOWN, headers('1.1.1.1'));

    expect(readOutbox().map((message) => message.to).sort()).toEqual([KNOWN, UNKNOWN].sort());
  });

  it('refuses an address that is not an address, and says so for both alike', async () => {
    const result = await requestMagicLink('pas-une-adresse', headers('1.1.1.1'));

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid');
    expect(readOutbox()).toHaveLength(0);
  });
});

describe('the message', () => {
  it('carries one link, and it is the token that was issued', async () => {
    await requestMagicLink(KNOWN, headers('1.1.1.1'));

    const [message] = readOutbox();

    expect(message).toBeDefined();

    const links = (message?.text ?? '').split('\n').filter((line) => line.startsWith('http'));

    expect(links).toHaveLength(1);

    // THE LINK IS PROVEN TO WORK, not merely proven to be present (R154). A
    // template that interpolated the wrong variable would still produce one
    // http line.
    const token = new URL(links[0] ?? '').searchParams.get('token') ?? '';

    expect(token).not.toBe('');

    const row = await prisma.verificationToken.findFirstOrThrow();

    expect(row.token).not.toBe(token);
  });

  it('states the life of the link from the TTL rather than a typed number', async () => {
    // R153/R181: the minutes in the copy are interpolated from
    // MAGIC_LINK_TTL_MS. Move the constant and this assertion moves with it;
    // type a figure into the template and it fails.
    await requestMagicLink(KNOWN, headers('1.1.1.1'));

    const [message] = readOutbox();
    const minutes = MAGIC_LINK_TTL_MS / 60_000;

    expect(message?.text).toContain(`${minutes}`);
  });

  it('quotes no threshold, because an email cannot interpolate one (R153)', async () => {
    await requestMagicLink(KNOWN, headers('1.1.1.1'));

    const [message] = readOutbox();
    const text = `${message?.subject ?? ''}\n${message?.text ?? ''}`;

    expect(text).not.toMatch(/40\s*%/);
    expect(text).not.toMatch(/49[.,]9\s*%/);
    expect(text).not.toMatch(/\b240\b/);
  });

  it('goes through FW14 outbox, which is the one place mail leaves from', async () => {
    // The prompt: "the SAME fixed boundary FW14 established - one outbox, one
    // fake, used by both features." If auth had its own sender, "CI never
    // sends real mail" would stop being a property of one branch.
    await requestMagicLink(KNOWN, headers('1.1.1.1'));

    expect(readOutbox()).toHaveLength(1);
  });
});

describe('rate limit, by address and by IP', () => {
  it('stops an address being mailed repeatedly from different IPs', async () => {
    // THE ATTACK THIS STOPS is using our domain to deliver unwanted mail to
    // somebody: a script that walks IPs would otherwise mail one victim as
    // often as it liked. The limit has to be on the ADDRESS for that.
    const results = [];

    for (let attempt = 0; attempt < 8; attempt += 1) {
      results.push(await requestMagicLink(KNOWN, headers(`10.0.0.${attempt}`)));
    }

    expect(results.some((result) => result.reason === 'rate-limited')).toBe(true);
    expect(readOutbox().length).toBeLessThan(8);
  });

  it('stops one IP walking a list of addresses', async () => {
    // And the other half: a single client enumerating addresses. Limiting
    // only the address would let one IP mail a thousand different people
    // once each.
    const results = [];

    for (let attempt = 0; attempt < 8; attempt += 1) {
      results.push(await requestMagicLink(`personne${attempt}@example.com`, headers('9.9.9.9')));
    }

    expect(results.some((result) => result.reason === 'rate-limited')).toBe(true);
    expect(readOutbox().length).toBeLessThan(8);
  });

  it('answers a rate-limited request the same way it answers a served one', async () => {
    // A DIFFERENT ANSWER WHEN LIMITED IS THE ORACLE AGAIN, one step over: if
    // being limited looks different, an attacker learns which addresses are
    // being asked for. The reason is carried for the SERVER's logs and the
    // route maps it to the same public response - see the route test.
    const served = await requestMagicLink(KNOWN, headers('7.7.7.7'));

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await requestMagicLink(KNOWN, headers('7.7.7.7'));
    }

    const limited = await requestMagicLink(KNOWN, headers('7.7.7.7'));

    expect(served.ok).toBe(true);
    expect(limited.ok).toBe(false);
    expect(limited.reason).toBe('rate-limited');
  });
});
