// web/tests/unit/pages/verification-rate-bucket.test.ts
//
// R338: THE VERIFICATION PAGE HAS ITS OWN RATE-LIMIT BUCKET, SEPARATE FROM THE
// ALERT FORM.
//
// WHY THIS IS A SEPARATE PROPERTY FROM rate-limit.test.ts. That file proves
// checkRate is correct given a key; it cannot prove the CALLERS pass keys that
// do not collide, because checkRate is key-agnostic. The defect R338 fixes lives
// entirely in the keys the call sites choose: the verification page
// (app/(public)/verifier/[code]/page.tsx) and the alert form
// (app/api/alertes/route.ts) both keyed a window by the bare client address, so
// for one address they shared ONE window. A fiduciaire scanning several releves
// would then spend the alert form's five-attempt budget for that address, and a
// script hammering the alert form would refuse the verification page - "traffic
// on one blocks the other", which is exactly what the auth routes already avoid
// by namespacing (app/api/v1/auth/code/route.ts).
//
// R204: this drives the REAL page entry point. It calls VerifyPage the way the
// framework does (headers() mocked to carry an address, the DB lookup mocked so a
// unit test needs no database) and reads the state the page decided. The alert
// form's bucket is checked with the exact expression that route computes -
// checkRate(clientKey(headers)) - so the test asserts the space BETWEEN the two
// real call sites (R175), not a restatement of either.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

// vi.mock factories are hoisted above the imports, so the mutable the headers
// mock reads is created with vi.hoisted rather than captured from module scope.
const { headersState } = vi.hoisted(() => ({
  headersState: { current: new Headers() },
}));

vi.mock('next/headers', () => ({
  headers: async () => headersState.current,
}));

// The allowed path reads one issuance record; null is the neutral "unknown"
// answer, which is all this test needs and keeps the database out of a unit test.
vi.mock('@/lib/verification/lookup', () => ({
  lookupVerification: async () => null,
}));

import VerifyPage from '@/app/(public)/verifier/[code]/page';
import type { VerificationState } from '@/app/(public)/verifier/[code]/VerificationContent';
import { checkRate, clientKey, resetRateLimit } from '@/lib/alerts/rate-limit';

const IP = '198.51.100.7';
const CODE = '0123456789abcdef0123456789abcdef';

/** The headers a request from IP carries, as the alert route and the page read them. */
function headersFor(ip: string): Headers {
  return new Headers({ 'x-forwarded-for': ip });
}

/** Drive the real page once and report the state it decided. */
async function hitVerify(): Promise<VerificationState['kind']> {
  const element = (await VerifyPage({
    params: Promise.resolve({ code: CODE }),
  })) as ReactElement<{ state: VerificationState }>;

  return element.props.state.kind;
}

/** Exactly what app/api/alertes/route.ts computes for this client. */
function hitAlertForm(ip: string): boolean {
  return checkRate(clientKey(headersFor(ip))).allowed;
}

/** How many times the page serves this client before it first refuses. */
async function verifyBudget(): Promise<number> {
  resetRateLimit();
  let allowed = 0;

  while ((await hitVerify()) !== 'rate-limited') {
    allowed += 1;
    if (allowed > 1000) throw new Error('the verification page never rate-limits');
  }

  return allowed;
}

beforeEach(() => {
  resetRateLimit();
  headersState.current = headersFor(IP);
});

describe('R338: the verification page does not share the alert form bucket', () => {
  it('a client that exhausts the verification page is still served by the alert form', async () => {
    // Drive the page until it refuses - it has its own generous ceiling.
    let kind: VerificationState['kind'] = 'unknown';
    for (let i = 0; i < 200 && kind !== 'rate-limited'; i += 1) {
      kind = await hitVerify();
    }

    // Sanity: the page really does rate-limit, so the loop proved something.
    expect(kind, 'the page should rate-limit once its ceiling is passed').toBe('rate-limited');

    // The alert form, for the SAME address, must be untouched. Sharing a bucket
    // (the defect) would have spent its five-attempt budget many times over.
    expect(hitAlertForm(IP)).toBe(true);
  });

  it('alert-form traffic does not eat into the verification page budget', async () => {
    // The page's own allowance, measured rather than transcribed.
    const budget = await verifyBudget();
    expect(budget, 'the page is meant to be more generous than the alert form (5)').toBeGreaterThan(5);

    // A client spends its whole alert-form allowance...
    resetRateLimit();
    for (let i = 0; i < 5; i += 1) hitAlertForm(IP);

    // ...and the page still grants it the full budget, not budget - 5.
    let allowed = 0;
    while ((await hitVerify()) !== 'rate-limited') allowed += 1;

    expect(allowed).toBe(budget);
  });
});
