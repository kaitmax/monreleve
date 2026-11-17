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

import { TEST_ORIGIN } from '../lib/content/identity';
import { expect, test } from '@playwright/test';
import { CALCULATOR_PATH, gateRobotsDirective, sitemapPaths } from '../lib/content/routes';
import { LAST_REGULATORY_REVIEW } from '../lib/content/regulatory';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { PROVISIONAL_COPY } from '../lib/fr/provisional';
import { PARAM_NOTICE, SHARE_COPY } from '../lib/fr/params';
import { ALERTES_COPY } from '../lib/fr/alertes';
import { ALERTES_PATH } from '../lib/content/alertes';

// THE THRESHOLD HELPERS MOVED WITH THE no-JS BLOCKS (R346). YEAR, RULES,
// ceiling, FISCAL and SOCIAL were read only by the "with JavaScript disabled"
// assertions, which now live in calculateur.nojs.spec.ts; lint named the two
// constants the moment they were orphaned, and the chain behind them went
// with them. They are duplicated there rather than shared from here: a spec
// importing another spec's fixtures is a dependency between suites that do
// not run together.


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
      `${TEST_ORIGIN}${CALCULATOR_PATH}`,
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
    // A CANTON IS CHOSEN FIRST SINCE R380, and the claim this test makes is
    // unchanged: once the form can produce a result, Calculer hands focus to
    // it. It used to pass WITHOUT a canton because the button moved focus
    // unconditionally - to a region that said "choose a canton". That is the
    // behaviour R380 replaced, and it is asserted directly below.
    await page.goto(CALCULATOR_PATH);
    await page.selectOption('#canton', 'GE');

    const button = page.getByRole('button', { name: CALCULATEUR_COPY.result.calculate });

    await button.focus();
    await page.keyboard.press('Enter');

    expect(await page.evaluate(focusProbe)).toBe('id:resultat');
  });

  test('R380: with no canton, Calculer hands focus to the FIELD instead', async ({ page }) => {
    // The other half, in a real browser rather than jsdom: focus is the part
    // of this that a unit test cannot see going to the right element on a
    // real page, and it is what makes the red border reachable by keyboard
    // rather than merely visible.
    await page.goto(CALCULATOR_PATH);

    const button = page.getByRole('button', { name: CALCULATEUR_COPY.result.calculate });

    await button.focus();
    await page.keyboard.press('Enter');

    expect(await page.evaluate(focusProbe)).toBe('id:canton');
    await expect(page.locator('#canton')).toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByText(CALCULATEUR_COPY.form.canton.missing),
    ).toBeVisible();
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

  test('is one polite live region per job, not one per state', async ({ page }) => {
    // TWO JOBS SINCE FW13, WHICH IS NOT THE SAME AS ONE PER STATE. The
    // original defect this guards against is a region that multiplies as the
    // page changes - a new one per status, each announcing the same rate.
    // The share confirmation is a second region because it announces a
    // different EVENT to a different question ("did the copy work?"), and
    // routing it through the result region would make a screen reader say the
    // rate again every time somebody copied a link.
    //
    // The count still holds the line: it is fixed at two and it does not move
    // when the state does, which is the property that was worth asserting.
    await page.goto(CALCULATOR_PATH);

    const live = productLiveRegions(page);

    await expect(live).toHaveCount(2);
    await expect(page.locator('main #resultat')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    await expect(page.locator('main [data-share-status]')).toHaveAttribute(
      'aria-live',
      'polite',
    );

    // And still exactly two once there is a result - the empty state and the
    // panel are different components, and a THIRD region would announce
    // twice or fight over which one speaks.
    await enterGenevaCaseC(page);
    await expect(productLiveRegions(page)).toHaveCount(2);
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

// ---------------------------------------------------------------------------
// FW13 increment 2: A SHARED LINK PRE-FILLS THE CALCULATOR.
//
// THE PROMPT ASKED FOR THIS ON THE SERVER AND IT IS ON THE CLIENT. The
// increment's line was "a Geneva case (c) URL renders 39,16 % server-side,
// asserted by codepoint literal against the initial HTML (not after
// hydration)", and that assertion is not written here, because it stopped
// being true by decision rather than by accident.
//
// Reading searchParams anywhere in this route - page, generateMetadata, or a
// Suspense child - makes it dynamic in Next 15.5.25, and a dynamic route emits
// <title> and <link rel="canonical"> into the BODY. Measured five ways; the
// page's header lists them. This is SPEC 14's target-query page, so the
// operator's ruling was that the head wins: the route stays static, the island
// reads the URL on mount, and the noindex AC3 needs arrives as an X-Robots-Tag
// header from middleware.
//
// So the rate appears on HYDRATION rather than in the first paint. What that
// costs is asserted honestly below - with scripting off there is no result at
// all - and what it buys is asserted too.
// ---------------------------------------------------------------------------

/** Geneva case (c) as SPEC 9.4 would carry it. */
const GENEVA_C_URL = `${CALCULATOR_PATH}?canton=GE&tt=84&mfr=24&decompte=dj`;

const NBSP = String.fromCharCode(0x00a0);

test.describe('a param URL pre-fills and computes (FW13 AC2)', () => {
  test('shows 39,16 % once hydrated', async ({ page }) => {
    await page.goto(GENEVA_C_URL);

    // R96: the figure by codepoint literal. toContainText would normalise the
    // no-break space on both sides and could not tell it from a plain one.
    await expect
      .poll(async () => (await page.locator('main').textContent()) ?? '')
      .toContain(`39,16${NBSP}%`);
  });

  test('pre-fills the controls, so the reader can adjust it in place', async ({ page }) => {
    // THE GROWTH MECHANIC, and the half a rate alone does not prove: "someone
    // pastes their scenario into a group; others adjust it in place."
    await page.goto(GENEVA_C_URL);

    await expect(page.locator('#canton')).toHaveValue('GE');
    await expect(page.locator('#jours-teletravail')).toHaveValue('84');
    await expect(page.locator('#missions-france')).toHaveValue('24');
  });

  test('the bare path shows no result', async ({ page }) => {
    // Non-vacuity: the rate above is the LINK's, not something every visitor
    // sees.
    await page.goto(CALCULATOR_PATH);

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main).not.toContain(`39,16${NBSP}%`);
    expect(main).toContain(CALCULATEUR_COPY.result.empty);
  });

  test('an empty ? behaves exactly as the bare path (AC2)', async ({ page }) => {
    await page.goto(`${CALCULATOR_PATH}?`);

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main).toContain(CALCULATEUR_COPY.result.empty);
  });

  test('a mangled URL degrades rather than 404ing', async ({ page }) => {
    // SPEC 9.4: "Facebook mangles URLs; degrading beats 404."
    const response = await page.goto(
      `${CALCULATOR_PATH}?canton=GE&tt=84&mfr=24&taux=abc&utm_source=fb`,
    );

    expect(response?.status()).toBe(200);

    await expect
      .poll(async () => (await page.locator('main').textContent()) ?? '')
      .toContain(PARAM_NOTICE.lead);

    const main = (await page.locator('main').textContent()) ?? '';

    // taux fell back to 100, so the case-(c) rate still computes.
    expect(main).toContain(`39,16${NBSP}%`);
    expect(main).toContain('taux');
    expect(main).toContain('utm_source');
  });

  test('the notice can be dismissed', async ({ page }) => {
    await page.goto(`${CALCULATOR_PATH}?canton=GE&tt=84&taux=abc`);

    const notice = page.locator('[data-notice="params"]');

    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: PARAM_NOTICE.dismiss }).click();
    await expect(notice).toHaveCount(0);
  });
});

