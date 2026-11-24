// web/e2e/calc-redesign.spec.ts
//
// FW-CALC-REDESIGN (R1406-R1412): what only a browser can say about the two
// calculator pages as one family - the sticky rail, the accordions a fragment
// opens, the keyboard, and the narrowest width with everything open.
//
//   R1408  a link to a section inside a CLOSED accordion opens it. Measured
//          here, on Chromium: the browser's ancestor-details revealing runs
//          for a fragment that points inside a <details>' content, so the
//          ids sit on the content (tests/unit/pages/calc-redesign.test.tsx).
//   R1412  no horizontal page scroll at 320 px with the result shown and
//          every accordion open (R127); every rendered anchor styled with the
//          accordions open (R173); every summary reachable and toggled by
//          Enter and Space; the focus order form -> result -> accordions; the
//          rail sticky on a wide screen and not on a phone; no transition
//          under reduced motion.
//
// The words are read from lib/fr (R171); every check starts on a served 200
// (R169's presence corollary).

import { type Page, expect, test } from '@playwright/test';
import { SECTION_ID } from '../app/(public)/calculateur-lamal-cmu/section-ids';
import { CALCULATOR_PATH, COMPARATOR_PATH } from '../lib/content/routes';
import { LAMAL_COPY } from '../lib/fr/lamal';

/** The seven accordions R1409 names, by the id on their content. */
const FOLD_IDS = [
  SECTION_ID.deadline,
  SECTION_ID.final,
  SECTION_ID.family,
  SECTION_ID.scope,
  SECTION_ID.france,
  SECTION_ID.switzerland,
  SECTION_ID.limits,
] as const;

/** Chromium's unstyled anchor colours (e2e/anchors.spec.ts). */
const UA_DEFAULTS = new Set(['rgb(0, 0, 238)', 'rgb(85, 26, 139)']);

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);

  expect(response?.status(), path).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

async function compare(page: Page): Promise<void> {
  await page.locator('#revenu-fiscal').fill('73519');
  await page.locator('#naissance-0').fill('1985');
  await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
  await expect(page.locator('[data-panel="comparison"]')).toBeVisible();
}

async function calculate(page: Page): Promise<void> {
  await page.selectOption('#canton', 'GE');
  await page.fill('#jours-teletravail', '144');
  await expect(page.locator('[data-panel="tiles"]')).toBeVisible();
}

async function openEveryAccordion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll('main details')];

    all.forEach((details) => {
      (details as HTMLDetailsElement).open = true;
    });

    return all.length;
  });
}

async function sideways(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe('R1408: a fragment into a closed accordion opens it', () => {
  for (const id of FOLD_IDS) {
    test(`#${id}`, async ({ page }) => {
      await open(page, `${COMPARATOR_PATH}#${id}`);

      const target = page.locator(`[id="${id}"]`);
      const details = target.locator('xpath=ancestor::details[1]');

      await expect(details).toHaveCount(1);
      await expect(details).toHaveJSProperty('open', true);
      await expect(target).toBeVisible();
      await expect(target).toBeInViewport();
      // The title it sits under lands in view too, not cut off above the window.
      await expect(details.locator(':scope > summary')).toBeInViewport({ ratio: 1 });
    });
  }

  // On a phone the longest summaries wrap to three lines; the walkthrough
  // measured their titles cut off above the window with the anchor's own
  // margin, so the narrowest width is asserted too.
  test.describe('at 320 px', () => {
    test.use({ viewport: { width: 320, height: 800 } });

    for (const id of FOLD_IDS) {
      test(`#${id}: its title lands whole in view`, async ({ page }) => {
        await open(page, `${COMPARATOR_PATH}#${id}`);

        const details = page.locator(`[id="${id}"]`).locator('xpath=ancestor::details[1]');

        await expect(details).toHaveJSProperty('open', true);
        await expect(details.locator(':scope > summary')).toBeInViewport({ ratio: 1 });
      });
    }
  });

  test('and the accordions are closed when no fragment names them', async ({ page }) => {
    await open(page, COMPARATOR_PATH);

    for (const id of FOLD_IDS) {
      await expect(page.locator(`[id="${id}"]`).locator('xpath=ancestor::details[1]')).toHaveJSProperty('open', false);
    }
  });
});

for (const width of [320, 390] as const) {
  test.describe(`${width} px, the result shown and every accordion open`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('the comparator does not scroll sideways, and every anchor is styled', async ({ page }) => {
      await open(page, COMPARATOR_PATH);
      await compare(page);

      expect(await openEveryAccordion(page)).toBeGreaterThanOrEqual(FOLD_IDS.length + 2);
      expect(await sideways(page), `${COMPARATOR_PATH} at ${width}`).toBeLessThanOrEqual(0);

      const colours = await page.locator('main a').evaluateAll((links) => links.map((link) => getComputedStyle(link).color));

      expect(colours.length).toBeGreaterThan(0);
      expect(colours.filter((colour) => UA_DEFAULTS.has(colour))).toEqual([]);
    });

    test('the telework calculator does not scroll sideways, and every anchor is styled', async ({ page }) => {
      await open(page, CALCULATOR_PATH);
      await calculate(page);

      expect(await openEveryAccordion(page)).toBeGreaterThan(0);
      expect(await sideways(page), `${CALCULATOR_PATH} at ${width}`).toBeLessThanOrEqual(0);

      const colours = await page.locator('main a').evaluateAll((links) => links.map((link) => getComputedStyle(link).color));

      expect(colours.filter((colour) => UA_DEFAULTS.has(colour))).toEqual([]);
    });
  });
}

