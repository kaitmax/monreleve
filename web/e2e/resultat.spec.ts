// web/e2e/resultat.spec.ts
//
// R351, THE SCRIPTED HALF: the journey back from the result page into the
// calculator, with the island running.
//
// WHY IT IS NOT IN resultat.nojs.spec.ts. The calculator's link notice is
// rendered by the island from a mount effect - it reads window.location once
// and sets state - so with JavaScript disabled it never renders under any
// circumstances. An assertion there that the calculator does not name
// `missions` would be satisfied by a page that names nothing ever, which is
// R169's absence corollary exactly. The island has to be running for the
// claim to mean anything.
//
// THE DEFECT IT GUARDS (R267). Filtering the form's own controls out of the
// RESULT page's notice fixed one surface and left the other reachable: the
// back link handed the raw query to the calculator, the island decoded it on
// mount, and a reader who had just answered the mission question was told
// "ces parametres ne sont pas utilises par le calculateur : missions". The
// filter and the link were both changed; this asserts the journey.

import { expect, test } from '@playwright/test';
import { CALCULATOR_PATH, RESULT_PATH } from '../lib/content/routes';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { PARAM_NOTICE } from '../lib/fr/params';

const YES = encodeURIComponent(CALCULATEUR_COPY.form.missions.yes);
const WITH_MISSIONS = `${RESULT_PATH}?canton=GE&tt=84&mfr=24&missions=${YES}`;

test.describe('R351: back into the calculator, with the island running', () => {
  test('the calculator does not disown the mission question', async ({ page }) => {
    await page.goto(WITH_MISSIONS);
    await page.getByRole('link', { name: CALCULATEUR_COPY.resultat.modify }).click();
    await page.waitForLoadState('load');

    expect(new URL(page.url()).pathname).toBe(CALCULATOR_PATH);

    // The island has mounted and decoded by now; the notice renders in the
    // same paint as the result it qualifies.
    const main = (await page.locator('main').textContent()) ?? '';

    // DERIVED, never typed: the sentence puts a no-break space before its
    // colon (R91) and the list after it, so spelling it out here is how an
    // assertion passes because it was looking for the wrong string.
    expect(main).not.toContain(PARAM_NOTICE.ignored(['missions']));
    await expect(page.locator('[data-notice="params"]')).toHaveCount(0);
  });

  test('and it still says so for a genuinely stray parameter', async ({ page }) => {
    // NON-VACUITY (R133). Everything above is an absence, and all of it holds
    // on an island that renders no notice at all - which was the state of
    // this page for every reader with scripting off, and would be a real
    // regression here.
    await page.goto(`${CALCULATOR_PATH}?canton=GE&tt=84&utm_source=fb`);

    const notice = page.locator('[data-notice="params"]');

    await expect(notice).toHaveCount(1);
    expect((await notice.textContent()) ?? '').toContain(PARAM_NOTICE.ignored(['utm_source']));
  });

  test('the scenario survives the round trip, so the link is not merely clean', async ({
    page,
  }) => {
    // R154: a back link that dropped everything would pass both tests above.
    await page.goto(WITH_MISSIONS);
    await page.getByRole('link', { name: CALCULATEUR_COPY.resultat.modify }).click();
    await page.waitForLoadState('load');

    const landed = new URL(page.url());

    expect(landed.searchParams.get('canton')).toBe('GE');
    expect(landed.searchParams.get('tt')).toBe('84');
    expect(landed.searchParams.get('mfr')).toBe('24');
    expect(landed.searchParams.has('missions')).toBe(false);
  });
});
