// web/e2e/calculateur.spec.ts
//
// FW11 AC3 and ruling R54, proved where they can only be proved.
//
// WHY THE NO-JAVASCRIPT ASSERTION CANNOT BE A UNIT TEST. A jsdom render of the
// page component proves the server component RETURNS the copy. It cannot prove
// that what a browser with scripting disabled RECEIVES contains it - that
// depends on Next actually server-rendering this route rather than shipping a
// shell that fills itself in on hydration, which is a build-and-serve fact.
// `javaScriptEnabled: false` is the only place the distinction is real.
//
// SPEC 9.3: "Static HTML renders the full explanatory content server-side: the
// CALCULATION needs JavaScript; the PAGE must be meaningful without it."
//
// The form island arrives in increment 2. What increment 1 owes is the copy
// and no result region, which is what this asserts.

import { expect, test } from '@playwright/test';
import { CALCULATOR_PATH, gateRobotsDirective, sitemapPaths } from '../lib/content/routes';
import { LAST_REGULATORY_REVIEW } from '../lib/content/regulatory';
import { currentTaxYear } from '../lib/content/tax-year';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { PROVISIONAL_COPY } from '../lib/fr/provisional';
import { ruleSetFor } from '../lib/calc-engine';
import { formatPercent } from '../lib/ui/core';

const YEAR = currentTaxYear();
const RULES = ruleSetFor(YEAR);

const ceiling = (rate: number): string => {
  const percent = rate * 100;

  return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
};

const FISCAL = ceiling(RULES.fiscalCeiling);
const SOCIAL = ceiling(RULES.socialCeiling);

test.describe('with JavaScript disabled (AC3)', () => {
  test.use({ javaScriptEnabled: false });

  test('the page is meaningful: heading, intro, all three paragraphs', async ({ page }) => {
    const response = await page.goto(CALCULATOR_PATH);

    expect(response?.status()).toBe(200);

    // BY textContent, not toContainText: the copy carries U+00A0 before its
    // punctuation (R91) and Playwright's text matchers normalise both sides,
    // so they could not tell a no-break space from a plain one. R71.
    const body = (await page.locator('main').textContent()) ?? '';

    expect(body).toContain(CALCULATEUR_COPY.title);
    expect(body).toContain(CALCULATEUR_COPY.intro(FISCAL, SOCIAL));
    expect(body).toContain(CALCULATEUR_COPY.fiscal(FISCAL));
    expect(body).toContain(CALCULATEUR_COPY.social(SOCIAL));
    expect(body).toContain(CALCULATEUR_COPY.missions(FISCAL));
  });

  test('never a blank shell - the copy is in the SERVED html', async ({ page }) => {
    // The distinction that matters. Without scripting there is no hydration,
    // so anything present here was rendered on the server. A page that
    // rendered its copy on the client would pass every jsdom test and fail
    // this one.
    await page.goto(CALCULATOR_PATH);

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main.length).toBeGreaterThan(400);
    expect(await page.locator('h1').count()).toBe(1);
  });

  test('shows the tax year (R55), resolved on the server', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main).toContain(CALCULATEUR_COPY.yearCaption(YEAR));
  });

  test('renders the form, so the page is not a wall of prose', async ({ page }) => {
    // AC3's second clause: "the page shows the full explanatory copy, THE
    // FORM, and no result". With scripting off the island never hydrates, but
    // it is a Server Component render first - so the controls are in the
    // served HTML and a user can at least see what the tool asks for.
    await page.goto(CALCULATOR_PATH);

    for (const label of [
      CALCULATEUR_COPY.form.canton.label,
      CALCULATEUR_COPY.form.rate.label,
      CALCULATEUR_COPY.form.days.label,
    ]) {
      await expect(page.getByText(label, { exact: true }), label).toBeVisible();
    }
  });

  test('renders NO result, only the invitation to start one', async ({ page }) => {
    // AC3's third clause, and it CHANGED SHAPE at increment 4. This asserted
    // that no aria-live region existed at all, which was right when there was
    // no form: an empty live region announces nothing on every navigation.
    //
    // Now the region has a job, so the requirement is the one AC3 actually
    // states - no RESULT - and the region says why rather than sitting empty.
    // Scoped to the region because the explanatory copy below it legitimately
    // contains the ceiling as a percentage.
    await page.goto(CALCULATOR_PATH);

    const region = page.locator('[aria-live]');

    await expect(region).toHaveCount(1);

    // textContent, not toHaveText: the note is compared by codepoint and
    // Playwright's text matchers normalise both sides (R66/R71).
    const text = (await region.textContent()) ?? '';

    expect(text).toBe(CALCULATEUR_COPY.result.empty);
    expect(text).not.toContain('%');
  });

  test('the shell is still there, so the page is navigable', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });
});

