// web/app/api/v1/export/csv/route.ts
//
// GET /api/v1/export/csv?year=YYYY. FW25 increment 1.
//
// ============================================================================
// THE SAME CHECK ORDER AS EVERY OTHER /v1 ROUTE
// ============================================================================
//
//   1. authenticate            no token, nothing else is read.
//   2. scan for coordinates    on the query string, BEFORE validation, so a
//                              `?lat=` is recorded as a coordinate rather than
//                              as an unknown parameter (SPEC 13.1, D18).
//   3. validate the query      unknown parameters refused, not ignored.
//   4. read                    tenancy from the token, never the query.
//
// It reuses `parseReadQuery` rather than writing a second year parser: the
// rules are the same rules, and two parsers would disagree the day one of them
// learned something (R206).
//
// ============================================================================
// IT BUILDS FROM THE DOSSIER, NOT FROM A SECOND QUERY
// ============================================================================
//
// R175: the CSV and the evidence annex bound the same property from opposite
// sides - "which days are in this year". Building the CSV from its own
// `findMany` would be a second answer to that question, and the two would
// diverge the day either changed its window. So the CSV is the annex,
// serialised differently, and a test asserts they carry the same day set.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { authenticate, unauthorised } from '@/lib/auth/bearer';
import { findLocationKeys } from '@/lib/entries/no-coordinates';
import { parseReadQuery } from '@/lib/entries/read-query';
import { buildDossierFor } from '@/lib/dossier/load';
import { MissingTitulaireError } from '@/lib/dossier/service';
import { CantonMissingError, YearBeforeActivityError } from '@/lib/dossier/aggregate';
import { csvFilename, toCsv } from '@/lib/export/csv';

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
      `[export] csv refused: location keys in the query string (${coordinates.sort().join(', ')})`,
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

  try {
    const dossier = await buildDossierFor(auth.userId, query.year);

    // THE FILENAME CARRIES THE YEAR AND THE TITULAIRE, and under R237 it is
    // the ONLY place this file names whose year it is - the columns are frozen
    // by SPEC 12 and a comment row would break RFC 4180. A reader exporting
    // three years ends up with three files in one folder, and a fiduciaire
    // holding two people's exports needs to tell them apart.
    return new NextResponse(toCsv(dossier.annex), {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${csvFilename(query.year, dossier.titulaire)}"`,
        // Never cached: the same reasoning as the read path. An authenticated
        // export is the one shape a proxy will happily treat as static, and
        // the failure mode is one person's year served to another.
        'cache-control': 'no-store, private',
        vary: 'Authorization',
      },
    });
  } catch (cause) {
    // R198: a missing titulaire is a DIFFERENT fact from a failed read, with a
    // different remedy - set a name, rather than go looking at the database.
    // Without this it arrives as `read_failed` (500), the misleading code that
    // sends somebody to the wrong subsystem entirely.
    if (cause instanceof MissingTitulaireError) {
      console.error(`[export] csv refused: ${cause.message}`);

      return refuse('titulaire_missing', AUTH_API_COPY.readFailed, 422);
    }

    // FW-DOSSIER-EMPTY: the dossier's two named refusals, answered here by the
    // same names because the CSV IS the dossier's annex (R175). R583: no canton
    // (it answered 500). R580: a year before the activity start (it answered
    // 500), with future_year's status and message.
    if (cause instanceof CantonMissingError) {
      console.error(`[export] csv refused: ${cause.message}`);

      return refuse('canton_missing', AUTH_API_COPY.readFailed, 422);
    }

    if (cause instanceof YearBeforeActivityError) {
      console.error(`[export] csv refused: ${cause.message}`);

      return refuse('year_before_activity', AUTH_API_COPY.invalidYear);
    }

    console.error(
      `[export] csv for ${query.year} failed:`,
      cause instanceof Error ? cause.message : String(cause),
    );

    return refuse('read_failed', AUTH_API_COPY.readFailed, 500);
  }
}
