// web/tests/db/redirect-location.test.ts
//
// FW-REDIRECT (R364): what the confirm and unsubscribe routes put in their
// Location header, for every state each can reach.
//
// ============================================================================
// WHY THIS FILE DID NOT EXIST, WHICH IS WHY THE BUG SHIPPED
// ============================================================================
//
// tests/db/confirm-unsubscribe.test.ts asserts what `confirmByToken` and
// `unsubscribeByToken` DO to the row - thoroughly, in both directions. The
// e2e suite asserts that /alertes/confirmation/confirmee renders the right
// message. Both were green throughout.
//
// Between them sat the Location header that carries a reader from the first
// to the second, and nothing asserted it. That is R175 exactly: a property
// fenced from two sides, with the space in the middle unexamined - and the
// middle is where the subscriber was sent to https://0.0.0.0:3000.
//
// THE ROUTE IS THE UNIT UNDER TEST, not the library beneath it (R204).
// Importing `confirmByToken` proves the function; importing the handler and
// handing it a Request proves the thing a reader actually meets.
//
// WHAT IT CANNOT PROVE, stated so nothing is read into it: this runs under
// vitest, where the request origin is whatever the test wrote. It asserts the
// Location is a PATH and has no host, which is true everywhere. That the
// image no longer emits 0.0.0.0 is R366's container proof, because only a
// container can show it.

import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { hashToken, recordSubscription } from '@/lib/alerts/record';
import {
  CONFIRMATION_PATH,
  CONFIRM_STATES,
  UNSUBSCRIBE_PATH,
  UNSUBSCRIBE_STATES,
} from '@/lib/alerts/status';
import { GET as confirm } from '@/app/api/alertes/confirm/route';
import { GET as unsubscribe } from '@/app/api/alertes/desinscription/route';

const EMAIL = 'redirect@example.com';

/**
 * A host the server could mistake for its own.
 *
 * The requests below are made to an origin that is NOT the site, standing in
 * for the image's http://0.0.0.0:3000. If a handler ever reads the request's
 * origin again, this is the value that would appear in the Location.
 */
const FOREIGN = 'http://0.0.0.0:3000';

beforeEach(async () => {
  await prisma.alertSubscriber.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// A REAL NextRequest, not a cast Request. The handlers read `nextUrl`,
// which only NextRequest has - a plain Request cast to the parameter type
// compiles and then throws on the first property access, which is what the
// first run of this file did.
const ask = (path: string, token: string): NextRequest =>
  new NextRequest(`${FOREIGN}${path}?token=${encodeURIComponent(token)}`);

/** Every assertion that must hold of any redirect this product emits. */
function expectRelative(response: Response, target: string): void {
  const location = response.headers.get('location') ?? '';

  expect(response.status).toBe(303);
  expect(location).toBe(target);

  // Said twice on purpose. The equality above would still pass if `target`
  // itself grew a host one day; these say what the shape must be.
  expect(location.startsWith('/')).toBe(true);
  expect(location).not.toContain('0.0.0.0');
  expect(location).not.toContain('://');
}

describe('the confirmation link, for each state it can reach', () => {
  it('confirmed -> the confirmee page, as a path', async () => {
    const { token } = await recordSubscription({ email: EMAIL, source: 'calculateur' });

    // recordSubscription returns a UNION - the 'already-confirmed' branch
    // carries no token - so this is 'string | undefined' and typecheck says
    // so. Asserted rather than cast: if a fresh address ever stops yielding
    // a token, this fails here saying that, instead of sending the route an
    // empty string and quietly asserting the 'invalide' path.
    expect(token, 'a new subscription issued no confirmation token').toBeDefined();

    expectRelative(
      await confirm(ask('/api/alertes/confirm', token as string)),
      `${CONFIRMATION_PATH}/${CONFIRM_STATES.confirmed}`,
    );
  });

  it('a token nobody was issued -> the invalide page, as a path', async () => {
    expectRelative(
      await confirm(ask('/api/alertes/confirm', 'f'.repeat(64))),
      `${CONFIRMATION_PATH}/${CONFIRM_STATES.unknown}`,
    );
  });

  it('no token at all -> the invalide page, as a path', async () => {
    expectRelative(
      await confirm(new NextRequest(`${FOREIGN}/api/alertes/confirm`)),
      `${CONFIRMATION_PATH}/${CONFIRM_STATES.unknown}`,
    );
  });
});

describe('the unsubscribe link, for each state it can reach', () => {
  it('unsubscribed -> the ok page, as a path', async () => {
    // THE UNSUBSCRIBE TOKEN IS NOT THE CONFIRMATION TOKEN. It is minted when
    // the subscription is confirmed (lib/alerts/confirm.ts), so recording
    // alone leaves the row with none - the first run of this test used the
    // confirmation token and got 'invalide', correctly. The hash is written
    // directly here rather than by confirming first, because what is under
    // test is the route's Location and not the issuing path, which
    // tests/db/confirm-unsubscribe.test.ts already owns.
    const token = 'a'.repeat(64);

    await recordSubscription({ email: EMAIL, source: 'calculateur' });
    await prisma.alertSubscriber.update({
      where: { email: EMAIL },
      data: { unsubscribeTokenHash: hashToken(token) },
    });

    expectRelative(
      await unsubscribe(ask('/api/alertes/desinscription', token)),
      `${UNSUBSCRIBE_PATH}/${UNSUBSCRIBE_STATES.unsubscribed}`,
    );
  });

  it('a token nobody was issued -> the invalide page, as a path', async () => {
    expectRelative(
      await unsubscribe(ask('/api/alertes/desinscription', 'f'.repeat(64))),
      `${UNSUBSCRIBE_PATH}/${UNSUBSCRIBE_STATES.unknown}`,
    );
  });
});
