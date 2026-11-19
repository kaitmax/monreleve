// web/lib/export/respond-csv.ts
//
// THE CSV DOWNLOAD, ONE IMPLEMENTATION. FW-WEB-ACCOUNT (R900).
//
// MOVED, NOT WRITTEN. Everything below is the body of GET /api/v1/export/pdf
// and GET /api/v1/export/csv after their authentication, coordinate scan and
// query validation - moved here verbatim, with three names changed:
// auth.userId -> userId, query.year -> year, url.origin -> origin. The bearer
// routes call these with the token's person; the website's account area calls
// them with the session's person (lib/web-account/export.ts). So the PDF a
// signed-in browser downloads is rendered, recorded (R329) and refused by the
// SAME code as the PDF the app downloads - "through the existing routes".
//
// WHY MOVED RATHER THAN THE ROUTES ACCEPTING A COOKIE (R900). The cookie's
// Path is the account area. For /api/v1/export/* to receive it the Path would
// have to be "/", and every public page would then carry it - the one thing
// R900 forbids. Sharing the implementation keeps the cookie where it is.
//
// The comments travelled with the code; where one says "this route", it means
// whichever route called.

//
// TWO MODULES SINCE W12, ONE PER DOWNLOAD (R990). C9 kept both in one file,
// lib/export/respond.ts. scripts/gate-selection.mjs selects the container PDF
// step for what the print page and the PDF route ALONE render through, so a
// file the CSV routes also import can never be in that set - and with it out,
// neither is anything the PDF half renders through.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { MissingTitulaireError } from '@/lib/dossier/service';
import { buildDossierFor } from '@/lib/dossier/load';
import { CantonMissingError, YearBeforeActivityError } from '@/lib/dossier/aggregate';
import { csvFilename, toCsv } from '@/lib/export/csv';

function refuse(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ status: 'error', code, message }, { status });
}

/** The CSV for one person and one year: the dossier's annex, serialised. */
export async function csvExportResponse(userId: string, year: number): Promise<NextResponse> {
  try {
    const dossier = await buildDossierFor(userId, year);

    // THE FILENAME CARRIES THE YEAR AND THE TITULAIRE, and under R237 it is
    // the ONLY place this file names whose year it is - the columns are frozen
    // by SPEC 12 and a comment row would break RFC 4180. A reader exporting
    // three years ends up with three files in one folder, and a fiduciaire
    // holding two people's exports needs to tell them apart.
    return new NextResponse(toCsv(dossier.annex), {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${csvFilename(year, dossier.titulaire)}"`,
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
    // 500), with future_year's status. R587: each with the dossier route's own
    // message for it, not the borrowed ones (read_failed's, invalid_year's).
    if (cause instanceof CantonMissingError) {
      console.error(`[export] csv refused: ${cause.message}`);

      return refuse('canton_missing', AUTH_API_COPY.cantonMissing, 422);
    }

    if (cause instanceof YearBeforeActivityError) {
      console.error(`[export] csv refused: ${cause.message}`);

      return refuse('year_before_activity', AUTH_API_COPY.yearBeforeActivity(year));
    }

    console.error(
      `[export] csv for ${year} failed:`,
      cause instanceof Error ? cause.message : String(cause),
    );

    return refuse('read_failed', AUTH_API_COPY.readFailed, 500);
  }
}