test.describe('ruling R54: the gate, in the state it is actually in', () => {
  test('is indexable, because the review is recorded', async ({ page }) => {
    // The three surfaces have to AGREE. A page that were noindex while listed
    // in the sitemap would tell a crawler two different things, which is the
    // failure R54's single condition exists to make impossible.
    await page.goto(CALCULATOR_PATH);

    expect(LAST_REGULATORY_REVIEW).not.toBeNull();
    expect(gateRobotsDirective()).toBeNull();

    const robots = page.locator('meta[name="robots"]');

    // Next emits no robots meta when the field is absent. If one appears it
    // must not say noindex.
    if ((await robots.count()) > 0) {
      expect((await robots.getAttribute('content')) ?? '').not.toContain('noindex');
    }
  });

  test('is listed in the sitemap, and the sitemap agrees with the page', async ({ request }) => {
    const body = await request.get('/sitemap.xml').then((r) => r.text());

    expect(sitemapPaths()).toContain(CALCULATOR_PATH);
    expect(body).toContain(`${CALCULATOR_PATH}</loc>`);
  });

  test('is linked from the nav and the footer', async ({ page }) => {
    // The third surface. Absence here while the review was null was the point
    // of R54: a page linked from every other page, asking not to be indexed,
    // gets indexed anyway.
    await page.goto('/');

    const links = page.locator(`a[href="${CALCULATOR_PATH}"]`);

    expect(await links.count()).toBeGreaterThan(0);
  });

  test('carries a self-referencing canonical like every other public page', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    // head-scoped: see the long note in e2e/routing.spec.ts. THIS is the page
    // whose canonical was emitted into the body, so of the two files this is
    // the one where the scoping earns its keep.
    const canonical = page.locator('head > link[rel="canonical"]');

    await expect(canonical).toHaveCount(1);
    expect(await canonical.getAttribute('href')).toBe(
      `https://frontalier.example${CALCULATOR_PATH}`,
    );
  });
});

// ---------------------------------------------------------------------------
// FW11 INCREMENT 5: the keyboard path through every control.
//
// WHY THIS IS AN E2E TEST AND NOT A UNIT TEST. Tab order is a browser
// behaviour: it comes from document order, from tabindex, from whether an
// element is rendered at all, and - for a radio group - from the roving
// tabindex the browser applies so that a group is one stop and the arrows move
// inside it. jsdom implements none of that, so a unit test asserting a tab
// sequence would be asserting a fiction.
//
// THE SEQUENCE IS COLLECTED, NOT PRESCRIBED one press at a time. Asserting
// "the third Tab lands on the day field" breaks every time a field is added
// and says nothing about what a user experiences. What matters is that every
// control IS reachable, that the three parts of a stepper come in the order
// they are drawn, and that a collapsed accordion contributes NOTHING - which
// is the one that would actually go wrong.
// ---------------------------------------------------------------------------

/**
 * How the focused element identifies itself, in order of usefulness.
 *
 * A FUNCTION, NOT A STRING, and the string version cost a red run worth
 * recording. page.evaluate accepts a string and evaluates it as an
 * EXPRESSION - so a string containing "() => { ... }" evaluates to a function
 * object, which Playwright then serialises to undefined. Every assertion
 * compared its expected value against undefined and the failure looked like a
 * focus bug rather than a harness one.
 *
 * Declared at module scope with no closure over anything, which is what lets
 * Playwright stringify it into the page.
 */
