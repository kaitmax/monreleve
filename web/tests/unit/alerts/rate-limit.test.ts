// web/tests/unit/alerts/rate-limit.test.ts
//
// FW14 increment 2: the limit on a public endpoint that sends email.
//
// WHAT IS BEING PROTECTED. Not CPU. POST /api/alertes causes a message to be
// delivered to an address somebody else typed, so without a limit a script
// can walk a list and make our domain mail every one of them. It also prices
// the timing side-channel that tests/db/subscribe-enumeration.test.ts
// documents: distinguishing a confirmed address from a new one by how long
// the response takes needs many samples, and five per ten minutes is not
// many.

import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { checkRate, clientKey, resetRateLimit } from '@/lib/alerts/rate-limit';

const T0 = 1_770_000_000_000;
const MINUTE = 60_000;

beforeEach(() => {
  resetRateLimit();
});

describe('the window', () => {
  it('allows five and refuses the sixth', () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(checkRate('1.2.3.4', T0).allowed, `attempt ${attempt}`).toBe(true);
    }

    expect(checkRate('1.2.3.4', T0).allowed).toBe(false);
  });

  it('says how long to wait, in seconds', () => {
    for (let attempt = 0; attempt < 5; attempt += 1) checkRate('1.2.3.4', T0);

    const refused = checkRate('1.2.3.4', T0 + 4 * MINUTE);

    expect(refused.allowed).toBe(false);
    expect(refused.retryAfter).toBe(6 * 60);
  });

  it('forgives once the window has passed', () => {
    for (let attempt = 0; attempt < 6; attempt += 1) checkRate('1.2.3.4', T0);

    expect(checkRate('1.2.3.4', T0 + 10 * MINUTE + 1).allowed).toBe(true);
  });

  it('counts each client separately', () => {
    // NON-VACUITY, and the failure it guards against is the one that matters:
    // a limiter keyed on nothing would refuse the sixth visitor to the site
    // rather than the sixth attempt from one of them.
    for (let attempt = 0; attempt < 6; attempt += 1) checkRate('1.2.3.4', T0);

    expect(checkRate('5.6.7.8', T0).allowed).toBe(true);
  });

  it('does not leak the previous window into the next', () => {
    for (let attempt = 0; attempt < 5; attempt += 1) checkRate('1.2.3.4', T0);

    // A new window starts here, so five more are allowed - not zero, and not
    // one.
    const later = T0 + 11 * MINUTE;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(checkRate('1.2.3.4', later).allowed, `attempt ${attempt}`).toBe(true);
    }

    expect(checkRate('1.2.3.4', later).allowed).toBe(false);
  });
});

describe('who is asking', () => {
  it('takes the entry the TRUSTED PROXY wrote, not the one the client sent', () => {
    // THIS TEST ASSERTED THE VULNERABILITY (R362). It required 9.9.9.9 -
    // the value a client puts in the header - on the reasoning that "the
    // proxy appends the real peer; anything before it was sent by the
    // client".
    //
    // The first half of that sentence is right and the conclusion inverts
    // it. Because the proxy APPENDS, the entry it wrote is at the END of
    // the list; the front is the part the client controls. Reading the
    // first entry is what let any caller choose its own rate-limit bucket,
    // which is the hole FW-CODE-CAP exists to close - and this suite was
    // holding it open, green, with a comment explaining why it was right.
    const headers = new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1, 10.0.0.2' });

    // One trusted hop by default: the last entry, written by Traefik.
    expect(clientKey(headers)).toBe('10.0.0.2');
  });

  it('trims, because proxies write the list with spaces', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': '  9.9.9.9 ' }))).toBe('9.9.9.9');
  });

  it('falls back to one shared bucket when there is no header', () => {
    // Strict rather than lax: with no proxy in front, everybody shares a
    // window. A per-request unique key would be no limit at all, which is
    // the wrong way to fail.
    expect(clientKey(new Headers())).toBe('unknown');
    expect(clientKey(new Headers({ 'x-forwarded-for': '   ' }))).toBe('unknown');
  });

  it('never returns an empty key', () => {
    // An empty string is a real Map key, so an empty bucket would silently
    // become "everyone with a blank header" - which is fine - but it reads
    // as a bug at the call site. Named instead.
    for (const value of ['', '   ', ',', ' , ']) {
      expect(clientKey(new Headers({ 'x-forwarded-for': value })).length).toBeGreaterThan(0);
    }
  });
});

