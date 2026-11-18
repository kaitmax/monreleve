// web/app/(account)/mon-releve/connexion/envoi/route.ts
//
// POST /mon-releve/connexion/envoi - step one: "send me a code". FW-WEB-ACCOUNT
// (R901, R902).
//
// THROUGH THE EXISTING AUTH IMPLEMENTATION, NOT A SECOND ONE, AND FOR KNOWN
// ADDRESSES ONLY (Web Ruling 30: a web sign-in never creates an account; only
// an address the application already knows gets in). This calls
// requestKnownAddressSignIn (lib/auth/request.ts), which shares
// requestMagicLink's validation, its per-address and per-network buckets
// (auth:email:*, auth:ip:*) - spent for EVERY address, so the limit itself
// says nothing - and, for a known address, its row and its transactional
// e-mail with the link and the code (R245: no list headers). A person
// rate-limited at one door is rate-limited at the other. An unknown address
// writes no row and is sent no mail.
//
// ONE ANSWER, WHATEVER HAPPENED (R901, docs/api-v1.md 1.5). A known address, an
// unknown one, a rate-limited one and a provider outage all get the same 303
// to the code page with a sealed step. Only a string that is not an address at
// all is told so, which says nothing about anybody. tests/db/web-sign-in.test.ts
// drives both directions through this handler (R1066).
//
// NO COOKIE IS SET HERE. The account area's one cookie exists only once the
// code has been proven (verification/route.ts).

import { after, type NextResponse } from 'next/server';
import { normaliseAddress } from '@/lib/auth/code-exchange';
import { requestKnownAddressSignIn } from '@/lib/auth/request';
import { checkSameOrigin } from '@/lib/web-account/csrf';
import { accountAreaClosed, accountAreaOpen } from '@/lib/web-account/open';
import { ACCOUNT_FIELDS, ACCOUNT_PARAMS, ACCOUNT_PATHS, withQuery } from '@/lib/web-account/paths';
import { crossOriginRefused, formField, seeOther } from '@/lib/web-account/respond';
import { sealStep } from '@/lib/web-account/step';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  // Queue Ruling 13 item 5: switched off, the area is not there - a 404, no cookie.
  if (!accountAreaOpen()) return accountAreaClosed();

  // R902, FIRST: nothing is read from a request that is not ours.
  const origin = checkSameOrigin(request.headers);

  if (!origin.ok) return crossOriginRefused(origin.refusal);

  const raw = await formField(request, ACCOUNT_FIELDS.email);
  const email = normaliseAddress(raw);

  // SEALED BEFORE ANY MAIL IS SENT. Without a key the code page could not be
  // reached, and a mail whose code cannot be typed anywhere on the site is a
  // mail sent for nothing (R205's shape: refuse rather than half-work).
  const sealed = sealStep(email);

  if (sealed === null) {
    console.error('[web-account] sign-in refused: AUTH_SECRET is unset or is the shipped placeholder');

    return seeOther(withQuery(ACCOUNT_PATHS.signIn, { [ACCOUNT_PARAMS.state]: 'indisponible' }));
  }

  // THE ROW AND THE MAIL ARE SENT AFTER THE RESPONSE (Web Ruling 37, R1072), so a
  // known and an unknown address cost the request the same work and the same
  // time: one lookup each. after() is Next's own; a send that fails is logged.
  const result = await requestKnownAddressSignIn(raw, request.headers, (work) => after(work));

  if (!result.ok && result.reason === 'invalid') {
    return seeOther(withQuery(ACCOUNT_PATHS.signIn, { [ACCOUNT_PARAMS.state]: 'adresse-invalide' }));
  }

  if (!result.ok && result.reason === 'undeliverable') {
    // LOGGED, NOT RETURNED - the API route's rule, for the API route's reason.
    console.error('[auth] the mail provider refused a sign-in link');
  }

  return seeOther(withQuery(ACCOUNT_PATHS.code, { [ACCOUNT_PARAMS.step]: sealed }));
}