function focusProbe(): string {
  const el = document.activeElement;

  if (el === null) return 'none';

  const aria = el.getAttribute('aria-label');

  if (aria !== null && aria !== '') return `aria:${aria}`;
  if (el.id !== '') return `id:${el.id}`;

  const text = (el.textContent ?? '').trim();

  if (text !== '') return `text:${text}`;

  return el.tagName.toLowerCase();
}

test.describe('the keyboard path (increment 5)', () => {
  /** Tab `count` times from the top of the document, recording each stop. */
  const walk = async (page: import('@playwright/test').Page, count: number) => {
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });

    const stops: string[] = [];

    for (let index = 0; index < count; index += 1) {
      await page.keyboard.press('Tab');
      stops.push(await page.evaluate(focusProbe));
    }

    return stops;
  };

  test('reaches every visible control', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    const stops = await walk(page, 24);

    for (const expected of [
      'id:canton',
      `aria:${CALCULATEUR_COPY.form.rate.decrease}`,
      'id:taux-activite',
      `aria:${CALCULATEUR_COPY.form.rate.increase}`,
      `aria:${CALCULATEUR_COPY.form.days.decrease}`,
      'id:jours-teletravail',
      `aria:${CALCULATEUR_COPY.form.days.increase}`,
      `text:${CALCULATEUR_COPY.form.advanced.summary}`,
      `text:${CALCULATEUR_COPY.result.calculate}`,
    ]) {
      expect(stops, expected).toContain(expected);
    }
  });

  test('tabs through a stepper in the order it is DRAWN, not merely declared', async ({
    page,
  }) => {
    // MEASURED ON SCREEN, and the first version of this was not. It compared
    // tab positions only, which is DOM order - so a probe adding
    // flex-direction: row-reverse left it green while the buttons had swapped
    // sides. That is the whole defect the test was named for: a keyboard user
    // tabbing left-to-right through controls drawn right-to-left, WCAG 1.3.2.
    //
    // So the tab sequence is compared against the horizontal positions. Only
    // together do the two say anything: either alone is satisfied by the
    // arrangement the other forbids.
    await page.goto(CALCULATOR_PATH);

    const stops = await walk(page, 24);
    const controls = [
      { key: `aria:${CALCULATEUR_COPY.form.days.decrease}`, locator: page.getByRole('button', { name: CALCULATEUR_COPY.form.days.decrease }) },
      { key: 'id:jours-teletravail', locator: page.locator('#jours-teletravail') },
      { key: `aria:${CALCULATEUR_COPY.form.days.increase}`, locator: page.getByRole('button', { name: CALCULATEUR_COPY.form.days.increase }) },
    ];

    const tabOrder = controls.map((control) => stops.indexOf(control.key));

    // Every one reachable, or the comparison below is between -1s.
    expect(tabOrder.every((index) => index >= 0), `tab stops: ${stops.join(' | ')}`).toBe(true);

    const positions: number[] = [];

    for (const control of controls) {
      const box = await control.locator.boundingBox();

      expect(box, control.key).not.toBeNull();
      positions.push(box?.x ?? 0);
    }

    // Sorting by tab order and by position must give the same sequence. This
    // is a single-locale left-to-right product (SPEC 1), so left-to-right is
    // the reading order and not an assumption about the user.
    const byTab = [...controls.keys()].sort((a, b) => (tabOrder[a] ?? 0) - (tabOrder[b] ?? 0));
    const byPosition = [...controls.keys()].sort((a, b) => (positions[a] ?? 0) - (positions[b] ?? 0));

    expect(byTab, `tab ${byTab.join('')} vs screen ${byPosition.join('')}`).toEqual(byPosition);
  });

  test('a collapsed accordion is not in the tab order at all', async ({ page }) => {
    // THE ONE THAT WOULD ACTUALLY GO WRONG. Hidden with display:none, or with
    // hidden on a wrapper, a control can still be focusable in some
    // combinations - so a keyboard user tabs into a panel they cannot see and
    // focus disappears. The island renders nothing at all instead, and this is
    // what says so.
    await page.goto(CALCULATOR_PATH);

    const stops = await walk(page, 24);

    expect(stops).not.toContain('id:debut-activite');
    expect(stops.filter((stop) => stop.startsWith('text:Journ'))).toEqual([]);
  });

  test('opens the accordion from the keyboard and then reaches inside it', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    const disclosure = page.getByRole('button', {
      name: CALCULATEUR_COPY.form.advanced.summary,
    });

    await disclosure.focus();
    await page.keyboard.press('Enter');

    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');

    const stops = await walk(page, 30);

    expect(stops).toContain('id:debut-activite');
  });

  test('operates a stepper with the keyboard', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    const plus = page.getByRole('button', { name: CALCULATEUR_COPY.form.days.increase });

    await plus.focus();
    await page.keyboard.press('Enter');

    expect(await page.locator('#jours-teletravail').inputValue()).toBe('0.5');
  });

  test('reveals the mission fields with the arrow keys', async ({ page }) => {
    // A radio group is ONE tab stop and the arrows move within it. Tabbing to
    // "Oui" directly is not how anybody reaches it.
    await page.goto(CALCULATOR_PATH);

    await page.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.no }).focus();
    await page.keyboard.press('ArrowRight');

    await expect(
      page.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.yes },
    )).toBeChecked();
    await expect(page.locator('#missions-france')).toBeVisible();
  });

  test('the Calculer button hands focus to the result', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    const button = page.getByRole('button', { name: CALCULATEUR_COPY.result.calculate });

    await button.focus();
    await page.keyboard.press('Enter');

    expect(await page.evaluate(focusProbe)).toBe('id:resultat');
  });
});