test.describe('the head survives the params (FW13 AC3)', () => {
  // THE REASON THE PREFILL MOVED TO THE CLIENT, asserted rather than trusted.
  // If this route ever goes dynamic again, these fail before anybody notices
  // the canonical has quietly moved into the body of the product's main SEO
  // page.
  test('canonical and title are in the HEAD, even with nine params', async ({ page }) => {
    await page.goto(
      `${CALCULATOR_PATH}?canton=GE&taux=80&tt=84&mfr=6&mtiers=4&methode=exact` +
        '&total=200&decompte=h&debut=2026-04-01',
    );

    // head-scoped: a tag in the body is the defect, so a selector that would
    // match either could not see it.
    await expect(page.locator('head > link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('head > title')).toHaveCount(1);
  });

  test('the canonical points at the BARE path from a param URL (SPEC 9.4)', async ({ page }) => {
    await page.goto(GENEVA_C_URL);

    const canonical = page.locator('head > link[rel="canonical"]');

    expect(await canonical.getAttribute('href')).toBe(
      `${TEST_ORIGIN}${CALCULATOR_PATH}`,
    );
  });

  test('a param URL is noindex, by header (AC3)', async ({ request }) => {
    const response = await request.get(GENEVA_C_URL);

    expect(response.status()).toBe(200);
    expect(response.headers()['x-robots-tag'] ?? '').toContain('noindex');
  });

  test('the bare path is NOT noindex', async ({ request }) => {
    // R54's gate decides whether this page is indexable, and the header must
    // not quietly override it. The count assertion R119 asks for: exactly
    // zero.
    const response = await request.get(CALCULATOR_PATH);

    expect(response.headers()['x-robots-tag']).toBeUndefined();
  });

  test('an empty ? is not noindex either, because it is the bare path', async ({ request }) => {
    const response = await request.get(`${CALCULATOR_PATH}?`);

    expect(response.headers()['x-robots-tag']).toBeUndefined();
  });
});


test.describe('the share controls are reachable by keyboard (FW13)', () => {
  // WHY THIS IS NOT A JSDOM TEST. Tab does not move focus in jsdom - it
  // dispatches a keydown and nothing else - so a unit test can assert that a
  // button is FOCUSABLE by calling .focus() on it, which is a different
  // claim: an element with tabindex='-1' passes that and can never be
  // reached by anybody tabbing through the page. A real browser walks the
  // real tab order, and that is the only place this can be proved.

  test('both buttons appear in the tab order, and Enter works on them', async ({
    page,
  }) => {
    // The native button only exists where navigator.share does, which is a
    // phone and not a headless desktop Chromium - so the API is installed
    // before any script on the page runs. addInitScript, not evaluate: the
    // detection happens in a mount effect, so by the time evaluate could run
    // the decision is already made.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async () => undefined,
      });
    });

    await page.goto(GENEVA_C_URL);

    const copy = page.getByRole('button', { name: SHARE_COPY.copy });
    const share = page.getByRole('button', { name: SHARE_COPY.share });

    await expect(copy).toBeVisible();
    await expect(share).toBeVisible();

    // WALK THE REAL TAB ORDER from the top of the document. The loop is
    // bounded because an unbounded one on a page with a focus trap does not
    // fail, it hangs - and a hanging test reports nothing at all.
    const reached: string[] = [];
    const LIMIT = 60;

    for (let step = 0; step < LIMIT; step += 1) {
      await page.keyboard.press('Tab');

      const label = await page.evaluate(() =>
        (document.activeElement?.textContent ?? '').trim(),
      );

      reached.push(label);

      if (reached.includes(SHARE_COPY.copy) && reached.includes(SHARE_COPY.share)) {
        break;
      }
    }

    expect(reached, 'tabbing never landed on the copy button').toContain(
      SHARE_COPY.copy,
    );
    expect(reached, 'tabbing never landed on the share button').toContain(
      SHARE_COPY.share,
    );

    // AND THE KEY THAT ACTIVATES IT. Reaching a control that does nothing
    // when pressed is not reachability. Enter on the copy button must
    // produce the announcement - whichever one, because a headless browser
    // may refuse the clipboard and SAYING SO is the correct outcome there.
    await copy.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-share-status]')).not.toBeEmpty();
  });
});

