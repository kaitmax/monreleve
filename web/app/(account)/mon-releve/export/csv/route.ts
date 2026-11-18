// web/app/(account)/mon-releve/export/csv/route.ts
//
// POST /mon-releve/export/csv - the year's days as CSV, for the signed-in
// person. FW-WEB-ACCOUNT (R900, R902, R903). The read and its refusals are
// GET /api/v1/export/csv's, shared through lib/export/respond-csv.ts.

import type { NextResponse } from 'next/server';
import { csvExportResponse } from '@/lib/export/respond-csv';
import { accountDownload } from '@/lib/web-account/export';
import { accountAreaClosed, accountAreaOpen } from '@/lib/web-account/open';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  if (!accountAreaOpen()) return accountAreaClosed();

  return accountDownload(request, async (userId, year) => csvExportResponse(userId, year));
}
