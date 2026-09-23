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
// THE STATUS TRAVELS AS A FRAGMENT, and the reasoning is worth following
// because two earlier answers were wrong. It has nowhere else to go: SPEC D12
// forbids a cookie on a public route and R136 forbids an island, so there is
// no store and no fetch. A query parameter was the obvious remainder - and
// rendering it server-side means reading searchParams, which FW13 measured as
// moving <title> and the canonical into the BODY of this exact route. A
// fragment never reaches the server at all: the page stays static, renders
// every status hidden, and CSS :target reveals the one named here. That also
// makes the error readable with JavaScript off, which an island-rendered
// status would not have been.
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
  statusFragment,
  type AlertStatus,
  statusForError,
} from '@/lib/alerts/status';
import { checkRate, clientKey } from '@/lib/alerts/rate-limit';
import { parseSubscription, type Source } from '@/lib/alerts/subscribe';
import { PARAM_NAMES } from '@/lib/params/schema';
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

/**
 * The scenario the reader had on screen, carried back so their result survives.
 *
 * AC2: "submitting leaves the result visible and unchanged". The calculator
 * holds its scenario in the URL, and a redirect that dropped it would return
 * the reader to an empty calculator - they would have paid for subscribing
 * with the numbers they had just typed.
 *
 * A WHITELIST, NOT A COPY. The value arrives in a form field, which makes it
 * client-supplied data on its way into a redirect URL. Only SPEC 9.4's nine
 * frozen names are re-emitted, each capped, so nothing a caller invents can
 * reach the Location header - and the PATH still comes from the closed map
 * below, so the origin can never move.
 */
function scenarioFrom(form: FormData): URLSearchParams {
  const raw = form.get('scenario');
  const kept = new URLSearchParams();

  if (typeof raw !== 'string' || raw === '') return kept;

  const incoming = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);

  for (const name of PARAM_NAMES) {
    const value = incoming.get(name);

    if (value !== null && value !== '' && value.length <= MAX_PARAM_LENGTH) {
      kept.set(name, value);
    }
  }

  return kept;
}

/** Longer than any value SPEC 9.4 can carry; short enough to bound the URL. */
const MAX_PARAM_LENGTH = 32;

/**
 * The answer: a 303 back to a known page, with the scenario and one status.
 *
 * THE STATUS IS A FRAGMENT. A query parameter would have to be read on the
 * server to be rendered there, and on this route that costs the <head> - FW13
 * measured it five ways. A fragment never reaches the server, so the page
 * stays static, renders every status hidden, and CSS :target reveals the one
 * named here.
 */
/**
 * ============================================================================
 * THE Location IS RELATIVE, AND A CONTAINER IS WHAT PROVED IT HAS TO BE
 * ============================================================================
 *
 * This built an absolute URL from `request.nextUrl.origin`. Under `next start`
 * on a developer's machine that origin is `http://localhost:3100` and every
 * test passes. INSIDE THE IMAGE IT IS `http://0.0.0.0:3000`, because the
 * standalone server derives it from the address it is BOUND to - and
 * ENV HOSTNAME="0.0.0.0" is not optional, it is what makes the server
 * reachable from outside the container at all.
 *
 * So the no-JavaScript reader posted the form and was redirected to
 * `http://0.0.0.0:3000/...`, which no browser can navigate to. Measured:
 * 4 of 284 e2e specs, green against next start, failing against the image.
 *
 * A RELATIVE Location REMOVES THE CLASS. RFC 7231 has allowed one since 2014
 * and every browser resolves it against the request URL, so the answer stops
 * depending on how the server perceives its own address - through a proxy,
 * behind a port mapping, bound to a wildcard, or none of those.
 *
 * FIXING IT IN THE PROXY WOULD HAVE WORKED AND BEEN WORSE: Coolify sets
 * x-forwarded-host, so production would likely have been fine while every
 * direct hit - staging, a health probe, a container run by hand - stayed
 * broken. That is a defect that only appears where nobody is looking.
 *
 * R27's protection is untouched: `path` still comes from the closed map and
 * never from a form field, so this cannot become an open redirect. A relative
 * Location is in fact strictly harder to abuse, having no host at all.
 */
function back(
  path: string,
  status: AlertStatus,
  scenario: URLSearchParams,
): NextResponse {
  // Built against a fixed base purely to assemble path + query + fragment
  // safely, then emitted WITHOUT the origin.
  const url = new URL(path, 'http://relative.invalid');

  url.search = scenario.toString();
  url.hash = statusFragment(status);

  return relativeRedirect(`${url.pathname}${url.search}${url.hash}`);
}

/** A 303 whose Location carries no host (see `back`). */
function relativeRedirect(target: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: target } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // THE RATE LIMIT COMES FIRST, before parsing and before any database work.
  // The thing being limited is not CPU: this endpoint sends email to an
  // address somebody else typed, and the cheap abuse is a script walking a
  // list of addresses to make our domain deliver to all of them.
  const rate = checkRate(clientKey(request.headers));

  let source: Source = 'calculateur';
  let scenario = new URLSearchParams();

  try {
    const form = await request.formData();

    // Read once, before anything can fail, so every exit carries it.
    scenario = scenarioFrom(form);
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
      return back(RETURN_TO[source], ALERT_STATUS.rate, scenario);
    }

    if (!parsed.ok) {
      return back(RETURN_TO[source], statusForError(parsed.error), scenario);
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
    return back(RETURN_TO[parsed.value.source], ALERT_STATUS.ok, scenario);
  } catch {
    // The database refused, the body was not a form, the connection died.
    // The reader did nothing wrong and there is nothing for them to fix, so
    // they get a page that says so - never a stack trace, and never a
    // success message for something that did not happen.
    return back(RETURN_TO[source], ALERT_STATUS.unavailable, scenario);
  }
}

/**
 * Anything but POST gets a redirect to the page, not a 405.
 *
 * Somebody arriving here with a GET is following a link that should not
 * exist, or a crawler is. Either way a bare error body is a dead end, and the
 * page that explains the list is not.
 */
export function GET(): NextResponse {
  // Relative, for the reason `back` records: inside the image
  // request.nextUrl.origin is http://0.0.0.0:3000, which is not an address a
  // browser can follow.
  return relativeRedirect(ALERTES_PATH);
}
