// web/lib/export/pdf.ts
//
// The dossier printed to A4 by headless Chromium. FW25b increment 1.
//
// ============================================================================
// WHY CHROMIUM AND NOT A PDF LIBRARY (R229)
// ============================================================================
//
// The print route IS the document. A PDF library - pdfkit, jsPDF, any of them -
// would be a SECOND IMPLEMENTATION of the layout, and then the browser and the
// accountant would be looking at two documents that agree only for as long as
// somebody keeps them agreeing. That is the failure R206 and its family exist
// to prevent, arriving on the one surface where it would be most expensive.
//
// One renderer, one layout, no drift.
//
// ============================================================================
// WHY playwright-core AND A SYSTEM CHROMIUM, NOT `playwright`
// ============================================================================
//
// `playwright` downloads ~150 MB of browser on install. `playwright-core` ships
// the driver alone and takes `executablePath`, so the deployment image installs
// Chromium through apt, where security updates arrive as package updates rather
// than as a version bump nobody is watching for.
//
// The second reason matters more: it makes the development browser and the
// runtime browser EXPLICITLY different rather than accidentally identical. That
// is what R232 is about - a pixel baseline taken here would certify a renderer
// that never runs in production, so the assertions are structural.
//
// FW28 INHERITS: the image must `apt-get install -y chromium` (pinned), set
// FRONTALIER_CHROMIUM_PATH to its path, and install the fonts the document
// uses. `@playwright/test` is NOT installed in the image; it is dev-only.

import { chromium, type Browser } from 'playwright-core';

/**
 * The browser could not be started, or could not serve the page.
 *
 * R205 ON A RENDERER. The ordinary deployment failure is an image that forgot
 * Chromium, or a pinned build that moved. The wrong answer is a 200 carrying
 * zero bytes: a zero-byte PDF is a file the Android share sheet hands to an
 * accountant, and its symptom - "the attachment will not open" - is about as
 * far from its cause as a symptom gets.
 */
export class RendererUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RendererUnavailableError';
  }
}

/**
 * The page rendered, but without its stylesheet.
 *
 * ============================================================================
 * R177, AND THE REASON IT IS NOT PARANOIA
 * ============================================================================
 *
 * A document whose CSS failed to load still contains every word, every table
 * row and every figure. It would pass "the banned words are absent", "the annex
 * row count matches the payload" and "the rail is present" - every structural
 * assertion R232 asks for - while being an unformatted wall of text that no
 * fiduciaire would file.
 *
 * It is the same shape R177 names for Lighthouse: *the metric improves as the
 * product breaks*, because there is almost nothing to paint. So the renderer
 * establishes PRESENCE before it prints, by asking the page whether a known
 * design token actually resolves.
 */
export class RendererUnstyledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RendererUnstyledError';
  }
}

/**
 * The page rendered and was styled, but its typeface did not arrive.
 *
 * ============================================================================
 * THE SAME SHAPE AS RendererUnstyledError, ONE LAYER DEEPER
 * ============================================================================
 *
 * The stylesheet resolving and the FONT loading are different events, and in
 * a container they fail independently. Inter reaches Chromium as woff2 over
 * HTTP from this same server through an @font-face rule; the image installs
 * fonts-liberation so that a failure degrades to readable glyphs rather than
 * to tofu, which is what makes this quiet rather than obvious.
 *
 * A DOCUMENT IN THE FALLBACK FACE PASSES EVERY STRUCTURAL ASSERTION R232
 * ASKS FOR - the banned words absent, the annex rows counted, the rail
 * present, --type-family resolving - while being in the wrong typeface. It is
 * a separate class from `unstyled` because it sends whoever reads it
 * somewhere else: unstyled means the CSS did not arrive, fontless means it
 * did and the font behind it did not (R198).
 */
export class RendererFontlessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RendererFontlessError';
  }
}

/**
 * The token whose presence proves the stylesheet arrived.
 *
 * R171: a ROLE, not a coincidence. `--type-family` is declared in the token
 * layer and inherited by `body`, so it resolves on every styled page and on no
 * unstyled one. Asserting a colour would tie this to a palette decision.
 */
const STYLE_PROBE = '--type-family';

