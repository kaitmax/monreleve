// web/tests/db/subscribe-route.test.ts
//
// FW14 increment 2: POST /api/alertes, called as Next will call it.
//
// THE HANDLER IS THE THING WITH THE SECURITY PROPERTIES, so it is exercised
// directly rather than through its parts. parseSubscription and
// recordSubscription are each tested alone; what only shows up here is what
// the handler DOES with them - that it throws the enumeration distinction
// away before answering, that it never redirects anywhere the request asked
// for, and that a failure still lands the reader back on their own page.

import { TEST_ORIGIN } from '../../lib/content/identity';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/alertes/route';
import { prisma } from '@/lib/db/client';
import { ALERT_STATUS, statusFragment } from '@/lib/alerts/status';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { CALCULATOR_PATH } from '@/lib/content/routes';
import { ALERTES_PATH } from '@/lib/content/alertes';

// R171: the origin is a ROLE - "what the build was configured with" - and
// FW20c made it one constant. It was a literal in thirteen files, which is
// twelve chances for a rename to leave one behind pointing at a host that
// no longer means anything.
const ORIGIN = TEST_ORIGIN;

beforeEach(async () => {
  await prisma.alertSubscriber.deleteMany();
  resetRateLimit();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A form POST, as a browser with no JavaScript sends one. */
function post(fields: Record<string, string>, ip = '1.2.3.4'): NextRequest {
  const body = new URLSearchParams(fields);

  return new NextRequest(`${ORIGIN}/api/alertes`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': ip,
    },
    body: body.toString(),
  });
}

/** The Location header exactly as sent, with no interpretation. */
const rawLocationOf = (response: Response): string =>
  String(response.headers.get('location'));

/**
 * The Location header, resolved so the assertions below can read its parts.
 *
 * THE HEADER ITSELF IS RELATIVE SINCE FW28, and `rawLocationOf` is what
 * asserts that. The handler used to build an absolute URL from
 * `request.nextUrl.origin`, which under `next start` is the developer's
 * localhost and INSIDE THE IMAGE is `http://0.0.0.0:3000` - an address no
 * browser can follow. Four e2e specs failed against the container and passed
 * against next start.
 *
 * Resolving here against a base keeps every pathname/hash/searchParams
 * assertion in this file working, while the raw form is checked where it
 * matters: the open-redirect test below.
 */
const locationOf = (response: Response): URL => new URL(rawLocationOf(response), ORIGIN);

describe('the shape of the answer', () => {
  it('redirects with 303 so a refresh does not re-post', async () => {
    const response = await POST(post({ email: 'a@example.com', source: 'calculateur' }));

    expect(response.status).toBe(303);
  });

  it('sends the reader back to the page they came from', async () => {
    const fromCalculator = await POST(
      post({ email: 'a@example.com', source: 'calculateur' }),
    );
    const fromAlerts = await POST(post({ email: 'b@example.com', source: 'alertes' }));

    expect(locationOf(fromCalculator).pathname).toBe(CALCULATOR_PATH);
    expect(locationOf(fromAlerts).pathname).toBe(ALERTES_PATH);
  });

  it('never redirects anywhere the REQUEST asked for', async () => {
    // An open redirect on a tax-compliance page is a convincing first hop for
    // a phishing link. The target comes from the validated source enum, so a
    // form field naming a URL is simply not read.
    const response = await POST(
      post({
        email: 'a@example.com',
        source: 'calculateur',
        retour: 'https://evil.example/phish',
        redirect: 'https://evil.example/phish',
        next: '//evil.example',
      }),
    );

    const raw = rawLocationOf(response);

    // ======================================================================
    // A RELATIVE Location, AND NOT A PROTOCOL-RELATIVE ONE
    // ======================================================================
    //
    // This is the assertion that got STRONGER when the header stopped
    // carrying an origin. `//evil.example` begins with a slash and is an
    // absolute URL to another host - the browser supplies the scheme - so
    // "starts with /" alone would accept exactly the payload this request
    // sends in its `next` field.
    //
    // It cannot happen today because `path` comes from the closed RETURN_TO
    // map and never from a form field. Asserted anyway, because that is one
    // refactor away from being untrue and the failure would be an open
    // redirect on a page about tax compliance.
    expect(raw.startsWith('/'), `Location must be relative, got ${raw}`).toBe(true);
    expect(raw.startsWith('//'), `Location must not be protocol-relative, got ${raw}`).toBe(
      false,
    );

    expect(locationOf(response).pathname).toBe(CALCULATOR_PATH);
    expect(raw).not.toContain('evil.example');
  });

  it('sets no cookie, on a public route (SPEC D12)', async () => {
    const response = await POST(post({ email: 'a@example.com', source: 'calculateur' }));

    expect(response.headers.get('set-cookie')).toBeNull();
  });
});

