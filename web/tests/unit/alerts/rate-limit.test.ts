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

import { beforeEach, describe, expect, it } from 'vitest';
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
  it('takes the FIRST x-forwarded-for entry, not the last', () => {
    // The proxy appends the real peer; anything before it was sent by the
    // client. Taking the last would let a client name its own bucket by
    // sending a header, which is a rate limiter that anyone can opt out of.
    const headers = new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1, 10.0.0.2' });

    expect(clientKey(headers)).toBe('9.9.9.9');
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
