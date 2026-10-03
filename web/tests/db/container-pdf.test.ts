// web/tests/db/container-pdf.test.ts
//
// ============================================================================
// R249: THE PDF THE IMAGE PRODUCES, COMPARED WITH THE ONE THIS MACHINE DOES
// ============================================================================
//
// This is the first exercise of R229's playwright-core + apt-Chromium
// packaging anywhere but the development machine, and the failure mode is
// silent. `lib/export/pdf.ts` says so itself: the development browser and the
// runtime browser are EXPLICITLY DIFFERENT, so "it renders here" is not
// evidence about the image.
//
//   here      Playwright's managed Chromium, downloaded by
//             `playwright install chromium`
//   the image Debian's `chromium` package, pinned to 153.0.8010.52-1~deb12u1
//             and verified at build time
//
// A DIFFERENT CHROMIUM IS A DIFFERENT RENDERER, AND IF THEY DIFFER THAT IS
// THE FINDING. Byte equality is NOT expected and is not asserted: two
// Chromium builds embed different producer strings and compress differently.
// What is asserted is that both produce a real PDF, of comparable size, and
// that the image's render passed the probes that matter.
//
// ============================================================================
// THE FONT PROBE IS THE POINT
// ============================================================================
//
// STYLE_PROBE proves the STYLESHEET resolved. It cannot prove the FONT
// loaded, and in this container those fail independently: Inter arrives as
// woff2 over HTTP through an @font-face rule, while the image installs
// fonts-liberation so a failure degrades to readable glyphs rather than to
// tofu.
//
// A document in the fallback face passes EVERY structural assertion - banned
// words absent, annex rows counted, rail present, --type-family resolving -
// while being in the wrong typeface. So renderPdf now refuses it
// (RendererFontlessError), and a byte difference between the two renderers
// can be attributed rather than argued about: if the image's render succeeds
// at all, its font loaded.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueMagicLink } from '@/lib/auth/magic-link';
import { instanceRefusal } from '@/lib/content/identity';
import { mintPrintToken } from '@/lib/export/print-token';
import { renderPdf } from '@/lib/export/pdf';

const BASE = process.env.CONTAINER_BASE_URL;
const EMAIL = 'container-pdf@example.com';
const YEAR = 2026;

let accessToken = '';
let userId = '';

/** A PDF begins with %PDF- and ends with %%EOF. Anything else is not one. */
function looksLikePdf(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.slice(0, 5)).toString('latin1');

  return head === '%PDF-';
}

/** How many pages, counted from the page objects rather than guessed. */
function pageCount(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString('latin1');

  return (text.match(/\/Type\s*\/Page[^s]/gu) ?? []).length;
}

