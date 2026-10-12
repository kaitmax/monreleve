// web/e2e/baseline.ts
//
// RULING R128: A BASELINE ASSERTS ITS OWN DIMENSIONS AGAINST THE VIEWPORT.
//
// THE DEFECT THAT PRODUCED THE RULING, and it is worth stating in full because
// the mechanism is counter-intuitive. FW12 shipped a calculator that scrolled
// sideways at every phone width - 101 px of overflow at 320, 61 at 360, 31 at
// 390 - and eight baselines taken at 390 did not show it. They could not:
//
//   `fullPage: true` WIDENS THE CAPTURE TO INCLUDE THE OVERFLOW.
//
// An overflowing page does not photograph as a broken layout. It photographs
// as a COMPLETE layout on a wider canvas. The mobile baselines were 421 px
// images of a 390 px viewport, and every one of them looked correct, because
// they were correct pictures - of a document 31 px wider than the screen it
// has to fit on. The evidence was in the image dimensions and nobody read
// them, including me, in the increment that generated them.
//
// SO THE DIMENSIONS ARE NOW AN ASSERTION. fullPage may extend HEIGHT - that is
// what it is for, and a long legal page is 7008 px tall - but never WIDTH. A
// capture wider than its viewport is horizontal overflow, by definition, and
// the number is already sitting in the PNG header.
//
// WHY AT CAPTURE TIME RATHER THAN FROM A TABLE. The alternative was a unit
// test mapping every baseline name to an expected width, which is a second
// copy of what the specs declare and goes stale the first time a viewport
// changes - R127 changed four of them in one commit. Here the expectation is
// `page.viewportSize()`: the actual viewport, read from the actual run, so
// there is nothing to keep in sync.

import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Where playwright.config.ts's snapshotPathTemplate puts them. */
const BASELINE_DIR = join(process.cwd(), 'tests', 'visual', 'baselines');

/**
 * A PNG's dimensions, from the IHDR chunk.
 *
 * NO IMAGE LIBRARY, because none is needed and one would be a dependency
 * carried for eight bytes. A PNG's width and height are big-endian uint32s at
 * offsets 16 and 20, immediately after the 8-byte signature and the IHDR
 * length and type. The signature is checked so a truncated or non-PNG file
 * fails loudly rather than reporting a nonsense size.
 */
export function pngSize(file: string): { readonly width: number; readonly height: number } {
  const bytes = readFileSync(file);
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  if (bytes.length < 24) throw new Error(`${file} is too short to be a PNG`);

  SIGNATURE.forEach((byte, index) => {
    if (bytes[index] !== byte) throw new Error(`${file} is not a PNG`);
  });

  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * The only capture options this project allows.
 *
 * NARROW ON PURPOSE, AND IT ENFORCES R114 BY TYPE. Playwright's own options
 * object carries maxDiffPixels, maxDiffPixelRatio, threshold and mask - the
 * four hatches R114 forbids and visual-zero-tolerance.test.ts scans the
 * source for. Accepting the full type here would make every one of them
 * available at every call site, checked only by a string scan. Accepting
 * these two makes them unreachable: a tolerance is a compile error rather
 * than a test failure, and stylePath stays available because R114 explicitly
 * keeps it as the way environmental instability is handled.
 *
 * THAT IS TRUE OF CALL SITES AND WAS NEVER TRUE OF THE PROJECT. A type can
 * only refuse what a caller writes; it cannot reach the default Playwright
 * applies when nobody writes anything, which is threshold 0.2 - a 20 %
 * per-pixel colour allowance. FW-SHELL-BURGER measured the cost: 34 phone
 * baselines certified unchanged against a header that had visibly changed.
 * playwright.config.ts now states `threshold: 0, maxDiffPixels: 0`, and
 * tests/unit/meta/visual-zero-tolerance.test.ts asserts those VALUES rather
 * than the absence of the words.
 */
export interface BaselineOptions {
  readonly animations?: 'disabled' | 'allow';
  readonly stylePath?: string;
}

/**
 * A full-page baseline, with R128's assertion attached.
 *
 * The screenshot comparison runs first: if it fails, the dimension check is
 * noise on top of a real diff. If it passes, the stored baseline IS the
 * current rendering, so asserting its width asserts the page's.
 */
export async function expectPageBaseline(
  page: Page,
  name: string,
  options: BaselineOptions = {},
): Promise<void> {
  await expect(page).toHaveScreenshot(name, { fullPage: true, ...options });

  const viewport = page.viewportSize();

  expect(viewport, `no viewport size for ${name}`).not.toBeNull();

  const { width, height } = pngSize(join(BASELINE_DIR, name));

  expect(
    width,
    `R128: ${name} is ${width} px wide for a ${String(viewport?.width)} px viewport. ` +
      'A fullPage capture widens to include horizontal overflow, so this is not ' +
      'a wide picture - it is a page that scrolls sideways at this width.',
  ).toBe(viewport?.width);

  // Height is allowed to exceed the viewport - that is what fullPage is for -
  // but a capture SHORTER than the viewport means the page did not fill the
  // screen, which is its own kind of surprise and free to check here.
  expect(height, `${name} is shorter than its viewport`).toBeGreaterThanOrEqual(
    viewport?.height ?? 0,
  );
}

/**
 * An element baseline, with R128's corollary.
 *
 * An element is not the page, so its width is its own and equality with the
 * viewport would be wrong: the rail specimens are 376 px inside a 1280 px
 * workbench. What still holds is the DIRECTION of the rule - an element
 * captured WIDER than the viewport it was rendered in is the same overflow one
 * level down, and the composants page is where a specimen would first show it.
 */
export async function expectElementBaseline(
  locator: Locator,
  name: string,
): Promise<void> {
  await expect(locator).toHaveScreenshot(name);

  const viewport = locator.page().viewportSize();
  const { width } = pngSize(join(BASELINE_DIR, name));

  expect(
    width,
    `R128 corollary: ${name} is ${width} px wide inside a ` +
      `${String(viewport?.width)} px viewport, so the specimen itself overflows.`,
  ).toBeLessThanOrEqual(viewport?.width ?? 0);
}
