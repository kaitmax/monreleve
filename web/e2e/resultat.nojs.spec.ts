// web/e2e/resultat.nojs.spec.ts
//
// R351 / R346: THE CLAIM IS THAT A READER WITH NO JAVASCRIPT GETS AN ANSWER,
// so the test that backs it runs with no JavaScript and reads a REAL FIGURE.
//
// WHY THIS FILE EXISTS AT ALL. calculateur.nojs.spec.ts records the opposite
// result and still does: with scripting off the CALCULATOR shows its empty
// state, because FW13 made that route static on purpose and the island reads
// the URL on mount. Measured on a production build of main before this route
// existed, `?canton=GE&tt=84&mfr=24&decompte=dj` returned 200, carried no
// figure, and showed the same empty state as the bare path. R351 moved the
// answer rather than the calculator: this page computes on the server, and
// the two files together state the whole arrangement.
//
// THE FIGURES ARE TYPED, AND R171 IS WHY THAT IS ALLOWED HERE. Its rule bans
// a literal standing in for a ROLE - the port, the year, the configured
// threshold - and permits one where "the value IS the assertion: a codepoint,
// a published figure, a fixture's expected output". 39,16 % is the Geneva
// fixture's published expected output, named in CLAUDE.md itself, and the
// whole point is that it cannot move without somebody deciding it should.
// Deriving it by calling the engine would assert only that the page agrees
// with whatever the engine currently does, which is the weaker claim.

import { expect, test } from '@playwright/test';
import { CALCULATOR_PATH, RESULT_PATH } from '../lib/content/routes';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { HOME_COPY } from '../lib/fr/home';
import { PARAM_NOTICE } from '../lib/fr/params';

/** The Geneva case (c) scenario, in SPEC 9.4's vocabulary. */
const GENEVA_QUERY = 'canton=GE&tt=84&mfr=24&decompte=dj';
const GENEVA_URL = `${RESULT_PATH}?${GENEVA_QUERY}`;
const NBSP = String.fromCharCode(0x00a0);
const GENEVA_RATE = `39,16${NBSP}%`;

const mainText = async (page: import('@playwright/test').Page): Promise<string> =>
  (await page.locator('main').textContent()) ?? '';

test.describe('R351: the result page answers without JavaScript', () => {
  test('renders the Geneva fixture rate from the URL, on the server', async ({ page }) => {
    // THE ASSERTION THE WHOLE RULING IS FOR. No scripting, so nothing
    // hydrated: a figure in this page was put there by the server.
    const response = await page.goto(GENEVA_URL);

    expect(response?.status()).toBe(200);

    // textContent rather than toContainText: the figure carries U+00A0 before
    // its percent sign (R91) and Playwright's text matchers normalise both
    // sides, so they cannot tell a no-break space from a plain one (R71).
    expect(await mainText(page)).toContain(GENEVA_RATE);
  });

  test('is noindex on every URL, bare and parameterised alike', async ({ page }) => {
    // BOTH, because a header set only on a query would leave the bare path
    // indexable, and one set on neither passes any single-case check (R196).
    for (const url of [RESULT_PATH, GENEVA_URL]) {
      const response = await page.goto(url);

      expect(response?.headers()['x-robots-tag'], url).toBe('noindex, follow');
    }
  });

  test('an address with no figures says so, and shows none', async ({ page }) => {
    await page.goto(RESULT_PATH);

    const main = await mainText(page);

    expect(main).toContain(CALCULATEUR_COPY.resultat.empty);
    expect(main).not.toContain('%');
  });
});

test.describe('R351: the heading states what is underneath it (R176)', () => {
  // FOUND BY DRIVING THE PAGE, not by a failing assertion. Every test in
  // this file passed while the h1 read "Votre part de teletravail" above
  // "Cette adresse ne contient aucun chiffre a calculer" - two correct
  // halves that contradict each other, which is the one defect class a
  // baseline certifies rather than catches.
  const cases = [
    { label: 'nothing to compute', query: '', heading: CALCULATEUR_COPY.resultat.title },
    {
      label: 'the engine refused',
      query: '?canton=GE&tt=400&taux=10',
      heading: CALCULATEUR_COPY.resultat.title,
    },
    {
      label: 'a real answer',
      query: `?${GENEVA_QUERY}`,
      heading: CALCULATEUR_COPY.resultat.heading,
    },
  ];

  for (const { label, query, heading } of cases) {
    test(`says "${heading}" when ${label}`, async ({ page }) => {
      await page.goto(`${RESULT_PATH}${query}`);

      expect((await page.locator('h1').textContent()) ?? '').toBe(heading);
    });
  }

  test('the two headings are different strings, so the branch is not decorative', () => {
    // R133: all three assertions above pass if both constants are equal.
    expect(CALCULATEUR_COPY.resultat.title).not.toBe(CALCULATEUR_COPY.resultat.heading);
  });
});