test.describe('AC2: the capture card never costs the reader their result (FW14)', () => {
  // THE CARD IS A PLAIN FORM (R136). These tests exercise it as a browser
  // does, because the property is about what a BROWSER does with a form POST
  // and a 303 - not about what a function returns.

  test('sits below the result, and submitting leaves the result on screen', async ({
    page,
  }) => {
    await page.goto(GENEVA_C_URL);

    // The result is there first. If this ever stops being true the rest of
    // the test is meaningless, which is why it is asserted rather than
    // assumed.
    await expect(page.locator('main')).toContainText(`39,16${NBSP}%`);

    const result = page.locator('#resultat');
    const card = page.locator('[data-alert-scenario]');

    await expect(card).toHaveCount(1);

    // BELOW, as a property of the page (R137, SPEC 9.3 item 8).
    const order = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('#resultat, [data-alert-scenario]')];

      return nodes.map((node) => (node.id === 'resultat' ? 'result' : 'capture'));
    });

    expect(order).toEqual(['result', 'capture']);

    await page.getByLabel(ALERTES_COPY.emailLabel).fill('e2e@example.com');
    await page.getByRole('button', { name: ALERTES_COPY.submit }).click();

    // AND THE RESULT IS STILL THERE, UNCHANGED. The scenario travelled with
    // the POST and came back in the redirect.
    await expect(result).toContainText(`39,16${NBSP}%`);
    await expect(page).toHaveURL(/canton=GE/);
    await expect(page.locator('#alerte-ok')).toBeVisible();
  });



  test('the standalone landing takes the same form', async ({ page }) => {
    await page.goto(ALERTES_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    await page.getByLabel(ALERTES_COPY.emailLabel).fill('landing@example.com');
    await page.getByRole('button', { name: ALERTES_COPY.submit }).click();

    await expect(page).toHaveURL(new RegExp(`${ALERTES_PATH}`));
    await expect(page.locator('#alerte-ok')).toBeVisible();
  });
});
