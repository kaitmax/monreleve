// web/app/api/v1/auth/magic-link/route.ts
//
// POST /api/v1/auth/magic-link - "send me a sign-in link". FW22 increment 2.
//
// JSON, NOT A FORM, AND THAT IS THE DIFFERENCE FROM /api/alertes. FW14's
// subscribe handler takes a plain form POST and redirects, because its caller
// is a <form> on a public page with no JavaScript. This caller is the Android
// client (D14: there is no signed-in web area and no web sign-in page), so
// there is no page to redirect to and no form to degrade gracefully.
//
// ============================================================================
// ONE RESPONSE, WHATEVER HAPPENED
// ============================================================================
//
// AC2: the request must not reveal whether an address is registered. The
// module beneath this one already does identical WORK either way; this
// handler is where the identical ANSWER is enforced.
//
// Every outcome that is not a malformed request body returns 202 with the
// same JSON. Registered, unregistered, rate-limited, provider down: one
// answer. R198 says an error crossing a boundary preserves which rule fired -
// and the rule that fired here is recorded on the SERVER, in the log line,
// because the whole point is that the client must not be able to tell.
//
// THAT IS R198 APPLIED RATHER THAN BROKEN. The boundary decides what a client
// is entitled to know. For a tenancy error the client needs to know which
// rule refused it, so increment 4 gives it distinct codes; for THIS endpoint,
// telling the client which rule fired IS the vulnerability.
//
// NO COOKIE. Not "no cookie today" - there is no code path here that can set
// one, because nothing in this product's auth sets a session. AC3's zero-
// cookie trace covers it, and tests/unit/pages/no-cookies asserts the class.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { requestMagicLink } from '@/lib/auth/request';

/** The only body this endpoint understands. */
interface Body {
  readonly email?: unknown;
}

/**
 * The one answer.
 *
 * 202 ACCEPTED, not 200 OK, and the distinction is honest rather than
 * pedantic: the server has accepted the request and will try to send a
 * message. It cannot promise the message arrived, and 200 would imply it did.
 * The product's whole argument is not claiming more than the record supports.
 */
function accepted(): NextResponse {
  return NextResponse.json({ status: 'accepted', message: AUTH_API_COPY.linkSent }, { status: 202 });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    // A BODY THAT IS NOT JSON IS THE ONE CASE THAT ANSWERS DIFFERENTLY, and
    // it says nothing about any address: the caller is told their request was
    // malformed, which they could already see. A client that cannot send JSON
    // is a bug in the client, and returning 202 to it would hide that
    // forever.
    return NextResponse.json(
      { status: 'error', code: 'malformed_body', message: AUTH_API_COPY.malformedBody },
      { status: 400 },
    );
  }

  const email = typeof body.email === 'string' ? body.email : '';

  const result = await requestMagicLink(email, request.headers);

  if (!result.ok && result.reason === 'undeliverable') {
    // LOGGED, NOT RETURNED. A provider outage is the operator's problem and
    // the caller cannot act on it; telling them "delivery failed" would also
    // confirm the address reached the send step, which is halfway to the
    // oracle AC2 forbids.
    console.error('[auth] the mail provider refused a sign-in link');
  }

  return accepted();
}