test.describe('R351: a value that could not be read is NAMED, never dropped quietly', () => {
  test('names the dropped param and still shows the answer it could compute', async ({
    page,
  }) => {
    // MEASURED RED, on the build that preceded this notice: this URL returned
    // 39,16 % - the WHOLE-DAY answer - to a reader who asked for half-days,
    // with no word that `decompte` had been dropped. A browser submits every
    // named control, so this is the shape real submissions take, not a
    // hand-built hostile URL.
    await page.goto(`${RESULT_PATH}?canton=GE&tt=84&mfr=24&decompte=halfDay`);

    const notice = page.locator('[data-notice="params"]');

    await expect(notice).toHaveCount(1);

    const text = (await notice.textContent()) ?? '';

    expect(text).toContain(PARAM_NOTICE.lead);
    expect(text).toContain(PARAM_NOTICE.invalid(['decompte']));

    // ITS OWN LAST LINE, not the calculator's: there are no fields above this
    // notice to correct (R165).
    expect(text).toContain(CALCULATEUR_COPY.resultat.noticeAdvice);
    expect(text).not.toContain('ci-dessus');

    // AND THE RESULT IS STILL THERE. SPEC 9.4: degrade, never blank.
    expect(await mainText(page)).toContain('%');
  });

  test('says nothing when every value was read', async ({ page }) => {
    // The other direction. A notice that rendered unconditionally would pass
    // the test above perfectly (R196), and a reader shown "lien incomplet" on
    // a link that was complete learns to ignore the one that matters.
    await page.goto(GENEVA_URL);

    await expect(page.locator('[data-notice="params"]')).toHaveCount(0);
  });
});

test.describe('R351: the mission question, which only JavaScript can answer fully', () => {
  test('says the missions were not counted, rather than counting zero in silence', async ({
    page,
  }) => {
    // THE DEFECT THIS PREVENTS. The calculator asks about missions OUTSIDE
    // the accordion, because SPEC 9.3 says a user with missions who never
    // opens it gets a silently wrong answer. The two count fields are
    // revealed by the island, so with no scripting a reader can answer "oui"
    // and has nowhere to put the numbers - and the engine computes from zero.
    await page.goto(
      `${RESULT_PATH}?canton=GE&tt=84&missions=${encodeURIComponent(
        CALCULATEUR_COPY.form.missions.yes,
      )}`,
    );

    const note = page.locator('[data-notice="missions"]');

    await expect(note).toHaveCount(1);
    expect((await note.textContent()) ?? '').toBe(CALCULATEUR_COPY.resultat.missionsNotCounted);

    // AND THE ANSWER IT COULD COMPUTE IS STILL THERE.
    expect(await mainText(page)).toContain('%');
  });

  test('says nothing when the mission days did arrive', async ({ page }) => {
    // R225: conditional on the condition. A note that always rendered would
    // be noise on the result of somebody who filled both fields in.
    await page.goto(
      `${RESULT_PATH}?canton=GE&tt=84&mfr=24&missions=${encodeURIComponent(
        CALCULATEUR_COPY.form.missions.yes,
      )}`,
    );

    await expect(page.locator('[data-notice="missions"]')).toHaveCount(0);
  });

  test('never calls the mission question an unused parameter', async ({ page }) => {
    // decode() is RIGHT to report `missions` as a param it does not know -
    // the engine reads the counts, not the question. The notice would be
    // wrong to print it: its sentence is about a tracking parameter somebody
    // else appended, and a reader who just answered that question would be
    // told the calculator ignores it.
    await page.goto(
      `${RESULT_PATH}?canton=GE&tt=84&mfr=24&missions=${encodeURIComponent(
        CALCULATEUR_COPY.form.missions.yes,
      )}`,
    );

    await expect(page.locator('[data-notice="params"]')).toHaveCount(0);
  });

  test('still names a genuinely stray parameter', async ({ page }) => {
    // The other direction (R196). An exemption that swallowed every unknown
    // param would pass the test above perfectly.
    await page.goto(`${RESULT_PATH}?canton=GE&tt=84&utm_source=fb`);

    const notice = page.locator('[data-notice="params"]');

    await expect(notice).toHaveCount(1);
    expect((await notice.textContent()) ?? '').toContain(PARAM_NOTICE.ignored(['utm_source']));
  });
});

