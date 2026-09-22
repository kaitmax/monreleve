// web/app/api/v1/export/pdf/route.ts
//
// GET /api/v1/export/pdf?year=YYYY. FW25b increment 1.
//
// ============================================================================
// THE SAME CHECK ORDER AS EVERY OTHER /v1 ROUTE
// ============================================================================
//
//   1. authenticate            no token, nothing else is read.
//   2. scan for coordinates    BEFORE validation, so a `?lat=` is recorded as
//                              a coordinate rather than as an unknown
//                              parameter (SPEC 13.1, D18).
//   3. validate the query      unknown parameters refused, not ignored.
//   4. render                  tenancy from the token, never the query.
//
// THE ORDER EARNS ITS KEEP HERE MORE THAN ANYWHERE ELSE. Every refusal above
// step 4 costs a few microseconds; step 4 costs a browser. Validating the year
// after launching Chromium would mean one malformed request paid ~300 MB to
// discover the year was "abc".
//
// ============================================================================
// HOW IDENTITY REACHES THE BROWSER, AND WHY IT IS A URL TOKEN
// ============================================================================
//
// Chromium is a separate process. It does not share this request's
// `Authorization` header, and giving it one would mean either setting an
// extra-HTTP-header on every navigation - which leaks to any redirect target -
// or teaching the print route a second authentication mechanism.
//
// So this route MINTS what the print route already accepts: a short-lived
// token scoped to (person, year), signed with AUTH_SECRET. The browser then
// makes an ordinary anonymous request that happens to carry a capability.
//
// THE CREDENTIAL IS ALREADY IN A URL FOR A REASON THAT PREDATES THIS ROUTE:
// FW25's increment 4 requires a HUMAN to open the document in a browser, and a
// browser sends no `Authorization` header for a typed URL. See
// lib/export/print-token.ts. This route inherits that decision rather than
// adding a second one.
//
// THE ORIGIN IS THIS REQUEST'S OWN, not a configured base URL. The browser
// runs on the same host as the server it is fetching from, so the address this
// request arrived on is the address that works - including behind a proxy,
// where a configured public URL would send the render out through the
// internet and back. R171: the role is "the server under test", read rather
// than assumed.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { authenticate, unauthorised } from '@/lib/auth/bearer';
import { findLocationKeys } from '@/lib/entries/no-coordinates';
import { parseReadQuery } from '@/lib/entries/read-query';
import { mintPrintToken } from '@/lib/export/print-token';
import { RendererUnavailableError, RendererUnstyledError, renderPdf } from '@/lib/export/pdf';

export const dynamic = 'force-dynamic';
// Playwright drives a child process and touches the filesystem; the Edge
// runtime can do neither. Stated rather than inherited, because the default
// moving would be a deployment failure rather than a compile error.
export const runtime = 'nodejs';

function refuse(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ status: 'error', code, message }, { status });
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);

  if (!auth.ok) {
    return unauthorised(auth.code);
  }

  const url = new URL(request.url);
  const coordinates = findLocationKeys(Object.fromEntries(url.searchParams));

  if (coordinates.length > 0) {
    console.error(
      `[export] pdf refused: location keys in the query string (${coordinates.sort().join(', ')})`,
    );

    return refuse('coordinates_refused', AUTH_API_COPY.coordinateRefused);
  }

  const query = parseReadQuery(url);

  if (!query.ok) {
    if (query.code === 'unknown_parameter') {
      return NextResponse.json(
        {
          status: 'error',
          code: 'unknown_parameter',
          message: AUTH_API_COPY.unknownParameter,
          parameters: query.keys,
        },
        { status: 400 },
      );
    }

    return refuse('invalid_year', AUTH_API_COPY.invalidYear);
  }

  const printToken = mintPrintToken(auth.userId, query.year);

  if (printToken === null) {
    // AUTH_SECRET is unset or is the placeholder .env.example ships. The print
    // route would refuse the render anyway; refusing here names the cause
    // instead of reporting it as a render failure two layers away (R198).
    console.error('[export] pdf refused: AUTH_SECRET is unset or is the shipped placeholder');

    return refuse('not_configured', AUTH_API_COPY.readFailed, 503);
  }

  const target = new URL('/releve/print', url.origin);
  target.searchParams.set('year', String(query.year));
  target.searchParams.set('token', printToken);

  try {
    const pdf = await renderPdf(target.toString());

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="releve-${query.year}.pdf"`,
        // Never cached: an authenticated export is the one shape a proxy will
        // happily treat as static, and the failure mode is one person's year
        // served to another.
        'cache-control': 'no-store, private',
        vary: 'Authorization',
      },
    });
  } catch (cause) {
    // R198: each of these is a different fact with a different remedy, so each
    // gets its own code rather than collapsing into "export failed".
    if (cause instanceof RendererUnavailableError) {
      console.error(`[export] pdf renderer unavailable: ${cause.message}`);

      return refuse('renderer_unavailable', AUTH_API_COPY.readFailed, 503);
    }

    if (cause instanceof RendererUnstyledError) {
      console.error(`[export] pdf refused: ${cause.message}`);

      return refuse('renderer_unstyled', AUTH_API_COPY.readFailed, 503);
    }

    console.error(
      `[export] pdf for ${query.year} failed:`,
      cause instanceof Error ? cause.message : String(cause),
    );

    return refuse('read_failed', AUTH_API_COPY.readFailed, 500);
  }
}