describe('AC1: the answer does not say which of the four cases it was', () => {
  const cases = [
    ['a new address', async () => undefined],
    [
      'one already unconfirmed',
      async () => {
        await prisma.alertSubscriber.create({
          data: {
            email: 'known@example.com',
            source: 'calculateur',
            confirmationTokenHash: 'h',
            confirmationExpiresAt: new Date(Date.now() + 1000),
          },
        });
      },
    ],
    [
      'one already CONFIRMED',
      async () => {
        await prisma.alertSubscriber.create({
          data: {
            email: 'known@example.com',
            source: 'calculateur',
            confirmedAt: new Date(),
          },
        });
      },
    ],
    [
      'one that had unsubscribed',
      async () => {
        await prisma.alertSubscriber.create({
          data: {
            email: 'known@example.com',
            source: 'calculateur',
            confirmedAt: new Date(),
            unsubscribedAt: new Date(),
          },
        });
      },
    ],
  ] as const;

  it.each(cases)('%s gets the identical redirect', async (_label, arrange) => {
    await arrange();

    const response = await POST(
      post({ email: 'known@example.com', source: 'calculateur' }),
    );

    expect(response.status).toBe(303);
    expect(locationOf(response).hash).toBe(`#${statusFragment(ALERT_STATUS.ok)}`);
  });

  it('and the four answers are byte-identical to each other', async () => {
    // THE PROPERTY, STATED AS ONE ASSERTION. The table above would still pass
    // if each case returned a different query string that happened to contain
    // "ok". This compares the whole Location header across all four.
    const seen = new Set<string>();

    for (const [, arrange] of cases) {
      await prisma.alertSubscriber.deleteMany();
      resetRateLimit();
      await arrange();

      const response = await POST(
        post({ email: 'known@example.com', source: 'calculateur' }),
      );

      seen.add(String(response.headers.get('location')));
    }

    expect(seen.size).toBe(1);
  });
});

describe('a rejection still lands the reader on their own page', () => {
  it.each([
    ['an empty address', { email: '', source: 'calculateur' }, ALERT_STATUS.missing],
    ['a malformed one', { email: 'nope', source: 'calculateur' }, ALERT_STATUS.invalid],
    ['a bad source', { email: 'a@example.com', source: 'zzz' }, ALERT_STATUS.form],
  ])('%s', async (_label, fields, expected) => {
    const response = await POST(post(fields));

    expect(response.status).toBe(303);
    expect(locationOf(response).hash).toBe(`#${statusFragment(expected)}`);
  });

  it('writes nothing when the address was rejected', async () => {
    await POST(post({ email: 'not-an-address', source: 'calculateur' }));

    expect(await prisma.alertSubscriber.count()).toBe(0);
  });

  it('returns to the calculator when even the source was unreadable', async () => {
    // The reader was somewhere. Sending them to a page they have never seen
    // because a hidden field was wrong would lose their result as well.
    const response = await POST(post({ email: 'a@example.com', source: 'zzz' }));

    expect(locationOf(response).pathname).toBe(CALCULATOR_PATH);
  });
});

