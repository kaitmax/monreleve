// web/app/api/alertes/desinscription/route.ts
//
// GET /api/alertes/desinscription?token=... - one click off the list.
// FW14 increment 4.
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
// "one click" rules out. The RFC 8058 one-click header sends a POST for
// exactly this reason; that belongs with the alert sends themselves, which
// FW14 does not build, and is noted for the task that does.

import { NextResponse, type NextRequest } from 'next/server';
import { unsubscribeByToken } from '@/lib/alerts/confirm';
import { UNSUBSCRIBE_PATH, UNSUBSCRIBE_STATES } from '@/lib/alerts/status';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token') ?? '';

  let state: string = UNSUBSCRIBE_STATES.unknown;

  try {
    state = UNSUBSCRIBE_STATES[await unsubscribeByToken(token)];
  } catch {
    // Never claim somebody is off the list when the write may not have
    // happened. This is the one place where an optimistic answer would be a
    // lie with consequences: they would stop expecting mail and keep getting
    // it.
    state = UNSUBSCRIBE_STATES.unknown;
  }

  return NextResponse.redirect(
    new URL(`${UNSUBSCRIBE_PATH}/${state}`, request.nextUrl.origin),
    303,
  );
}
