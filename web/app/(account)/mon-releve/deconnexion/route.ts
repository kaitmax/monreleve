// web/app/(account)/mon-releve/deconnexion/route.ts
//
// POST /mon-releve/deconnexion - sign-out. FW-WEB-ACCOUNT (R899, R902).
//
// REVOKED ON THE SERVER, NOT ONLY FORGOTTEN BY THE BROWSER. Clearing the
// cookie alone would leave a working value in any copy of it - a synced
// profile, a captured request. The row is revoked first (revokedAt,
// SIGNED_OUT), so the value is dead wherever it is, and THEN the browser is
// told to drop it: an empty value, Max-Age=0, the same Path.
//
// POST ONLY, AND SAME-ORIGIN ONLY. A sign-out reachable by GET is a link any
// page can make a browser follow; Lax would even send the cookie with it.
//
// QUIET ABOUT A DEAD COOKIE. Signing out a value that is unknown, expired or
// already revoked answers exactly as a live one does (R210): nothing tells
// the caller whether it ever worked.

import type { NextResponse } from 'next/server';
import { revokeWebSession } from '@/lib/auth/web-session';
import { clearedSessionCookieHeader, sessionTokenFrom } from '@/lib/web-account/cookie';
import { checkSameOrigin } from '@/lib/web-account/csrf';
import { accountAreaClosed, accountAreaOpen } from '@/lib/web-account/open';
import { ACCOUNT_PARAMS, ACCOUNT_PATHS, withQuery } from '@/lib/web-account/paths';
import { crossOriginRefused, seeOther } from '@/lib/web-account/respond';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  // Queue Ruling 13 item 5: switched off, the area is not there - a 404, no cookie.
  if (!accountAreaOpen()) return accountAreaClosed();

  const origin = checkSameOrigin(request.headers);

  if (!origin.ok) return crossOriginRefused(origin.refusal);

  const token = sessionTokenFrom(request.headers.get('cookie'));

  if (token !== null) await revokeWebSession(token, 'SIGNED_OUT');

  return seeOther(
    withQuery(ACCOUNT_PATHS.signIn, { [ACCOUNT_PARAMS.state]: 'deconnecte' }),
    clearedSessionCookieHeader(),
  );
}