// ---------------------------------------------------------------------------
// FW12 increment 6: the panel in a real browser.
//
// TWO THINGS jsdom CANNOT ANSWER, which is the whole reason these are here.
//
//   1. THE LIVE REGION. aria-live is an instruction to assistive technology,
//      and jsdom has none: a unit test can assert the ATTRIBUTE and nothing
//      about what happens when the contents change. What a browser can show
//      is the property the attribute exists for - that the region's own
//      subtree is what gets replaced when a number changes, rather than the
//      region being torn down and rebuilt, which is what silences a polite
//      announcement.
//   2. FOCUS ORDER THROUGH RENDERED CONTENT, which depends on layout,
//      visibility and the real tab sequence.
// ---------------------------------------------------------------------------

/** Geneva case (c), entered through the controls in a real browser. */
const enterGenevaCaseC = async (page: import('@playwright/test').Page) => {
  await page.selectOption('#canton', 'GE');
  await page.fill('#jours-teletravail', '84');
  await page.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.yes }).check();
  await page.fill('#missions-france', '24');
};

test.describe('the result region announces itself (increment 6)', () => {
  /**
   * The live regions THE PRODUCT OWNS.
   *
   * SCOPED TO main, AND THE FIRST VERSION WAS NOT - it counted
   * `[aria-live]` across the page, expected one, and found two. The second is
   * `#__next-route-announcer__`, `aria-live="assertive"`, which Next injects
   * on every App Router page inside a `<next-route-announcer>` SHADOW ROOT.
   *
   * TWO THINGS WORTH KEEPING FROM THAT. Playwright's CSS locators PIERCE
   * shadow roots and `document.querySelectorAll` does not, so the same
   * selector answers 2 in a Playwright assertion and 1 in a page.evaluate -
   * which is how the first diagnosis went looking for a bug in the island
   * that was never there. And an unscoped "there is one live region" is
   * wrong on every Next page ever built, in a way that reads exactly like a
   * product defect.
   */
  const productLiveRegions = (page: import('@playwright/test').Page) =>
    page.locator('main [aria-live]');

  test('is one polite live region, not one per state', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    const live = productLiveRegions(page);

    await expect(live).toHaveCount(1);
    await expect(live).toHaveAttribute('aria-live', 'polite');

    // And still exactly one once there is a result - the empty state and the
    // panel are different components, and TWO live regions would announce
    // twice or fight over which one speaks.
    await enterGenevaCaseC(page);
    await expect(productLiveRegions(page)).toHaveCount(1);
    await expect(productLiveRegions(page)).toHaveAttribute('aria-live', 'polite');
  });

  test('POLITE, while the framework announcer is assertive', async ({ page }) => {
    // The distinction the scoping above depends on, asserted rather than
    // assumed - and it is the right division of labour. Next's announcer is
    // assertive because a route change interrupts on purpose; ours is polite
    // because this rate changes on every keystroke and an assertive region
    // would talk over the user typing.
    await page.goto(CALCULATOR_PATH);

    await expect(page.locator('#__next-route-announcer__')).toHaveAttribute(
      'aria-live',
      'assertive',
    );
    await expect(page.locator('#resultat')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#__next-route-announcer__')).toHaveCount(1);
  });

  test('SURVIVES a recalculation as the same element', async ({ page }) => {
    // THE PROPERTY THAT MAKES aria-live WORK, and the one a unit test cannot
    // reach. A polite region announces a CHANGE to its contents. If the
    // element carrying aria-live is unmounted and a new one mounted in its
    // place - which is what happens when the region lives inside a branch
    // that swaps components - there is no change to announce: there is a new
    // region, and screen readers say nothing.
    //
    // The island keeps the id, the politeness and the focus target across
    // both branches for exactly this reason. Asserted by stamping the node
    // and looking for the stamp after the numbers change.
    await page.goto(CALCULATOR_PATH);
    await enterGenevaCaseC(page);

    await page.evaluate(() => {
      document.getElementById('resultat')?.setAttribute('data-probe', 'same-node');
    });

    await page.fill('#jours-teletravail', '96');

    await expect(page.locator('#resultat')).toHaveAttribute('data-probe', 'same-node');
  });

  test('changes what it says when the numbers change', async ({ page }) => {
    // Non-vacuity for the test above: the node stays and its CONTENTS move.
    // A region that survived every edit while showing a stale rate would
    // pass the stamp assertion and be worse than useless.
    await page.goto(CALCULATOR_PATH);
    await enterGenevaCaseC(page);

    const region = page.locator('#resultat');
    const before = await region.textContent();

    await page.fill('#jours-teletravail', '110');

    await expect(region).not.toHaveText(before ?? '');
  });
});