describe('R362: the client address is the one the PROXY wrote, not the one the client sent', () => {
  // THE BUG THIS FIXES IS IN THE OLD COMMENT, WHICH HAD IT EXACTLY BACKWARDS.
  // It read: "The FIRST entry is the one the proxy appends for the real peer;
  // taking the last would let a client name its own bucket by sending a
  // header."
  //
  // Proxies APPEND. A client that sends `X-Forwarded-For: 9.9.9.9` and talks
  // to Traefik produces `9.9.9.9, <real peer>` - so the FIRST entry is
  // precisely the value the client chose, and reading it let any caller pick
  // its own rate-limit bucket by changing one header. Per-IP limiting was
  // therefore advisory against exactly the person it exists to stop.
  //
  // The n-th from the RIGHT is the address the n-th trusted hop observed.
  const AFTER = (): void => {
    delete process.env.TRUSTED_PROXY_HOPS;
  };

  afterEach(AFTER);

  const key = (forwarded: string | null): string =>
    clientKey(new Headers(forwarded === null ? {} : { 'x-forwarded-for': forwarded }));

  it('ignores a value the client prepended', () => {
    // The attack, stated plainly: the client claims 9.9.9.9; Traefik appends
    // what it actually saw. The bucket must be the second, every time.
    expect(key('9.9.9.9, 203.0.113.7')).toBe('203.0.113.7');
  });

  it('cannot be made to vary by changing the prepended value', () => {
    // R133's positive half: the assertion above passes for a function that
    // always returns the last entry OR one that always returns a constant.
    // This one requires the key to be STABLE under attacker control and to
    // still track the real peer.
    const spoofs = ['1.1.1.1', 'not-an-ip', '', 'a, b, c'];
    const keys = spoofs.map((s) => key(`${s}, 203.0.113.7`));

    expect(new Set(keys).size, 'the key moved when only the spoof changed').toBe(1);
    expect(keys[0]).toBe('203.0.113.7');
  });

  it('takes the single entry when there is one hop and one value', () => {
    expect(key('203.0.113.7')).toBe('203.0.113.7');
  });

  it('honours TRUSTED_PROXY_HOPS = 2', () => {
    // Two trusted hops - say a CDN in front of Traefik - means the real peer
    // sits one further left: client-sent, realPeer, cdnAddress.
    process.env.TRUSTED_PROXY_HOPS = '2';

    expect(key('9.9.9.9, 203.0.113.7, 198.51.100.4')).toBe('203.0.113.7');
  });

  it('defaults to one hop when the variable is unset', () => {
    delete process.env.TRUSTED_PROXY_HOPS;

    expect(key('9.9.9.9, 203.0.113.7')).toBe('203.0.113.7');
  });

  it('falls back to unknown when the header is shorter than the hop count', () => {
    // A header with fewer entries than trusted hops means the request did not
    // arrive the way the deployment says it does. Guessing an entry would
    // invent a bucket; 'unknown' is the strict answer and matches the
    // no-header case.
    process.env.TRUSTED_PROXY_HOPS = '3';

    expect(key('9.9.9.9, 203.0.113.7')).toBe('unknown');
  });

  it('is unknown with no header, an empty header, or only separators', () => {
    expect(key(null)).toBe('unknown');
    expect(key('')).toBe('unknown');
    expect(key(',')).toBe('unknown');
    expect(key('   ')).toBe('unknown');
  });

  it('ignores a malformed hop count rather than trusting it', () => {
    // An operator typo must not silently widen or break the bucket.
    for (const bad of ['0', '-1', 'two', '']) {
      process.env.TRUSTED_PROXY_HOPS = bad;
      expect(key('9.9.9.9, 203.0.113.7'), bad).toBe('203.0.113.7');
    }
  });
});