test.describe('R1412: the keyboard', () => {
  test('every comparator summary takes focus and toggles on Enter and on Space', async ({ page }) => {
    await open(page, COMPARATOR_PATH);
    await compare(page);

    const summaries = page.locator('main details > summary');
    const count = await summaries.count();

    expect(count).toBeGreaterThanOrEqual(FOLD_IDS.length + 2);
    for (let index = 0; index < count; index += 1) {
      const summary = summaries.nth(index);
      const details = summary.locator('xpath=..');

      await summary.focus();
      await expect(summary).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(details).toHaveJSProperty('open', true);
      await page.keyboard.press('Space');
      await expect(details).toHaveJSProperty('open', false);
    }
  });

  test('the focus order is the form, then the result, then the accordions', async ({ page }) => {
    await open(page, COMPARATOR_PATH);
    await compare(page);

    const order = await page.evaluate(() => {
      const form = document.querySelector('main form');
      const result = document.querySelector('[data-result-region] a, [data-result-region] summary, [data-result-region] input');
      const fold = document.querySelector('main [data-a2="fold"] > summary');
      const following = (a: Element | null, b: Element | null): boolean =>
        a !== null && b !== null && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

      return { formThenResult: following(form, result), resultThenFolds: following(result, fold) };
    });

    expect(order).toEqual({ formThenResult: true, resultThenFolds: true });
  });
});

test.describe('R1406: the rail is sticky on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the comparator rail', async ({ page }) => {
    await open(page, COMPARATOR_PATH);
    await compare(page);

    expect(await page.locator('[data-result-region]').evaluate((rail) => getComputedStyle(rail).position)).toBe('sticky');
  });

  test('the telework rail', async ({ page }) => {
    await open(page, CALCULATOR_PATH);
    await calculate(page);

    expect(
      await page.locator('#resultat').evaluate((panel) => {
        for (let at: Element | null = panel; at !== null; at = at.parentElement) {
          if (getComputedStyle(at).position === 'sticky') return 'sticky';
        }

        return 'none';
      }),
    ).toBe('sticky');
  });
});

test.describe('on a phone the rail is not sticky', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('the comparator rail flows after the form', async ({ page }) => {
    await open(page, COMPARATOR_PATH);
    await compare(page);

    expect(await page.locator('[data-result-region]').evaluate((rail) => getComputedStyle(rail).position)).toBe('static');
  });
});

test.describe('R1412: reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const path of [COMPARATOR_PATH, CALCULATOR_PATH]) {
    test(`${path}: no accordion animates`, async ({ page }) => {
      await open(page, path);

      const durations = await page.locator('main details, main details > summary').evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).transitionDuration),
      );

      expect(durations.length).toBeGreaterThan(0);
      expect(durations.filter((duration) => duration !== '0s')).toEqual([]);
    });
  }
});
