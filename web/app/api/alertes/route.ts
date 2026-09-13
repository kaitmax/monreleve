// web/app/api/alertes/route.ts
//
// POST /api/alertes - the subscribe handler. FW14 increment 2.
//
// A ROUTE HANDLER TAKING A PLAIN FORM POST (R136). No island, no fetch, no
// JSON: the capture card is a <form method="post" action="/api/alertes">, it
// works with scripting disabled, and it costs the calculator zero bytes of
// client JavaScript against the 4,4 KiB of GATE A headroom that remains.
//
// POST-REDIRECT-GET, with 303. The handler never renders: it redirects to the
// page the reader came from and that page renders the status. Without the
// redirect, a refresh re-posts the form and a back button offers to; with 303
// specifically, the follow-up is a GET even though the request was a POST.
//
// THE STATUS TRAVELS IN THE URL because it has nowhere else to go. SPEC D12
// forbids a cookie on a public route and R136 forbids an island, so there is
// no store and no fetch. lib/alerts/status.ts carries the vocabulary and
// explains why `alerte` had to become a RESERVED param name rather than an
// unknown one.
//
// THE REDIRECT TARGET IS NEVER THE CLIENT'S. It is derived from the validated
// `source` enum, not from a form field naming a URL. A handler that redirects
// to a path the request supplied is an open redirect, and an open redirect on
// a page about tax compliance is a convincing place to start a phishing hop.

import { NextResponse, type NextRequest } from 'next/server';
import { CALCULATOR_PATH } from '@/lib/content/routes';
import { ALERTES_PATH } from '@/lib/content/alertes';
import {
  ALERT_STATUS,
  ALERT_STATUS_PARAM,
  type AlertStatus,
  statusForError,
} from '@/lib/alerts/status';
import { checkRate, clientKey } from '@/lib/alerts/rate-limit';
import { parseSubscription, type Source } from '@/lib/alerts/subscribe';
import { recordSubscription } from '@/lib/alerts/record';
import { sendConfirmation } from '@/lib/alerts/confirmation';

/**
 * Where each source sends the reader back to.
 *
 * A closed map rather than a redirect URL in the form. 'guide' returns to the
 * standalone alerts page rather than to the article it came from: the article
 * is one of many and the handler is not told which, and sending somebody to
 * the wrong article would be worse than sending them to the page that
 * explains what they just signed up for.
 */
const RETURN_TO: Readonly<Record<Source, string>> = {
  calculateur: CALCULATOR_PATH,
  alertes: ALERTES_PATH,
  guide: ALERTES_PATH,
};

/** The answer: a 303 back to a known page, carrying one status. */
function back(request: NextRequest, path: string, status: AlertStatus): NextResponse {
  const url = new URL(path, request.nextUrl.origin);

  url.searchParams.set(ALERT_STATUS_PARAM, status);

  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // THE RATE LIMIT COMES FIRST, before parsing and before any database work.
  // The thing being limited is not CPU: this endpoint sends email to an
  // address somebody else typed, and the cheap abuse is a script walking a
  // list of addresses to make our domain deliver to all of them.
  const rate = checkRate(clientKey(request.headers));

  let source: Source = 'calculateur';

  try {
    const form = await request.formData();
    const parsed = parseSubscription(form);

    // The return path needs the source even when the address was rejected,
    // so the reader lands back where they were rather than on a page they
    // have never seen. An unparseable source falls back to the calculator,
    // which is where all but a handful of subscriptions come from.
    const raw = form.get('source');

    if (typeof raw === 'string' && Object.hasOwn(RETURN_TO, raw)) {
      source = raw as Source;
    }

    if (!rate.allowed) {
      return back(request, RETURN_TO[source], ALERT_STATUS.rate);
    }

    if (!parsed.ok) {
      return back(request, RETURN_TO[source], statusForError(parsed.error));
    }

    const recorded = await recordSubscription(parsed.value);

    // THE MAIL GOES OUT ONLY WHERE THERE IS SOMETHING TO CONFIRM. A token
    // is absent for an address already on the list, and sending anyway
    // would mail somebody a confirmation for a subscription they completed
    // months ago - which is both confusing and the easiest possible way to
    // turn this endpoint into a way of mailing strangers on demand.
    if (recorded.token !== undefined) {
      // The RESULT IS DELIBERATELY IGNORED for the answer. The row is
      // written; a mail provider being down does not change what the
      // reader is told, because "we could not send you a mail" is exactly
      // the sentence that would distinguish a new address from a confirmed
      // one and undo the enumeration property.
      await sendConfirmation(parsed.value.email, recorded.token);
    }

    // ONE STATUS FOR ALL FOUR OUTCOMES. A new address, an unconfirmed one, a
    // confirmed one and a returning one are four different amounts of work
    // and one sentence, because the difference between them is exactly what
    // an address-enumeration attack is trying to read. lib/alerts/record.ts
    // keeps the distinction only as long as the mailer needs it.
    return back(request, RETURN_TO[parsed.value.source], ALERT_STATUS.ok);
  } catch {
    // The database refused, the body was not a form, the connection died.
    // The reader did nothing wrong and there is nothing for them to fix, so
    // they get a page that says so - never a stack trace, and never a
    // success message for something that did not happen.
    return back(request, RETURN_TO[source], ALERT_STATUS.unavailable);
  }
}

/**
 * Anything but POST gets a redirect to the page, not a 405.
 *
 * Somebody arriving here with a GET is following a link that should not
 * exist, or a crawler is. Either way a bare error body is a dead end, and the
 * page that explains the list is not.
 */
export function GET(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(ALERTES_PATH, request.nextUrl.origin), 303);
}
