// web/lib/web-account/open.ts
//
// Whether the account area exists, asked FIRST by every page and handler in it.
// FW-WEB-ACCOUNT, Queue Ruling 13 item 5.
//
// ONE FACT, FOUR SURFACES (R172). PRODUCT_STATE.webAccountExists decides the
// header's sign-in link (through ACCOUNT_ROUTE), the privacy notice's cookie
// sentence, and - here - whether the area answers at all. Switched off, the
// link and the sentence disappear AND every account path is a 404 that sets
// no cookie: a hidden-but-reachable area would set a cookie the notice had
// stopped mentioning. tests/unit/web-account/flag-off.test.ts flips the fact.

import { NextResponse } from 'next/server';
import { ACCOUNT_ROUTE } from '@/lib/content/routes';

export function accountAreaOpen(): boolean {
  return ACCOUNT_ROUTE.status === 'live';
}

/** A route handler's answer while the area is switched off: nothing here, nothing set. */
export function accountAreaClosed(): NextResponse {
  return new NextResponse(null, { status: 404, headers: { 'cache-control': 'no-store, private' } });
}
