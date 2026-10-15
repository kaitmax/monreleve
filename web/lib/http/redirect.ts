// web/lib/http/redirect.ts
//
// A redirect whose Location carries no host. FW-REDIRECT (R364).
//
// ============================================================================
// WHY THE SERVER MUST NOT NAME ITS OWN ADDRESS
// ============================================================================
//
// The obvious way to redirect names where to go absolutely:
//
//     NextResponse.redirect(new URL(path, request.nextUrl.origin), 303)
//
// and it is correct on a developer's machine, where the origin is
// http://localhost:3000 and the reader is on localhost:3000 too. In the
// image it is not. The standalone server is started with ENV HOSTNAME
// "0.0.0.0" so that it binds every interface behind the proxy, so
// `request.nextUrl.origin` is http://0.0.0.0:3000 - and that is what the
// browser was told to go to.
//
// A reader who confirmed their subscription from an email was sent to
// https://0.0.0.0:3000/alertes/confirmation/confirmee, which no browser can
// open. The subscription HAD been recorded; only the page after it failed.
//
// ============================================================================
// A RELATIVE Location REMOVES THE CLASS
// ============================================================================
//
// RFC 7231 has allowed one since 2014 and every browser resolves it against
// the request URL, so the answer stops depending on how the server perceives
// its own address - through a proxy, behind a port mapping, bound to a
// wildcard, or none of those. The reader's browser already knows the host it
// asked; it is the only party that does.
//
// FIXING IT IN THE PROXY WOULD HAVE WORKED AND BEEN WORSE: Coolify sets
// x-forwarded-host, so production would likely have been fine while every
// direct hit - staging, a health probe, a container run by hand - stayed
// broken. That is a defect that only appears where nobody is looking.
//
// IT IS ALSO STRICTLY HARDER TO ABUSE. An absolute Location is the shape an
// open redirect takes; one with no host at all cannot send a reader to
// another site however the path is constructed.
//
// ============================================================================
// ONE HOME (R206)
// ============================================================================
//
// app/api/alertes/route.ts met this defect first - "4 of 284 e2e specs, green
// against next start, failing against the image" - and fixed it locally. Its
// two sibling routes, both reached from every alert email, were never moved
// over, and the live site redirected subscribers to 0.0.0.0 until FW-REDIRECT.
//
// A fix that lives in one route is a fix the next route does not get. This is
// the one implementation; tests/unit/meta/redirect-origin.test.ts is the
// fence that stops a fourth site from building its own.

import { NextResponse } from 'next/server';

/**
 * 303 See Other: re-issue as a GET.
 *
 * The default for every caller here, and the reason is the same in all of
 * them: the reader arrived by POSTing a form or by following a one-use link,
 * and a refresh of the page they land on must not repeat that.
 */
const SEE_OTHER = 303;

/**
 * Redirect to a path on THIS site, without naming this site.
 *
 * `target` is a path with its query and fragment already assembled - it is
 * emitted as given. Callers that need to build one from parts should use
 * `new URL(path, 'http://relative.invalid')` to assemble it safely and then
 * pass `pathname + search + hash`, which is what the alert form does.
 */
export function relativeRedirect(target: string, status: number = SEE_OTHER): NextResponse {
  return new NextResponse(null, { status, headers: { Location: target } });
}
