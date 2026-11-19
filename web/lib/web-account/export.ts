// web/lib/web-account/export.ts
//
// The account area's two downloads, THROUGH THE EXISTING ROUTES' IMPLEMENTATION.
// FW-WEB-ACCOUNT (R900, R902, R903).
//
// R900 DECIDED, AND WHY. "The downloads still reach the existing routes - by
// sharing their implementation behind the account path, or by the existing
// routes accepting the session where it arrives." The second would need the
// cookie to arrive at /api/v1/export/*, which is outside its Path - so it
// would have to be scoped to "/" and every public page would carry it. That is
// the one thing R900 forbids. So the render and the read moved, verbatim, to
// lib/export/respond-pdf.ts and respond-csv.ts, and both the bearer routes and these handlers call
// them: one PDF pipeline (issuance record included), one CSV serialiser.
//
// A POST, NOT A LINK. The PDF records an issuance and supersedes the current
// version (R329), so it is state-changing and R902 applies; SameSite=Lax would
// send the cookie on a cross-site top-level GET. The CSV changes nothing, and
// is a POST for one rule across the area rather than two.
//
// A REFUSAL COMES BACK TO THE PAGE, NOT AS JSON. The shared function answers
// in the API's shape (a JSON error with a stable code); a browser that posted
// a form would show that raw. So a non-2xx answer becomes a 303 back to the
// page with the code's class named, and the page says one sentence.
//
// ONLY THE TWO YEARS THE PAGE SHOWS (Web Ruling 32, W12): the current tax year
// and the one before. Any other year did not come from the page, and is
// refused the same way as a value that is not a year at all.

import type { NextResponse } from 'next/server';
import { checkSameOrigin } from '@/lib/web-account/csrf';
import { ACCOUNT_PARAMS, ACCOUNT_PATHS, YEAR_FIELD, withQuery } from '@/lib/web-account/paths';
import { currentTaxYear } from '@/lib/content/tax-year';
import { accountYearFrom } from '@/lib/web-account/year';
import { crossOriginRefused, formField, seeOther } from '@/lib/web-account/respond';
import { accountSessionFrom } from '@/lib/web-account/session';

export async function accountDownload(
  request: Request,
  produce: (userId: string, year: number, origin: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  const origin = checkSameOrigin(request.headers);

  if (!origin.ok) return crossOriginRefused(origin.refusal);

  const session = await accountSessionFrom(request.headers.get('cookie'));

  if (session.state === 'absent') return seeOther(ACCOUNT_PATHS.signIn);

  if (session.state === 'ended') {
    return seeOther(withQuery(ACCOUNT_PATHS.signIn, { [ACCOUNT_PARAMS.state]: 'session-terminee' }));
  }

  const year = accountYearFrom(await formField(request, YEAR_FIELD), currentTaxYear());

  if (year === null) return seeOther(withQuery(ACCOUNT_PATHS.home, { [ACCOUNT_PARAMS.export]: 'echec' }));

  // THE REQUEST'S OWN ORIGIN, as the API route uses: Chromium renders the print
  // page from the same host the server is bound to (lib/export/respond-pdf.ts).
  const response = await produce(session.userId, year, new URL(request.url).origin);

  if (response.ok) return response;

  return seeOther(
    withQuery(ACCOUNT_PATHS.home, { [ACCOUNT_PARAMS.export]: 'echec' }),
  );
}