/** Chromium's path, when the deployment names one. */
function executablePath(): string | undefined {
  const configured = process.env.FRONTALIER_CHROMIUM_PATH;

  // AN EMPTY STRING IS NOT A PATH. Left as-is it reaches Playwright as a
  // configured executable of "", whose failure names a missing file rather
  // than a missing configuration.
  if (configured === undefined || configured.trim() === '') return undefined;

  return configured;
}

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch({
      executablePath: executablePath(),
      // `--no-sandbox` because the container runs as an unprivileged user with
      // no user-namespace support; `--disable-dev-shm-usage` because the
      // default /dev/shm in a container is 64 MB and Chromium will crash
      // printing a long annex rather than say why.
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (cause) {
    throw new RendererUnavailableError(
      `Chromium could not be started${
        executablePath() === undefined ? '' : ` at ${executablePath()}`
      }`,
      { cause },
    );
  }
}

/**
 * The paper this renderer asks Chromium for.
 *
 * EXPORTED FOR ONE READER (R991): tests/db/container-pdf.test.ts compares the
 * `@page` size the print route SERVES with this value, so the paper is not
 * retyped in a test (R181). The page size still has two homes - this, and the
 * `@page` rule in app/releve/print/print.module.scss (R993) - and that test is
 * what keeps them agreeing. Removing one home is a renderer change.
 */
export const PDF_FORMAT = 'A4';

/**
 * One URL, printed to A4.
 *
 * The caller owns the URL, including its credential - see the route, which
 * mints a short-lived print token rather than trying to give a browser a
 * bearer header.
 */
export async function renderPdf(url: string): Promise<Uint8Array> {
  const browser = await launch();

  try {
    const page = await browser.newPage();

    const response = await page.goto(url, { waitUntil: 'load' });

    // R169's corollary, one layer down: an absence assertion is meaningless
    // until presence is established. Everything below measures a page; this
    // establishes that a page was served at all.
    if (response === null || !response.ok()) {
      throw new RendererUnavailableError(
        `the print route answered ${response === null ? 'nothing' : String(response.status())}`,
      );
    }

    const styled = await page.evaluate(
      (probe) =>
        globalThis
          .getComputedStyle(globalThis.document.body)
          .getPropertyValue(probe)
          .trim().length > 0,
      STYLE_PROBE,
    );

    if (!styled) {
      throw new RendererUnstyledError(
        `the print route rendered without its stylesheet (${STYLE_PROBE} does not resolve)`,
      );
    }

    // ========================================================================
    // AND THE FONT ACTUALLY LOADED (FW28)
    // ========================================================================
    //
    // STYLE_PROBE above proves the STYLESHEET arrived. It cannot prove the
    // FONT did, and in this container those are genuinely different: Inter
    // reaches Chromium as woff2 OVER HTTP from this same server, through an
    // @font-face rule, not from the system. The image installs
    // fonts-liberation as a fallback so a failure degrades to readable glyphs
    // rather than to tofu - which is exactly what makes the failure quiet.
    //
    // A DOCUMENT IN THE FALLBACK FACE PASSES EVERY STRUCTURAL ASSERTION. The
    // banned words are still absent, the annex row count still matches the
    // payload, the rail is still present, the stylesheet still resolves. It
    // is correctly laid out, fully legible, and in the wrong typeface - and
    // the only thing that would have caught it is somebody looking.
    //
    // THE FAMILY IS READ FROM THE PAGE, NOT TYPED HERE (R206). It lives in
    // lib/ui/core/styles/tokens.scss as $font-family-base; naming it again
    // here would be a copy that goes stale the day the stack changes. Reading
    // the computed value asserts THE FONT THIS PAGE ASKS FOR is the one that
    // loaded, whatever that turns out to be.
    const fonts = await page.evaluate(async () => {
      const wanted = globalThis
        .getComputedStyle(globalThis.document.body)
        .fontFamily.split(',')[0]
        ?.trim()
        .replace(/^["']|["']$/gu, '');

      await globalThis.document.fonts.ready;

      const loaded = [...globalThis.document.fonts]
        .filter((face) => face.status === 'loaded')
        .map((face) => face.family.replace(/^["']|["']$/gu, ''));

      return { wanted: wanted ?? '', loaded };
    });

    if (fonts.wanted === '') {
      throw new RendererUnstyledError(
        'the print route resolved no font-family at all, so the stylesheet is not what it seems',
      );
    }

    if (!fonts.loaded.includes(fonts.wanted)) {
      throw new RendererFontlessError(
        `the print route wants ${JSON.stringify(fonts.wanted)} and it did not load. ` +
          `Loaded faces: ${fonts.loaded.length === 0 ? '(none)' : fonts.loaded.join(', ')}. ` +
          'The document would render in a fallback face - correctly laid out, ' +
          'fully legible, and in the wrong typeface.',
      );
    }

    // PRINT MEDIA, EXPLICITLY. Without it the `@page` rule and any print-only
    // CSS are ignored, and the PDF is a screenshot of the screen layout.
    await page.emulateMedia({ media: 'print' });

    return await page.pdf({
      format: PDF_FORMAT,
      printBackground: true,
      // The sheet owns its own margins in millimetres, so the page adds none.
      // Two margin systems would fight, and the visible symptom would be a
      // document that is correct on screen and cropped on paper.
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    // ALWAYS, including on the throws above. A browser leaked per failed
    // request is how a VPS dies slowly rather than loudly.
    await browser.close();
  }
}
