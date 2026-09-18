// web/app/api/v1/auth/sign-out/route.ts
//
// POST /api/v1/auth/sign-out - end THIS session. FW22 increment 5.
//
// IT ENDS ONE SESSION, NOT THE ACCOUNT'S. Signing out on a phone must leave
// a tablet signed in: the session is the unit, and a sign-out that reached
// every device would be a surprise with no way to ask for the narrow version.
// /api/v1/auth/revoke-all is the wide one, asked for by name.
//
// IDEMPOTENT. Signing out twice is not an error - the second call finds the
// session already revoked and answers the same way. A client retrying after a
// dropped response must not be told something went wrong when it did not, and
// revokeSession keeps the ORIGINAL reason rather than overwriting it.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { authenticate, unauthorised } from '@/lib/auth/bearer';
import { revokeSession } from '@/lib/auth/tokens';

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);

  if (!auth.ok) {
    return unauthorised(auth.code);
  }

  await revokeSession(auth.sessionId, 'SIGNED_OUT');

  return NextResponse.json({ status: 'ok', message: AUTH_API_COPY.signedOut }, { status: 200 });
}
