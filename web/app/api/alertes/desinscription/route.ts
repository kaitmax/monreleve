// web/app/api/alertes/desinscription/route.ts
//
// One click off the list, for a person (GET) and for a mail client (POST).
// FW14 increment 4; the POST is FW27 increment 5, assigned by R141.
//
// ONE CLICK MEANS ONE CLICK. There is no confirmation step, no "are you
// sure", no survey and no win-back offer. The link in every message says it
// unsubscribes in one click, and a page that then asked the reader to press
// something else would have made that sentence untrue.
//
// GET, AND THEREFORE PREFETCHABLE, which is a real hazard for an action that
// changes state: a mail client that fetches links to build a preview would
// unsubscribe somebody who never clicked. Two things make that acceptable
// here rather than dangerous. The action is IDEMPOTENT and REVERSIBLE - the
// reader can subscribe again, and the row is kept so nothing is lost - and
// the alternative, a POST behind a button, is precisely the extra step that
// "one click" rules out.
//
// ============================================================================
// THE POST IS THE SAME ACTION FOR A DIFFERENT CALLER (RFC 8058)
// ============================================================================
//
// A mail client renders its own unsubscribe control from the
// List-Unsubscribe-Post header and fires this without a human present. So the
// two handlers reach the SAME function and differ only in what they answer
// with: a person gets a redirect to a page that says what happened, and a mail
// client gets 200 and one line of text, because it has no browser to redirect.
//
// R206: `unsubscribeByToken` is the one implementation. Two handlers each
// doing the work would be two rules that agree until somebody changes one.
//
// ============================================================================
// THE POST ANSWERS 200 WHETHER OR NOT THE TOKEN WAS REAL, AND THAT IS
// DELIBERATE
// ============================================================================
//
// lib/alerts/confirm.ts gives a token that was never issued and a token
// already used the SAME answer, so the endpoint cannot be fed tokens to learn
// which were once real. The GET may distinguish them because a PERSON needs to
// know whether they are off the list; a mail client cannot act on the
// difference and would only turn this into the oracle the GET's page is
// careful not to be.
//
// The tests therefore assert the ROW rather than the status: the subscription
// is unsubscribed for a real token and untouched for an invented one, and both
// answer 200.

import { NextResponse, type NextRequest } from 'next/server';
import { unsubscribeByToken } from '@/lib/alerts/confirm';
import { UNSUBSCRIBE_PATH, UNSUBSCRIBE_STATES } from '@/lib/alerts/status';

/**
 * Take somebody off the list, and never claim it happened when it may not
 * have.
 *
 * This is the one place where an optimistic answer would be a lie with
 * consequences: they would stop expecting mail and keep getting it.
 */
async function unsubscribe(token: string): Promise<keyof typeof UNSUBSCRIBE_STATES> {
  try {
    return await unsubscribeByToken(token);
  } catch {
    return 'unknown';
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const state = UNSUBSCRIBE_STATES[await unsubscribe(request.nextUrl.searchParams.get('token') ?? '')];

  return NextResponse.redirect(
    new URL(`${UNSUBSCRIBE_PATH}/${state}`, request.nextUrl.origin),
    303,
  );
}

/**
 * RFC 8058 §3.2: the mail client POSTs `List-Unsubscribe=One-Click`.
 *
 * THE BODY IS NOT REQUIRED TO BE PRESENT for the action to happen. The RFC
 * specifies what a conforming client sends; refusing a client that sends
 * something else would leave a reader subscribed because their mail app is
 * imperfect, which is the wrong way round for an unsubscribe. The token in the
 * URL is the whole authorisation, exactly as it is for the GET.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  await unsubscribe(request.nextUrl.searchParams.get('token') ?? '');

  // Plain text and no redirect: there is no browser at the other end. 200 for
  // every outcome - see the header.
  return new NextResponse('unsubscribed\n', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