describe('the rate limit is enforced by the handler, not just available to it', () => {
  it('refuses the sixth attempt from one address', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await POST(post({ email: `a${attempt}@example.com`, source: 'calculateur' }));
    }

    const sixth = await POST(post({ email: 'a6@example.com', source: 'calculateur' }));

    expect(locationOf(sixth).hash).toBe(`#${statusFragment(ALERT_STATUS.rate)}`);
  });

  it('writes nothing for the refused attempt', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await POST(post({ email: `b${attempt}@example.com`, source: 'calculateur' }));
    }

    await POST(post({ email: 'refused@example.com', source: 'calculateur' }));

    expect(
      await prisma.alertSubscriber.findUnique({ where: { email: 'refused@example.com' } }),
    ).toBeNull();
  });

  it('does not refuse a different client', async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await POST(post({ email: `c${attempt}@example.com`, source: 'calculateur' }));
    }

    const other = await POST(
      post({ email: 'other@example.com', source: 'calculateur' }, '9.9.9.9'),
    );

    expect(locationOf(other).hash).toBe(`#${statusFragment(ALERT_STATUS.ok)}`);
  });
});

describe('AC2: the reader keeps their result', () => {
  const SCENARIO = 'canton=GE&tt=84&mfr=24';

  it('carries the scenario back, so the calculation survives the subscription', async () => {
    // The calculator holds its scenario in the URL. A redirect that dropped
    // it would return the reader to an empty calculator - they would have
    // paid for subscribing with the numbers they had just typed.
    const response = await POST(
      post({ email: 'a@example.com', source: 'calculateur', scenario: SCENARIO }),
    );

    const location = locationOf(response);

    expect(location.searchParams.get('canton')).toBe('GE');
    expect(location.searchParams.get('tt')).toBe('84');
    expect(location.searchParams.get('mfr')).toBe('24');
  });

  it('carries it back on a REJECTION too', async () => {
    // Losing the result is worse here, not better: the reader has to retype
    // their scenario AND their address.
    const response = await POST(
      post({ email: 'not-an-address', source: 'calculateur', scenario: SCENARIO }),
    );

    expect(locationOf(response).searchParams.get('canton')).toBe('GE');
  });

  it('re-emits ONLY the nine frozen names, never what it was handed', async () => {
    // The scenario arrives in a form field, which makes it client-supplied
    // data on its way into a Location header. A copy would let a caller add
    // anything; a whitelist cannot.
    const response = await POST(
      post({
        email: 'a@example.com',
        source: 'calculateur',
        scenario: 'canton=GE&tt=84&utm_source=evil&redirect=https://evil.example&alerte=ok',
      }),
    );

    const location = locationOf(response);

    expect(location.searchParams.get('canton')).toBe('GE');
    expect(location.searchParams.get('utm_source')).toBeNull();
    expect(location.searchParams.get('redirect')).toBeNull();
    expect(location.searchParams.get('alerte')).toBeNull();
    expect(String(location)).not.toContain('evil.example');
  });

  it('drops a value too long to be a scenario value', async () => {
    const response = await POST(
      post({
        email: 'a@example.com',
        source: 'calculateur',
        scenario: `canton=GE&tt=${'9'.repeat(500)}`,
      }),
    );

    const location = locationOf(response);

    expect(location.searchParams.get('canton')).toBe('GE');
    expect(location.searchParams.get('tt')).toBeNull();
  });

  it('survives a scenario field that is not a query string at all', async () => {
    for (const scenario of ['', '???', '%%%', 'not a query']) {
      const response = await POST(
        post({ email: `x${scenario.length}@example.com`, source: 'calculateur', scenario }),
      );

      expect(response.status).toBe(303);
      expect(locationOf(response).pathname).toBe(CALCULATOR_PATH);
    }
  });
});
