// web/app/api/v1/account/export/route.ts
//
// GET /api/v1/account/export?format=json|csv. FW26 increment 3.
//
// ============================================================================
// THIS IS WHERE /confidentialite BECOMES CODE
// ============================================================================
//
// The privacy notice has said since FW10 that a person can export their data.
// FW14 made the alert-list half true. This is the account half.
//
// ============================================================================
// TWO FORMATS, ONE SERIALISER, AND ONE OF THEM IS NOT THE RECORD
// ============================================================================
//
// JSON is the complete export: settings, entries, the TRAIL, devices and
// sessions. CSV is the entries alone, through `toCsv` - FW25's serialiser,
// not a second one (R206) - because a spreadsheet holds one table and the
// export is five.
//
// R230 applies exactly as it does to the dossier CSV: the CSV neutralises a
// formula-shaped note because a spreadsheet EXECUTES one, and the JSON carries
// it byte for byte because the JSON is the record. Both are asserted.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { authenticate, unauthorised } from '@/lib/auth/bearer';
import { findLocationKeys } from '@/lib/entries/no-coordinates';
import { buildAccountExport } from '@/lib/account/export';
import { csvFilename, toCsv } from '@/lib/export/csv';
import { titulaireOf } from '@/lib/dossier/service';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

function refuse(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ status: 'error', code, message }, { status });
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);

  if (!auth.ok) return unauthorised(auth.code);

  const url = new URL(request.url);
  const coordinates = findLocationKeys(Object.fromEntries(url.searchParams));

  if (coordinates.length > 0) {
    console.error(
      `[account] export refused: location keys (${coordinates.sort().join(', ')})`,
    );

    return refuse('coordinates_refused', AUTH_API_COPY.coordinateRefused);
  }

  const unknown = [...url.searchParams.keys()].filter((key) => key !== 'format');

  if (unknown.length > 0) {
    return NextResponse.json(
      {
        status: 'error',
        code: 'unknown_parameter',
        message: AUTH_API_COPY.unknownParameter,
        parameters: unknown.sort(),
      },
      { status: 400 },
    );
  }

  const format = url.searchParams.get('format') ?? 'json';

  if (format !== 'json' && format !== 'csv') {
    return refuse('invalid_format', AUTH_API_COPY.invalidPayload);
  }

  const data = await buildAccountExport(auth.userId);

  if (format === 'json') {
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="mon-releve-donnees.json"`,
        'cache-control': 'no-store, private',
        vary: 'Authorization',
      },
    });
  }

  // THE CSV IS THE ENTRIES, through the dossier's own serialiser. Every row is
  // `recorded` - an account export is what the person WROTE, and the unlogged
  // days SPEC 12 requires are a fact about a YEAR's document rather than about
  // this person's record.
  const rows = data.entries.map((entry) => ({
    dayDate: entry.dayDate as string,
    recorded: true,
    portion: entry.portion as string,
    kind: entry.kind as string,
    absenceReason: entry.absenceReason as string | null,
    note: entry.note as string | null,
    provenance: entry.provenance as string,
    detectedKind: entry.detectedKind as string | null,
    firstRecordedAt: entry.firstRecordedAt as string,
    lastModifiedAt: null,
    clientClaimedAt: entry.clientClaimedAt as string | null,
    late: false,
  }));

  // R237's filename rule, and the same helper. A person exporting from two
  // accounts needs to tell the files apart, and the CSV names nobody inside.
  const owner = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  const titulaire = titulaireOf(owner?.name ?? null);
  const filename =
    titulaire === null
      ? 'mon-releve-donnees.csv'
      : csvFilename(new Date().getUTCFullYear(), titulaire).replace('releve-', 'donnees-');

  return new NextResponse(toCsv(rows), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store, private',
      vary: 'Authorization',
    },
  });
}
