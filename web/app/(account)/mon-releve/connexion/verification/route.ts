// web/app/(account)/mon-releve/connexion/verification/route.ts
//
// POST /mon-releve/connexion/verification - step two: the code. FW-WEB-ACCOUNT
// (R899, R901, R902).
//
// THROUGH THE EXISTING CODE ROUTE'S IMPLEMENTATION AND BUDGET, NOT A SECOND
// ONE. The edge window is codeExchangeAllowed (the same keys
// /api/v1/auth/code spends), and the exchange is consumeCode, which claims a
// slot of FW-CODE-CAP's per-address daily budget in PostgreSQL before it reads
// the row and enforces the five-tries-per-request limit. Attempts spent here
// are refused there, and the reverse - tests/db/web-sign-in.test.ts.
//
// THE WEBSITE NEVER CREATES AN ACCOUNT (R904: read-only). The API's code route
// upserts a User at the exchange; this route only LOOKS ONE UP. A proven
// address with no account is told so - after the proof, so it is not an
// enumeration oracle - and no session is opened. Nor does it touch the User
// row (emailVerified): signing in to read is not a write.
//
// SESSION FIXATION: openWebSession INSERTS A NEW ROW every time, with a value
// minted here. Nothing a browser already holds is ever adopted.

import type { NextResponse } from 'next/server';
import { codeExchangeAllowed } from '@/lib/auth/code-exchange';
import { consumeCode, type CodeRefusal } from '@/lib/auth/magic-link';
import { openWebSession } from '@/lib/auth/web-session';
import { prisma } from '@/lib/db/client';
import type { CodeError } from '@/lib/fr/mon-releve';
import { sessionCookieHeader } from '@/lib/web-account/cookie';
import { checkSameOrigin } from '@/lib/web-account/csrf';
import { accountAreaClosed, accountAreaOpen } from '@/lib/web-account/open';
import { ACCOUNT_FIELDS, ACCOUNT_PARAMS, ACCOUNT_PATHS, withQuery } from '@/lib/web-account/paths';
import { crossOriginRefused, formFields, seeOther } from '@/lib/web-account/respond';
import { CODE_SHAPE } from '@/lib/web-account/code-shape';
import { openStep } from '@/lib/web-account/step';

export const dynamic = 'force-dynamic';

/** consumeCode's named refusals, as the code page's closed set of errors. */
const REFUSAL_TO_ERROR: Readonly<Record<CodeRefusal, CodeError>> = {
  invalid_code: 'code-invalide',
  code_expired: 'code-expire',
  too_many_attempts: 'trop-d-essais',
};

export async function POST(request: Request): Promise<NextResponse> {
  // Queue Ruling 13 item 5: switched off, the area is not there - a 404, no cookie.
  if (!accountAreaOpen()) return accountAreaClosed();

  const origin = checkSameOrigin(request.headers);

  if (!origin.ok) return crossOriginRefused(origin.refusal);

  const form = await formFields(request, [ACCOUNT_FIELDS.step, ACCOUNT_FIELDS.code]);
  const sealed = form[ACCOUNT_FIELDS.step];
  const email = openStep(sealed);

  if (email === null) {
    return seeOther(withQuery(ACCOUNT_PATHS.signIn, { [ACCOUNT_PARAMS.state]: 'demande-expiree' }));
  }

  const back = (error: CodeError): NextResponse =>
    seeOther(withQuery(ACCOUNT_PATHS.code, { [ACCOUNT_PARAMS.step]: sealed, [ACCOUNT_PARAMS.error]: error }));

  // A person types "123 456" as often as "123456"; spaces are not part of a code.
  const code = form[ACCOUNT_FIELDS.code].replace(/\s+/gu, '');

  // NOT A GUESS, SO IT SPENDS NOTHING. A string that cannot be a code is
  // refused before any budget is claimed - the budget exists to bound
  // guessing, and "abc" is a typo, not a guess.
  if (!CODE_SHAPE.test(code)) return back('format');

  if (!codeExchangeAllowed(email, request.headers)) return back('limite');

  const result = await consumeCode(email, code);

  if (!result.ok) return back(REFUSAL_TO_ERROR[result.reason]);

  const user = await prisma.user.findUnique({ where: { email: result.email }, select: { id: true } });

  if (user === null) {
    return seeOther(withQuery(ACCOUNT_PATHS.signIn, { [ACCOUNT_PARAMS.state]: 'aucun-compte' }));
  }

  const session = await openWebSession(user.id);

  return seeOther(ACCOUNT_PATHS.home, sessionCookieHeader(session.token));
}
