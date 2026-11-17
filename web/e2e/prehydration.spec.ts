// web/e2e/prehydration.spec.ts
//
// FW-PREHYDRATION-SITES, R1056-R1058: WHAT A PERSON TYPES BEFORE THE PAGE
// HYDRATES IS KEPT, on the three islands W18's census (R1044) found losing it:
// the comparator's form, the calculator's form and the home counter.
//
// Every test runs in BOTH orders, as rappel-delai.spec.ts does for the
// deadline helper:
//   - "as loaded": the page is opened normally and typed into at once -
//     whichever side of hydration that lands on, which is the reader's
//     situation;
//   - "before hydration": every script is held at the network until the typing
//     is done (e2e/support/hydration.ts, W18's plant, verified in each call),
//     so the typing lands on the server's HTML by construction.
//
// WHAT EACH TEST WAITS FOR. Nothing in the as-loaded order beyond what the
// assertions retry. In the held order, the plant's own wait for React's fiber
// on a field of the island - AFTER the typing, so it cannot move the typing
// past hydration.
//
// EXPECTED FIGURES ARE NEVER TYPED HERE (R171, R181): a result is compared
// with the same page's result for the same values reached another way - a
// shared link for the calculator, the island's own onChange for the counter.

import { expect, type Locator, type Page, test } from '@playwright/test';
import { CALCULATOR_PATH, COMPARATOR_PATH } from '../lib/content/routes';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { HOME_COPY } from '../lib/fr/home';
import { LAMAL_COPY } from '../lib/fr/lamal';
import { typeBeforeHydration } from './support/hydration';

/** The two orders a value can reach an island in. */
const ORDERS = [
  { title: 'as loaded', beforeHydration: false },
  { title: 'before hydration (R1056)', beforeHydration: true },
] as const;

type Order = (typeof ORDERS)[number];

/**
 * Opens `path` and runs `type`, in the order named. `field` is a control of the
 * island, the one the plant watches for hydration.
 */
async function openAndType(
  page: Page,
  order: Order,
  path: string,
  field: (page: Page) => Locator,
  type: () => Promise<void>,
): Promise<void> {
  if (order.beforeHydration) {
    // The plant's evidence, in the run's output: which requests waited, and for how long.
    console.log(`[R1056] ${test.info().title}: ${await typeBeforeHydration(page, path, field(page), type)}`);
  } else {
    await page.goto(path);
    await type();
  }
}

/** Whitespace as a reader sees it: every run of spaces, NBSP or NNBSP is one. */
const squash = (text: string | null): string => (text ?? '').replace(/[\s\u00a0\u202f]+/gu, ' ').trim();

/** The calculator's rate slot, as the reader sees it. */
async function rateSlot(page: Page): Promise<readonly string[]> {
  const rate = page.locator('#resultat [data-panel="rate"]');

  await expect(rate).toBeVisible();

  return (await rate.locator('p').allTextContents()).map(squash);
}

/** The calculator's rate slot for `query`, opened as a shared link in a fresh page. */
async function rateSlotFor(page: Page, query: string): Promise<readonly string[]> {
  const control = await page.context().newPage();

  try {
    await control.goto(`${CALCULATOR_PATH}?${query}`);

    return await rateSlot(control);
  } finally {
    await control.close();
  }
}

// ---------------------------------------------------------------------------
// THE COMPARATOR (R1044 b): the income, the first person's birth year and
// accident box. On base, "Comparer" emptied the first two, showed the income
// error and unticked the box.
// ---------------------------------------------------------------------------

const INCOME = '73519';
const BIRTH_YEAR = '1985';

for (const order of ORDERS) {
  test(`the comparator keeps the income, the birth year and the accident box typed ${order.title}`, async ({
    page,
  }) => {
    await openAndType(
      page,
      order,
      COMPARATOR_PATH,
      (p) => p.locator('#revenu-fiscal'),
      async () => {
        await page.locator('#revenu-fiscal').fill(INCOME);
        await page.locator('#naissance-0').fill(BIRTH_YEAR);
        await page.locator('#accidents-0').check();
      },
    );

    await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();

    await expect(page.locator('[data-panel="comparison"]')).toBeVisible();
    // No field is marked invalid (FieldGroup sets aria-invalid with its error).
    await expect(page.locator('form [aria-invalid="true"]')).toHaveCount(0);
    await expect(page.locator('#revenu-fiscal')).toHaveValue(INCOME);
    await expect(page.locator('#naissance-0')).toHaveValue(BIRTH_YEAR);
    await expect(page.locator('#accidents-0')).toBeChecked();
  });
}

// ---------------------------------------------------------------------------
// THE HOME COUNTER (R1044 e): the sliders. On base, the thumb showed the moved
// value while the label and every figure stayed at the default.
// ---------------------------------------------------------------------------

/** How far the telework slider is moved, by keyboard as a reader moves it. */
const STEPS = 10;

