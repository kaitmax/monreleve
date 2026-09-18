// web/app/api/v1/auth/revoke-all/route.ts
//
// POST /api/v1/auth/revoke-all - end every session this person has.
// FW22 increment 5.
//
// THE ONE A PERSON REACHES FOR AFTER LOSING A PHONE, so it ends the calling
// session too. A "sign out everywhere except here" would be friendlier and
// wrong: the caller may be the device that was lost, and somebody asking this
// question wants certainty rather than convenience.
//
// TENANCY IS THE TOKEN'S. The user whose sessions end is the one the bearer
// token resolves to - there is no body, no parameter, and therefore nothing
// to plant. tests/db/bearer.test.ts proves identity comes from nowhere else.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { authenticate, unauthorised } from '@/lib/auth/bearer';
import { revokeAllSessions } from '@/lib/auth/tokens';

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);

  if (!auth.ok) {
    return unauthorised(auth.code);
  }

  await revokeAllSessions(auth.userId, 'REVOKED_ALL');

  return NextResponse.json({ status: 'ok', message: AUTH_API_COPY.revokedAll }, { status: 200 });
}
