// web/lib/export/respond-pdf.ts
//
// THE PDF DOWNLOAD, ONE IMPLEMENTATION. FW-WEB-ACCOUNT (R900).
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
import { prisma } from '@/lib/db/client';
import { buildDossierFor } from '@/lib/dossier/load';
import { YearBeforeActivityError } from '@/lib/dossier/aggregate';
import { figuresFromDossier, newVerificationCode, recordIssuance, sha256Hex } from '@/lib/issuance/record';
import { mintPrintToken } from '@/lib/export/print-token';
import {
  RendererFontlessError,
  RendererUnavailableError,
  RendererUnstyledError,
  renderPdf,
} from '@/lib/export/pdf';
import {
  RenderBusyError,
  RenderTimeoutError,
  renderSlots,
  withRenderSlot,
} from '@/lib/export/render-queue';

import { titulaireOf } from '@/lib/dossier/service';

function refuse(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ status: 'error', code, message }, { status });
}

/**
 * The PDF for one person and one year, rendered from `origin` - the address
 * the calling request arrived on, which is the address Chromium can reach.
 */
export async function pdfExportResponse(userId: string, year: number, origin: string): Promise<NextResponse> {
  // SPEC 12 item 1, CHECKED BEFORE A BROWSER IS LAUNCHED. A document with no
  // identified titulaire cannot be produced at all, so discovering it inside
  // Chromium would cost a render and report `renderer_unavailable` - a code
  // that sends the operator looking for a missing browser (R198).
  //
  // The predicate is the one `buildDossier` refuses with, not a second reading
  // of what a blank name is (R206).
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  if (owner === null || titulaireOf(owner.name) === null) {
    console.error('[export] pdf refused: the account has no name, so the dossier has no titulaire');

    return refuse('titulaire_missing', AUTH_API_COPY.readFailed, 422);
  }

  const printToken = mintPrintToken(userId, year);

  if (printToken === null) {
    // AUTH_SECRET is unset or is the placeholder .env.example ships. The print
    // route would refuse the render anyway; refusing here names the cause
    // instead of reporting it as a render failure two layers away (R198).
    console.error('[export] pdf refused: AUTH_SECRET is unset or is the shipped placeholder');

    return refuse('not_configured', AUTH_API_COPY.readFailed, 503);
  }

  // FW-VERIFY (R329): the instant and the code are assigned HERE, once. The
  // instant is passed into the print URL so the document's generation date is
  // the same instant the record stores; the code is generated now because it is
  // printed on the document (R332-gated) and therefore has to exist before the
  // file is rendered and hashed.
  const generatedAt = new Date();
  const code = newVerificationCode();

  // The dossier the record's figures are read from. Built with the assigned
  // instant so this and the print page produce the identical document. Any
  // failure here is a data problem (no canton, say) - named rather than
  // surfaced later as a misleading renderer failure (R198).
  let dossier;

  try {
    dossier = await buildDossierFor(userId, year, generatedAt);
  } catch (cause) {
    console.error(
      '[export] pdf refused: the dossier could not be built',
      cause instanceof Error ? cause.message : String(cause),
    );

    // R580: a year before the activity start is named here as on /dossier and
    // /export/csv. It answered 422 dossier_incomplete; moving it is ADDITIVE
    // under docs/api-v1.md 6 - no code is removed or renamed (dossier_incomplete
    // still answers every other failed build, the canton-less account among
    // them, R583), and 422 -> 400 stays within the class. The argument is in
    // docs/api-v1.md 11.3. R587: with the dossier route's own message for it,
    // no longer invalid_year's.
    if (cause instanceof YearBeforeActivityError) {
      return refuse('year_before_activity', AUTH_API_COPY.yearBeforeActivity(year));
    }

    return refuse('dossier_incomplete', AUTH_API_COPY.readFailed, 422);
  }

  const target = new URL('/releve/print', origin);
  target.searchParams.set('year', String(year));
  target.searchParams.set('token', printToken);
  target.searchParams.set('generatedAt', generatedAt.toISOString());
  // FW-VERIFY (R332): the issued code travels to the print route, which prints it
  // (and the address and QR) ONLY when a permanent origin is set. The record
  // stores the code regardless; the document shows it only when it can be used.
  target.searchParams.set('code', code);

  try {
    // ONE RENDER AT A TIME, with a bounded waiting room. A render costs a
    // Chromium process tree; two at once on the single VPS D1 specifies is the
    // difference between a document and an OOM kill - and an OOM kill takes
    // the database connection pool with it. See lib/export/render-queue.ts.
    const pdf = await withRenderSlot(() => renderPdf(target.toString()));

    // EVERY ISSUED RELEVE IS RECORDED (R329). The hash is of the bytes about to
    // be returned, so the record fingerprints exactly the file the person
    // receives. A new version supersedes any current one for this year.
    //
    // IF RECORDING FAILS, THE DOCUMENT IS NOT RETURNED. An unrecorded releve is
    // one nobody can verify, which defeats the feature - so a record failure is
    // a refusal (R198: its own code), not a document handed out quietly.
    try {
      await recordIssuance({
        userId: userId,
        taxYear: year,
        code,
        sha256: sha256Hex(pdf),
        generatedAt,
        figures: figuresFromDossier(dossier),
      });
    } catch (cause) {
      console.error(
        '[export] pdf produced but the issuance record failed; refusing to return an unrecorded releve:',
        cause instanceof Error ? cause.message : String(cause),
      );

      return refuse('record_failed', AUTH_API_COPY.readFailed, 500);
    }

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="releve-${year}.pdf"`,
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
    //
    // BUSY AND TIMED-OUT ARE NOT THE SAME FACT, and a client should act on
    // them differently: turned away at the door means retry shortly; waited
    // and gave up means the machine is saturated and backing off is right.
    if (cause instanceof RenderBusyError) {
      const { active, queued } = renderSlots();

      console.warn(`[export] pdf busy: ${active} rendering, ${queued} waiting`);

      return NextResponse.json(
        { status: 'error', code: 'renderer_busy', message: AUTH_API_COPY.readFailed },
        // Retry-After is what turns a 503 into an instruction. Without it a
        // client either gives up or hammers, and both are worse than waiting.
        { status: 503, headers: { 'retry-after': '30' } },
      );
    }

    if (cause instanceof RenderTimeoutError) {
      console.warn(`[export] pdf timed out waiting for a slot: ${cause.message}`);

      return NextResponse.json(
        { status: 'error', code: 'renderer_timeout', message: AUTH_API_COPY.readFailed },
        { status: 503, headers: { 'retry-after': '60' } },
      );
    }

    if (cause instanceof RendererUnavailableError) {
      console.error(`[export] pdf renderer unavailable: ${cause.message}`);

      return refuse('renderer_unavailable', AUTH_API_COPY.readFailed, 503);
    }

    if (cause instanceof RendererUnstyledError) {
      console.error(`[export] pdf refused: ${cause.message}`);

      return refuse('renderer_unstyled', AUTH_API_COPY.readFailed, 503);
    }

    // A SEPARATE CODE FROM `renderer_unstyled`, because the two send whoever
    // reads the log somewhere else (R198): unstyled means the CSS did not
    // arrive, fontless means it did and the webfont behind it did not. The
    // second is the quieter failure - a correctly laid out, fully legible
    // document in the wrong typeface, which passes every structural check.
    if (cause instanceof RendererFontlessError) {
      console.error(`[export] pdf refused: ${cause.message}`);

      return refuse('renderer_fontless', AUTH_API_COPY.readFailed, 503);
    }

    console.error(
      `[export] pdf for ${year} failed:`,
      cause instanceof Error ? cause.message : String(cause),
    );

    return refuse('read_failed', AUTH_API_COPY.readFailed, 500);
  }
}
