// web/app/api/v1/auth/refresh/route.ts
//
// POST /api/v1/auth/refresh - exchange a refresh token for a new pair.
// FW22 increment 5 (the route for increment 3's rotation).
//
// THE REFRESH TOKEN TRAVELS IN THE BODY, NOT THE Authorization HEADER, and
// that is deliberate. The bearer header carries the ACCESS token on every
// other route; if the refresh token were presented the same way, an
// intermediary that logs Authorization headers - a proxy, a crash reporter,
// an SDK - would capture the long-lived credential from the one request that
// carries it, alongside the short-lived ones it captures everywhere else.
//
// It also keeps the guard honest: lib/auth/bearer.ts refuses a refresh token
// presented as a bearer token, so the two credentials have no door in common.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { rotateRefreshToken } from '@/lib/auth/tokens';

interface Body {
  readonly refreshToken?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { status: 'error', code: 'malformed_body', message: AUTH_API_COPY.malformedBody },
      { status: 400 },
    );
  }

  const token = typeof body.refreshToken === 'string' ? body.refreshToken : '';
  const pair = await rotateRefreshToken(token);

  if (pair === null) {
    // ONE ANSWER for unknown, expired, already-rotated and revoked - including
    // the replay that just revoked the whole session. Telling a caller "that
    // token was already used" would confirm to a thief that the real client
    // is active, which is the one thing they learn nothing else from.
    //
    // The client's action is the same in every case: sign in again.
    return NextResponse.json(
      { status: 'error', code: 'invalid_refresh_token', message: AUTH_API_COPY.invalidRefresh },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    );
  }

  return NextResponse.json(
    {
      status: 'ok',
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      accessExpiresAt: pair.accessExpiresAt.toISOString(),
      refreshExpiresAt: pair.refreshExpiresAt.toISOString(),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, private' } },
  );
}