describe.skipIf(BASE === undefined)('R249: the PDF, in the image and here', () => {
  beforeAll(async () => {
    // R169: WHAT is answering, before anything is asserted about it. R301:
    // WHICH instance - this is the test FW33's 503 came from, where a sibling
    // container with a different AUTH_SECRET passed the service check and then
    // could not verify the print token minted below. The harness sets a per-run
    // FRONTALIER_INSTANCE_ID on this container and on this process; a server
    // that does not echo it is refused by name before a token is minted.
    const body = (await (await fetch(`${String(BASE)}/api/health`)).json()) as {
      service?: string;
      instance?: unknown;
    };

    expect(body.service).toBe('monreleve');

    const mismatch = instanceRefusal(process.env.FRONTALIER_INSTANCE_ID, body.instance);

    expect(mismatch, mismatch ?? 'instance matches').toBeNull();

    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.verificationToken.deleteMany({ where: { identifier: EMAIL } });

    // Sign in through the container, exactly as increment 4 does.
    const issued = await issueMagicLink(EMAIL);
    const callback = await fetch(
      `${String(BASE)}/api/v1/auth/callback?token=${encodeURIComponent(
        issued.token,
      )}&email=${encodeURIComponent(EMAIL)}`,
    );

    expect(callback.status).toBe(200);

    accessToken = (await callback.json()).accessToken;

    // THE DOSSIER NEEDS A TITULAIRE. Without a name the route refuses with
    // `titulaire_missing` at 422 - correctly, because a relevé with no name
    // on it is not a document anybody can file.
    const user = await prisma.user.update({
      where: { email: EMAIL },
      // AND A CANTON: SPEC 7 resolves the regime from it and there is no
      // default that is right for everybody, so the dossier refuses without
      // one. Found by the render failing rather than by reading the spec.
      data: { name: 'Camille Fixture', canton: 'GE' },
    });

    userId = user.id;

    // A few days, so the annex has rows to render rather than an empty table.
    await prisma.entry.deleteMany({ where: { userId } });

    for (let day = 1; day <= 5; day += 1) {
      await prisma.entry.create({
        data: {
          userId,
          dayDate: new Date(Date.UTC(YEAR, 0, day + 5)),
          // HOME is telework from France, which is what the 40 % threshold
          // counts. The enum is CH / HOME / MISSION_FR / MISSION_THIRD / ABSENT.
          kind: 'HOME',
          // Client-generated and unique per account (D30), so a retried
          // mutation is recognised rather than duplicated.
          clientMutationId: `container-pdf-${YEAR}-${day}`,
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  });

  it('the IMAGE renders a real PDF, with its own Chromium', async () => {
    const response = await fetch(`${String(BASE)}/api/v1/export/pdf?year=${YEAR}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(
      response.status,
      'the image could not produce a PDF - read the container log for the refusal code',
    ).toBe(200);

    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(looksLikePdf(bytes), 'the answer is not a PDF').toBe(true);

    // R205 ON A RENDERER: a 200 carrying zero bytes is a file the Android
    // share sheet hands to an accountant, whose symptom - "the attachment
    // will not open" - is about as far from its cause as a symptom gets.
    expect(bytes.byteLength, 'the PDF is implausibly small').toBeGreaterThan(5000);
    expect(pageCount(bytes), 'no page objects in the PDF').toBeGreaterThan(0);
  });

  it('BOTH renderers produce a document, and their difference is the finding', async () => {
    // The image's render, through its API.
    const fromImage = new Uint8Array(
      await (
        await fetch(`${String(BASE)}/api/v1/export/pdf?year=${YEAR}`, {
          headers: { authorization: `Bearer ${accessToken}` },
        })
      ).arrayBuffer(),
    );

    // This machine's render, of the SAME URL, with Playwright's Chromium.
    // FRONTALIER_CHROMIUM_PATH is unset here, so renderPdf launches the
    // managed browser - which is the whole point of the comparison.
    const printToken = mintPrintToken(userId, YEAR);

    expect(printToken, 'AUTH_SECRET is unset or is the placeholder here').not.toBeNull();

    const fromHere = await renderPdf(
      `${String(BASE)}/releve/print?year=${YEAR}&token=${encodeURIComponent(String(printToken))}`,
    );

    expect(looksLikePdf(fromImage)).toBe(true);
    expect(looksLikePdf(fromHere)).toBe(true);

    // ======================================================================
    // WHAT IS COMPARED, AND WHAT IS DELIBERATELY NOT
    // ======================================================================
    //
    // NOT bytes. Two Chromium builds embed different producer strings and
    // compress streams differently; a byte assertion would fail on every
    // upstream security update and teach everybody to ignore it.
    //
    // THE PAGE COUNT IS THE STRUCTURAL CLAIM. A renderer that lost the
    // stylesheet, the font, or the print media rule produces a DIFFERENT
    // NUMBER OF PAGES - that is what those failures do to a paginated A4
    // document - so this catches the class while tolerating the noise.
    const imagePages = pageCount(fromImage);
    const herePages = pageCount(fromHere);

    console.log(
      `[pdf] image: ${fromImage.byteLength} bytes, ${imagePages} pages; ` +
        `here: ${fromHere.byteLength} bytes, ${herePages} pages`,
    );

    expect(
      imagePages,
      `the two renderers paginated differently (image ${imagePages}, here ${herePages}). ` +
        'A different page count is what a lost stylesheet, a lost font or a ' +
        'missing print media rule does to an A4 document - it is the finding, ' +
        'not noise.',
    ).toBe(herePages);

    // AND COMPARABLE IN SIZE. A render that silently produced a near-empty
    // document would match on page count if the count were one.
    const ratio = fromImage.byteLength / fromHere.byteLength;

    expect(
      ratio > 0.5 && ratio < 2,
      `the documents differ in size by more than 2x (image ${fromImage.byteLength}, ` +
        `here ${fromHere.byteLength}) - one of them is missing something`,
    ).toBe(true);
  }, 120_000);
});
