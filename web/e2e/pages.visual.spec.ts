// web/e2e/pages.visual.spec.ts
//
// FW10 increment 6: a baseline per public page, at desktop and mobile.
//
// RUNS ONLY IN THE CONTAINER (ruling R37), like every other visual spec here -
// see e2e/composants.visual.spec.ts for why a baseline made against one font
// stack and compared against another fails as a missing file and then passes
// against itself on the next run.
//
// WHOLE PAGES, NOT COMPONENTS, and that is the point of adding them. The
// component baselines cover what each piece looks like; nothing until now
// covered what a PAGE looks like - the vertical rhythm between a heading and
// the paragraph under it, the prose measure actually applying, the gap between
// a definition list and the next section, a bulleted list's hanging indent.
// Those are decisions the legal pages make dozens of times and no unit test
// can see.
//
// FULL PAGE, so the footer is in the shot. The legal pages are short enough
// that a viewport-sized capture would show the header and a heading and stop -
// which would be a baseline of the shell, already covered, rather than of the
// page.
//
// THE PLACEHOLDERS ARE IN THE PICTURES, deliberately. Every entity constant is
// empty (ruling R52), so these baselines show [A COMPLETER] where a company
// name belongs. When the operator fills them in, these four files change -
// which is correct: filling in a legal page IS a visual change, and a diff is
// the record of it. The 360 captures make the placeholder's line-wrapping
// visible too, which is the width where a long registered name will first
// cause trouble.

import { test } from '@playwright/test';
import { expectPageBaseline } from './baseline';

/**
 * The pages with a screenshot contract. Not read from lib/content/routes.ts on
 * purpose: a registry-driven loop would silently add a baseline the day a
 * route goes live, and a NEW baseline always passes - it is written, then
 * compared against itself. Adding a page here is a deliberate edit.
 */
const PAGES = [
  { id: 'accueil', path: '/' },
  { id: 'mentions-legales', path: '/mentions-legales' },
  { id: 'confidentialite', path: '/confidentialite' },
  { id: 'cgu', path: '/cgu' },
  // /sources joined at FW12 increment 0 (R113). A deliberate edit, as this
  // list's own comment requires - and worth one: it is the page that
  // discloses P1, P2 and P3, so a silent change to it is a silent change to
  // what the product admits it does not know.
  { id: 'sources', path: '/sources' },
  { id: '404', path: '/cette-page-nexiste-pas' },
] as const;

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const { id, path } of PAGES) {
    test(id, async ({ page }) => {
      await page.goto(path);
      // Fonts before pixels: Inter arriving after the capture would rebaseline
      // every page against a fallback stack.
      await page.evaluate(() => document.fonts.ready);

      await expectPageBaseline(page, `page-${id}-desktop.png`);
    });
  }
});

test.describe('mobile', () => {
  // RULING R127: 1440 AND 390 EVERYWHERE. This suite used 1280 and 360 while
  // the calculator used 1440 and 390, and two defensible pairs in one suite
  // is worse than either: a layout that broke only at 360 was invisible on
  // the calculator, and one that broke only at 390 was invisible here.
  //
  // 390 is the current iPhone width. What replaces the 360 coverage is not a
  // third baseline set but the overflow check in e2e/narrow.spec.ts, which
  // measures every public route at 360 dp - cheap, and it catches the narrow
  // case without twelve more pictures to keep.
  test.use({ viewport: { width: 390, height: 800 } });

  for (const { id, path } of PAGES) {
    test(id, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);

      await expectPageBaseline(page, `page-${id}-mobile.png`);
    });
  }
});
