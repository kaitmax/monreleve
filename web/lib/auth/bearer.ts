// web/lib/auth/bearer.ts
//
// How an /api/v1 route learns who is calling. FW22 increment 4.
//
// ============================================================================
// A HELPER, NOT NEXT MIDDLEWARE, AND THERE ARE TWO REASONS
// ============================================================================
//
// THE HARD ONE: Next middleware runs in the edge runtime. SPEC 10 requires
// tokens that can be withdrawn, so a token is a database row (see tokens.ts),
// and Prisma with the pg driver does not run on the edge. Middleware could
// therefore only check the SHAPE of a token, which is the half that proves
// nothing - a well-formed token from a deleted account would sail through.
//
// THE OTHER: web/middleware.ts exists and says what it is for - "NOTHING
// ELSE. No rewrites, no redirects, no cookies." It carries one header on one
// route. Putting authentication in it would make a file whose whole argument
// is its narrowness into the widest thing in the repository.
//
// So every /api/v1 route calls `authenticate` itself. That is one line per
// route and it is visible at the top of each handler, which is the right
// place for the sentence "this route requires a caller".
//
// ============================================================================
// IDENTITY COMES FROM THE TOKEN AND FROM NOWHERE ELSE
// ============================================================================
//
// This function reads exactly one thing: the Authorization header. It never
// looks at the body, the query string, or any other header - not because
// those are validated, but because they are not read at all. A rule enforced
// by absence cannot be got wrong by a later handler that forgets it.
//
// tests/db/bearer.test.ts plants a victim's id in the body, the query and a
// header, verifies each plant LANDED (R180), and requires the authenticated
// identity to be the token's. The fourth test removes the token and requires
// the planted id alone to get nothing - without which the other three would
// pass against a guard that ignored the token too.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { inspectAccessToken } from '@/lib/auth/tokens';

/**
 * The refusal codes, which are a CONTRACT WITH A CLIENT IN THE FIELD.
 *
 * ASCII, snake_case, never translated, never reworded, never reordered. An
 * Android build from six months ago is reading these, and the protocol is
 * explicit: "Errors are French where a human reads them and stable codes
 * where a client does."
 *
 * THEY ARE DISTINCT BECAUSE THE CLIENT BEHAVES DIFFERENTLY ON EACH:
 *   expired_token    refresh silently; the person sees nothing.
 *   rotated_token    the same, and it means two requests raced a rotation.
 *   revoked_session  the refresh token is dead too - sign in again.
 *   unknown_token    treat as revoked, but it is worth a distinct code
 *                    because it also fires for a corrupted stored token,
 *                    which is a different bug report.
 *   missing_token / malformed_authorization
 *                    a defect in the client, not a state of the account,
 *                    and it should be obvious in a log which one.
 */
export const AUTH_CODES = {
  missingToken: 'missing_token',
  malformedAuthorization: 'malformed_authorization',
  unknownToken: 'unknown_token',
  expiredToken: 'expired_token',
  rotatedToken: 'rotated_token',
  revokedSession: 'revoked_session',
} as const;

export type AuthCode = (typeof AUTH_CODES)[keyof typeof AUTH_CODES];

export type Authenticated = {
  readonly ok: true;
  readonly userId: string;
  readonly sessionId: string;
};

export type Unauthenticated = {
  readonly ok: false;
  readonly code: AuthCode;
};

export type AuthResult = Authenticated | Unauthenticated;

/**
 * Pull the token out of `Authorization: Bearer <token>`.
 *
 * STRICT ABOUT THE SHAPE. Exactly two parts, the scheme case-insensitively
 * `bearer`, and a non-empty token with no spaces in it. A lenient parser here
 * is how "Bearer" with no token, or a header with two values, ends up being
 * treated as a token of its own.
 */
function tokenFrom(header: string | null): { token: string } | { code: AuthCode } {
  if (header === null || header.trim() === '') {
    return { code: AUTH_CODES.missingToken };
  }

  const parts = header.trim().split(/\s+/u);

  if (parts.length !== 2) {
    return { code: AUTH_CODES.malformedAuthorization };
  }

  const [scheme, token] = parts;

  if (scheme?.toLowerCase() !== 'bearer' || token === undefined || token === '') {
    return { code: AUTH_CODES.malformedAuthorization };
  }

  return { token };
}

const DENIAL_TO_CODE = {
  unknown: AUTH_CODES.unknownToken,
  expired: AUTH_CODES.expiredToken,
  rotated: AUTH_CODES.rotatedToken,
  revoked: AUTH_CODES.revokedSession,
} as const;

/** Who is calling, or which rule refused them. */
export async function authenticate(request: Request): Promise<AuthResult> {
  const parsed = tokenFrom(request.headers.get('authorization'));

  if ('code' in parsed) {
    return { ok: false, code: parsed.code };
  }

  const resolution = await inspectAccessToken(parsed.token);

  if (!resolution.ok) {
    return { ok: false, code: DENIAL_TO_CODE[resolution.denial] };
  }

  return { ok: true, userId: resolution.userId, sessionId: resolution.sessionId };
}

/**
 * The 401 a route returns when `authenticate` refuses.
 *
 * WWW-Authenticate IS NOT DECORATION. RFC 9110 requires a 401 to carry it,
 * and a client library that follows the standard will look for it before
 * deciding a response is an auth failure rather than a server error.
 */
export function unauthorised(code: AuthCode): NextResponse {
  return NextResponse.json(
    { status: 'error', code, message: AUTH_API_COPY.unauthorised },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
  );
}
