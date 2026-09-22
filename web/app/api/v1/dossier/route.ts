// web/app/api/v1/dossier/route.ts
//
// GET /api/v1/dossier?year=YYYY. FW26 increment 1.
//
// ============================================================================
// THE ROUTE ASSEMBLES NOTHING
// ============================================================================
//
// `lib/dossier` computes; this serialises. Not one figure is derived here, and
// the reason is SPEC 868: the Android Relevé screen and the PDF are "the same
// document at two widths", which they can only be if one computation stands
// behind both. A rate recomputed in this file would be a second implementation
// that agrees until the day it does not - and the surface it would disagree
// with is the one an auditor reads.
//
// A test plants a recomputation and requires it to fail.
//
// ============================================================================
// THE SAME CHECK ORDER AS EVERY OTHER /v1 ROUTE
// ============================================================================
//
//   1. authenticate            no token, nothing else is read.
//   2. scan for coordinates    BEFORE validation, so a `?lat=` is recorded as
//                              a coordinate rather than as an unknown
//                              parameter (SPEC 13.1, D18).
//   3. validate the query      unknown parameters refused, not ignored - which
//                              is also what refuses a planted `userId`.
//   4. read                    tenancy from the token, never the query.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { authenticate, unauthorised } from '@/lib/auth/bearer';
import { findLocationKeys } from '@/lib/entries/no-coordinates';
import { parseReadQuery } from '@/lib/entries/read-query';
import { buildDossierFor } from '@/lib/dossier/load';
import { DOSSIER_RESPONSE_FIELDS, MissingTitulaireError } from '@/lib/dossier/service';

export const dynamic = 'force-dynamic';

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
      `[dossier] refused: location keys in the query string (${coordinates.sort().join(', ')})`,
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

  // A YEAR THAT HAS NOT HAPPENED IS ITS OWN REFUSAL (R198). The engine would
  // answer for 2031 - a full 240-day basis, nothing logged, 0 % declared - and
  // that answer is not wrong so much as MEANINGLESS, which is worse: it looks
  // like a compliant year. `invalid_year` would send the caller to check their
  // parser; this names what is actually the matter.
  //
  // R171: the current year is READ. A constant here would be accidentally
  // correct until the clock passed it.
  if (query.year > new Date().getUTCFullYear()) {
    return refuse('future_year', AUTH_API_COPY.invalidYear);
  }

  try {
    const dossier = await buildDossierFor(auth.userId, query.year);

    // SERIALISED FROM THE FROZEN LIST, field by field. Returning `dossier`
    // directly would put `result` on the wire - the engine's own output, which
    // duplicates four of `zone`'s figures - and would leak any field a future
    // change adds to the type before the contract described it.
    const payload = Object.fromEntries(
      DOSSIER_RESPONSE_FIELDS.map((field) => [field, dossier[field]]),
    );

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        // The same reasoning as every other authenticated read: this is the
        // one shape a proxy will happily treat as static, and the failure mode
        // is one person's year served to another.
        'cache-control': 'no-store, private',
        vary: 'Authorization',
      },
    });
  } catch (cause) {
    if (cause instanceof MissingTitulaireError) {
      console.error(`[dossier] refused: ${cause.message}`);

      return refuse('titulaire_missing', AUTH_API_COPY.readFailed, 422);
    }

    console.error(
      `[dossier] ${query.year} failed:`,
      cause instanceof Error ? cause.message : String(cause),
    );

    return refuse('read_failed', AUTH_API_COPY.readFailed, 500);
  }
}