for (const order of ORDERS) {
  test(`the home counter follows a slider moved ${order.title}`, async ({ page }) => {
    const slider = page.locator('#home-counter-tt');
    const label = page.locator('label[for="home-counter-tt"]');
    const rate = page.locator('[data-counter-rate]');
    let start = 0;

    await openAndType(page, order, '/', () => slider, async () => {
      start = Number(await slider.inputValue());
      await slider.focus();
      for (let step = 0; step < STEPS; step += 1) await page.keyboard.press('ArrowRight');
    });

    const moved = start + STEPS;

    await expect(slider).toHaveValue(String(moved));
    await expect.poll(async () => squash(await label.textContent())).toBe(
      squash(`${HOME_COPY.counter.teleworkLabel} ${String(moved)}`),
    );

    const shown = squash(await rate.textContent());

    // The same position reached through the island's own onChange: one step
    // back and one forward. The figures must not move, because they were
    // already the moved position's.
    await slider.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue(String(moved));
    expect(squash(await rate.textContent())).toBe(shown);

    // And moving the OTHER slider no longer puts this one back (R1044 e).
    await page.locator('#home-counter-base').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue(String(moved));
  });
}

// ---------------------------------------------------------------------------
// THE CALCULATOR (R1044 c): canton, the numeric fields, radios, chips. On
// base, the screen showed the typed values while the result showed the empty
// state, and the next keystroke reset them.
// ---------------------------------------------------------------------------

const CANTON = 'GE';
const DAYS = '84';
const firstChip = (page: Page): Locator => page.locator('input[name="rythme"]').first();

for (const order of ORDERS) {
  test(`the calculator keeps the canton, the days, the missions answer and a chip typed ${order.title}`, async ({
    page,
  }) => {
    await openAndType(page, order, CALCULATOR_PATH, (p) => p.locator('#canton'), async () => {
      await page.locator('#canton').selectOption(CANTON);
      await page.locator('#jours-teletravail').fill(DAYS);
      await page.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.yes }).check();
      await firstChip(page).check();
    });

    // The result is the one a shared link with the same values gives.
    expect(await rateSlot(page)).toEqual(await rateSlotFor(page, `canton=${CANTON}&tt=${DAYS}`));
    // The missions answer reached the state: its fields are revealed.
    await expect(page.locator('#missions-france')).toBeVisible();

    // The next keystroke re-renders the island; nothing typed earlier goes back.
    await page.locator('#taux-activite').fill('80');
    await expect(page.locator('#taux-activite')).toHaveValue('80');
    await expect(page.locator('#canton')).toHaveValue(CANTON);
    await expect(page.locator('#jours-teletravail')).toHaveValue(DAYS);
    await expect(firstChip(page)).toBeChecked();
  });
}

// ---------------------------------------------------------------------------
// THE CALCULATOR AND ITS SHARED LINK (R1057, Web Ruling 36's default). The
// page is static, so the server renders the DEFAULTS into the fields, never
// the link's values: the island reads the link on mount. So a field still
// holding its server value was not touched and takes the link's; a field the
// person changed keeps the change.
// ---------------------------------------------------------------------------

/** Geneva case (c) as SPEC 9.4 carries it: 84 days, 24 mission days in France. */
const LINK_QUERY = 'canton=GE&tt=84&mfr=24&decompte=dj';
const EDITED_DAYS = '100';

for (const order of ORDERS) {
  test(`a shared link left untouched ${order.title} shows the link's result`, async ({ page }) => {
    await openAndType(page, order, `${CALCULATOR_PATH}?${LINK_QUERY}`, (p) => p.locator('#canton'), async () => {
      // Nothing typed: the reader only opens the link.
    });

    await expect(page.locator('#canton')).toHaveValue(CANTON);
    await expect(page.locator('#jours-teletravail')).toHaveValue(DAYS);
    await expect(page.locator('#missions-france')).toHaveValue('24');
    expect(await rateSlot(page)).toEqual(await rateSlotFor(page, LINK_QUERY));
  });

  test(`a shared link edited ${order.title} shows the edit, and the link for the rest`, async ({ page }) => {
    await openAndType(page, order, `${CALCULATOR_PATH}?${LINK_QUERY}`, (p) => p.locator('#canton'), async () => {
      if (order.beforeHydration) {
        await page.locator('#jours-teletravail').fill(EDITED_DAYS);
      } else {
        // As loaded, the edit is made to the link's own value once it shows.
        await expect(page.locator('#jours-teletravail')).toHaveValue(DAYS);
        await page.locator('#jours-teletravail').fill(EDITED_DAYS);
      }
    });

    await expect(page.locator('#jours-teletravail')).toHaveValue(EDITED_DAYS);
    await expect(page.locator('#canton')).toHaveValue(CANTON);
    await expect(page.locator('#missions-france')).toHaveValue('24');
    expect(await rateSlot(page)).toEqual(
      await rateSlotFor(page, LINK_QUERY.replace(`tt=${DAYS}`, `tt=${EDITED_DAYS}`)),
    );
  });
}