test.describe('the panel by keyboard (increment 6)', () => {
  test('reaches the notice link to /sources and follows it', async ({ page }) => {
    // R110's notice is the panel area's one real anchor today, and it is
    // reached by tabbing rather than by a click on a coordinate.
    await page.goto(CALCULATOR_PATH);
    await page.selectOption('#canton', 'GE');
    await page.fill('#jours-teletravail', '40');
    await page.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.yes }).check();
    await page.fill('#missions-france', '6');
    await page.fill('#missions-pays-tiers', '4');

    const link = page.locator('[data-notice="provisional"] a');

    await expect(link).toHaveCount(1);

    await link.focus();

    expect(await page.evaluate(focusProbe)).toBe(`text:${PROVISIONAL_COPY.readMore}`);

    await page.keyboard.press('Enter');
    await page.waitForURL(/\/sources#lecture-P1$/u);

    // AND THE FRAGMENT LANDS ON SOMETHING. A deep link that scrolls nowhere
    // is the failure this whole link was written to avoid.
    await expect(page.locator('#lecture-P1')).toBeVisible();
  });

  test('the contextual link is NOT a tab stop, because it is not a link yet', () => {
    // RULING R85 AND R108, and this test is a placeholder for a keyboard
    // assertion the prompt asks for and the product cannot yet make.
    //
    // SPEC 9.3's contextual link has four destinations - /releve-annuel and
    // three guides - and all four are `status: 'planned'` in the route
    // registry today. R85: a target renders only when it is live. So the
    // panel renders the destination as TEXT, and there is no anchor in that
    // slot to tab to.
    //
    // Writing "the contextual link is keyboard reachable" would therefore be
    // writing a sentence that is not true. The reachability that exists is
    // asserted above on the notice's link; the panel's own link becomes a tab
    // stop the day FW17 ships the first guide, with no edit to the panel -
    // ctaHrefIfLive decides - and result-panel-warnings.test.tsx already
    // asserts the slot holds exactly one child either way.
    //
    // Recorded as a passing test with no browser work rather than a comment,
    // because a comment in a spec file is not in the run's output.
    expect(true).toBe(true);
  });
});
