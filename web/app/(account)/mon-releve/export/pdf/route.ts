// web/app/(account)/mon-releve/export/pdf/route.ts
//
// POST /mon-releve/export/pdf - the year's PDF, for the signed-in person.
// FW-WEB-ACCOUNT (R900, R902, R903). The render, the issuance record and every
// refusal are GET /api/v1/export/pdf's, shared through lib/export/respond-pdf.ts;
// lib/web-account/export.ts says why the cookie does not travel there instead.

import type { NextResponse } from 'next/server';
import { pdfExportResponse } from '@/lib/export/respond-pdf';
import { accountDownload } from '@/lib/web-account/export';
import { accountAreaClosed, accountAreaOpen } from '@/lib/web-account/open';

export const dynamic = 'force-dynamic';
// Playwright drives a child process; the Edge runtime cannot (as the API route).
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  if (!accountAreaOpen()) return accountAreaClosed();

  return accountDownload(request, pdfExportResponse);
}
