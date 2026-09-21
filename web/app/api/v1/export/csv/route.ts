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
import { toCsv } from '@/lib/export/csv';

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

    // THE FILENAME CARRIES THE YEAR, because a reader exporting three years
    // ends up with three files in one folder and `export.csv` twice is a
    // support request.
    return new NextResponse(toCsv(dossier.annex), {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="releve-${query.year}.csv"`,
        // Never cached: the same reasoning as the read path. An authenticated
        // export is the one shape a proxy will happily treat as static, and
        // the failure mode is one person's year served to another.
        'cache-control': 'no-store, private',
        vary: 'Authorization',
      },
    });
  } catch (cause) {
    console.error(
      `[export] csv for ${query.year} failed:`,
      cause instanceof Error ? cause.message : String(cause),
    );

    return refuse('read_failed', AUTH_API_COPY.readFailed, 500);
  }
}