const yes = encodeURIComponent(CALCULATEUR_COPY.form.missions.yes);

test.describe('R351: the way back does not carry the form’s own controls', () => {

  test('the back link drops missions, so the calculator does not disown it', async ({
    page,
  }) => {
    // THE SECOND SITE (R267). Filtering `missions` out of THIS page’s notice
    // fixed one surface. The back link handed the raw query to the other:
    // the island decodes whatever it finds on mount, so a reader following
    // "Modifier mes chiffres" arrived at the calculator and was told "ces
    // parametres ne sont pas utilises par le calculateur : missions" about
    // the question they had just answered.
    await page.goto(`${RESULT_PATH}?canton=GE&tt=84&mfr=24&missions=${yes}`);

    const href = await page.getByRole('link', {
      name: CALCULATEUR_COPY.resultat.modify,
    }).getAttribute('href');

    expect(href).not.toBeNull();

    const back = new URL(href ?? '', 'http://localhost');

    expect(back.pathname).toBe(CALCULATOR_PATH);
    expect(back.searchParams.has('missions')).toBe(false);

    // AND IT STILL CARRIES THE SCENARIO. An empty link would satisfy the
    // assertion above perfectly (R154).
    expect(back.searchParams.get('canton')).toBe('GE');
    expect(back.searchParams.get('tt')).toBe('84');
    expect(back.searchParams.get('mfr')).toBe('24');
  });

  // THE OTHER HALF OF THIS PAIR RUNS WITH SCRIPTING ON, and that is not a
  // convenience. The calculator’s link notice is rendered by the island from
  // a mount effect, so with JavaScript off it never renders at all - a test
  // here asserting the calculator does NOT name `missions` would pass
  // against a page that renders no notice under any circumstances, which is
  // an absence assertion satisfied by absence (R169). e2e/resultat.spec.ts
  // drives the same journey in the chromium project, where the island runs.
});
test.describe('R351: a note about a calculation that did not happen', () => {
  test('says nothing about missions when there is no result at all', async ({ page }) => {
    // R225’s condition is that the RESULT raises the question. With no
    // canton there is no result, so the note would sit above "cette adresse
    // ne contient aucun chiffre a calculer" - a sentence about arithmetic
    // nobody did.
    await page.goto(`${RESULT_PATH}?missions=${yes}`);

    await expect(page.locator('[data-notice="missions"]')).toHaveCount(0);
    expect(await mainText(page)).toContain(CALCULATEUR_COPY.resultat.empty);
  });
});

test.describe('R351: the forms reach it', () => {
  test('the home page form submits to the result page and gets a figure', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: HOME_COPY.calculator.submit }).click();

    // THE PATH EXACTLY, AND A QUERY. A RegExp over the whole URL makes every
    // character in the path a pattern - `resultat\?` reads as an optional
    // "t" - so the one thing being asserted is parsed instead.
    const landed = new URL(page.url());

    expect(landed.pathname).toBe(RESULT_PATH);
    expect(landed.search).not.toBe('');

    // A FIGURE, not merely the page. The form's own defaults are a real
    // scenario, so an answer is owed.
    expect(await mainText(page)).toMatch(/\d+,\d+/);
  });

  test('the calculator page form submits to the result page and gets a figure', async ({
    page,
  }) => {
    // The second half of R351. With scripting off the island never hydrates,
    // so the controls in the served HTML are the whole mechanism: they carry
    // SPEC 9.4's names, the submit button is a real submit, and the browser
    // builds the query itself.
    await page.goto(CALCULATOR_PATH);

    await page.getByLabel(CALCULATEUR_COPY.form.canton.label).selectOption('GE');
    await page.getByLabel(CALCULATEUR_COPY.form.days.label).fill('84');
    await page.getByRole('button', { name: CALCULATEUR_COPY.result.calculate }).click();

    // THE PATH EXACTLY, AND A QUERY. A RegExp over the whole URL makes every
    // character in the path a pattern - `resultat\?` reads as an optional
    // "t" - so the one thing being asserted is parsed instead.
    const landed = new URL(page.url());

    expect(landed.pathname).toBe(RESULT_PATH);
    expect(landed.search).not.toBe('');

    const main = await mainText(page);

    expect(main).toMatch(/\d+,\d+/);

    // THE PARAMS IT SENT ARE THE CODEC'S. A control named `decompte` whose
    // value is `halfDay` reaches decode() as unreadable and falls back to
    // whole days - a different answer, silently - so the notice firing here
    // would mean the form is speaking its own vocabulary rather than SPEC
    // 9.4's.
    await expect(page.locator('[data-notice="params"]')).toHaveCount(0);
  });
});
