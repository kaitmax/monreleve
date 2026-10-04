// web/e2e/home.spec.ts
// Smoke coverage for the e2e harness, and the half of FW1 AC1 that only a real
// browser can prove: that Inter is reaching the page with tabular numerals on.

import { expect, test } from '@playwright/test';
import { BASE_URL } from './support/base-url';
import { LAST_REGULATORY_REVIEW, reviewNotice } from '../lib/content/regulatory';
import { HOME_COPY } from '../lib/fr';
import { SHELL_COPY } from '../lib/fr/shell';
import { formatDate } from '../lib/ui/core';
import { currentTaxYear } from '../lib/content/tax-year';
import { guideScope } from '../lib/guides/scope';
import { PRODUCT_STATE } from '../lib/content/product-state';
import { SOURCE_ENTRIES, SOURCE_IDS } from '../lib/content/sources';
import { publishedGuides } from '../lib/guides/registry';
import { presentTenseClaimsIn } from '../tests/support/present-tense';
import { complianceClaims } from '../tests/support/vocabulary';

// FD11's five card-2 topic slugs, in its order (mirrors app/(public)/page.tsx).
const CARD_TWO_TOPICS = [
  'teletravail-frontalier-40-pourcent',
  'seuil-social-49-9-pourcent',
  'jours-de-mission-hors-suisse',
  'attestation-employeur-teletravail',
  'droit-option-lamal-cmu',
];

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** The five card-2 topic labels the page derives, for the served-page checks. */
function cardTwoTopicLabels(): string[] {
  const published = publishedGuides();

  return CARD_TWO_TOPICS.map((slug) => {
    const guide = published.find((one) => one.frontmatter.slug === slug);

    if (guide === undefined) throw new Error(`home.spec: topic slug not published: ${slug}`);

    return lowerFirst(guide.frontmatter.breadcrumbLabel);
  });
}

// innerText may or may not preserve U+00A0 across engines; the figure-delivery
// checks (R154) are about the DIGITS being delivered, not the typography (that
// is copy-codepoints' and R91's job), so both sides are compared with no-break
// spaces flattened to ordinary ones.
const NBSP = String.fromCharCode(0x00a0);
const flat = (text: string): string => text.split(NBSP).join(' ');

/**
 * The server these tests actually hit, which is NOT the origin the build is
 * configured with. The build sets NEXT_PUBLIC_SITE_URL to monreleve.example
 * so the canonicals have something real to assert, so a trace filtered by the
 * METADATA origin calls every request foreign.
 *
 * FROM THE SHARED CONSTANT SINCE R170, not the literal localhost:3000. The
 * port moves, and a hardcoded one here does not fail loudly - it reclassifies
 * our own chunks as third-party requests, which is this file asserting the
 * opposite of what it means. Found on the first run at FRONTALIER_PORT=3100.
 */
const ORIGIN = BASE_URL;

test('/ responds 200 and renders its heading from lib/fr', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);

  // The heading is the PAGE's, not the product name: PublicShell emits no
  // h1 on purpose, so there is exactly one and the page owns it. This
  // assertion used to expect APP_NAME, which was true only while the home
  // page was a placeholder with the product name as its heading.
  // BY textContent, NOT toHaveText - ruling R71, and the heading is now a
  // reason rather than a precaution. FW11's typography pass (R91) put a U+00A0
  // before its question mark, and toHaveText cannot see the difference:
  // MEASURED in a real browser, it matches a matcher containing U+00A0 AND one
  // containing an ordinary space against the same DOM, because it normalises
  // both sides. So it would keep passing on the day the no-break space
  // silently became a space again, which is the only failure worth catching
  // here.
  //
  // textContent keeps the codepoint - also measured - so this compares the
  // exact string, and the constant on the other side carries it too.
  // HOME_COPY.heading IS NOW A FUNCTION of the fiscal ceiling (FW34): it names
  // the threshold ("...reste-t-il avant 40 % ?") and takes it formatted, so this
  // reads the same value the page interpolates rather than a typed figure.
  const { fiscal } = guideScope(currentTaxYear());

  expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(
    HOME_COPY.heading(fiscal),
  );

  // And the codepoint itself, named, so a reader of a failure knows what to
  // look for. U+00A0 is indistinguishable from a space on screen and in a diff.
  expect(HOME_COPY.heading(fiscal)).toContain(String.fromCharCode(0x00a0));
});

test('/ is wrapped in the public shell, header and footer both', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('navigation', { name: SHELL_COPY.navLabel })).toBeAttached();
});

test('the footer carries the recorded review date (R51)', async ({ page }) => {
  // INVERTED AT CHECKPOINT A, 09.09.2026, and deliberately not deleted. R51
  // does not say "the footer says pending" - it says the footer must never
  // claim a verification that has not happened. Before the gate that meant the
  // in-progress sentence and no date; after it, the date and no sentence. The
  // assertion reads the constant, so it cannot drift from it.
  //
  // BY textContent, NOT toContainText. reviewNotice now carries a U+00A0
  // before its colon (the FW11 typography pass), and Playwright normalises
  // whitespace on BOTH sides of its text matchers - measured in a real
  // browser - so toContainText would pass whether the codepoint were there or
  // not. Ruling R71: assert on textContent by codepoint.
  await page.goto('/');

  const footer = (await page.getByRole('contentinfo').textContent()) ?? '';

  expect(LAST_REGULATORY_REVIEW).not.toBeNull();
  expect(footer).toContain(reviewNotice(LAST_REGULATORY_REVIEW));
  expect(footer).toContain(formatDate(LAST_REGULATORY_REVIEW ?? ''));

  // And the sentence it replaced is gone, so the page cannot say both.
  expect(footer).not.toContain(SHELL_COPY.reviewPending);
});

test('exactly one h1 on the page', async ({ page }) => {
  // PublicShell must not add one. Two h1s is the kind of thing that looks
  // fine and quietly breaks a document outline.
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('the Inter subset is actually served and loaded, not just declared', async ({
  page,
}) => {
  // getComputedStyle returns the declared stack whether or not the woff2 ever
  // arrived, so the assertions above pass even if /fonts/ 404s. public/fonts
  // is generated output rebuilt by a script on every clone, so this is the
  // check that would catch it disappearing.
  const responses: { url: string; status: number }[] = [];
  page.on('response', (r) => responses.push({ url: r.url(), status: r.status() }));

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const loaded = await page.evaluate(() => document.fonts.check('1em "Inter Variable"'));
  expect(loaded).toBe(true);

  const font = responses.find((r) => r.url.endsWith('/fonts/inter-latin-wght-normal.woff2'));
  expect(font?.status).toBe(200);
});

test('a public route makes no third-party request and sets no cookie', async ({
  page,
  context,
}) => {
  // SPEC section 17: zero third-party network requests on any web page.
  // SPEC D12: no cookies on public routes. A hostname grep cannot see either,
  // so both are asserted from a real network trace.
  const foreignRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(ORIGIN)) foreignRequests.push(request.url());
  });

  await page.goto('/', { waitUntil: 'networkidle' });

  expect(foreignRequests).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});

// ---------------------------------------------------------------------------
// The OTHER direction of ruling R81, and it is not optional: a guard that
// always refused would pass every assertion in guard.runtime.spec.ts. This
// suite runs WITHOUT FRONTALIER_RUNTIME, which is the ordinary case, so it is
// where "the guard stays quiet" can be proved for free.
// ---------------------------------------------------------------------------

test('/sitemap.xml is served normally when the process is not marked as serving', async ({
  request,
}) => {
  const response = await request.get('/sitemap.xml');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('xml');

  const body = await response.text();

  expect(body).toContain('<urlset');
  expect(body).toContain('<loc>');
});

test('/api/health reports ok when the process is not marked as serving', async ({ request }) => {
  const response = await request.get('/api/health');
  const body = (await response.json()) as { status: string; reasons: string[]; runtime: boolean };

  expect(response.status()).toBe(200);
  expect(body.status).toBe('ok');
  expect(body.reasons).toEqual([]);
  expect(body.runtime).toBe(false);
});

test('/api/ready is 200 and ready when the process is not marked as serving', async ({
  request,
}) => {
  // The counter-direction for ruling R83. Readiness must NOT fail in a local
  // build or in CI - that is the same mistake the NODE_ENV guard made, one
  // endpoint over, and it would block the pipeline for a condition that
  // publishes nothing.
  const response = await request.get('/api/ready');
  const body = (await response.json()) as { ready: boolean; checks: { ok: boolean }[] };

  expect(response.status()).toBe(200);
  expect(body.ready).toBe(true);
  expect(body.checks.every((check) => check.ok)).toBe(true);
});

test('the meta description delivers both thresholds, formatted (R147, R154)', async ({ page }) => {
  // FW18b MADE THE DESCRIPTION A FUNCTION, because R147 now reaches lib/fr
  // and it used to type "40 %" and "49,9 %". A function that returned its
  // sentence with the interpolations empty would still be a valid meta tag,
  // still parse, still pass every other assertion on this page, and the
  // snippet in every search result would read "avant les seuils de  et ".
  //
  // That is exactly the shape R154 exists for, so the assertion is against
  // the VALUES - taken from the engine, not from the copy module - rather
  // than against the sentence the copy module would produce.
  await page.goto('/');

  const description = await page
    .locator('meta[name="description"]')
    .getAttribute('content');

  const { fiscal, social } = guideScope(currentTaxYear());

  expect(description, 'the fiscal ceiling').toContain(fiscal);
  expect(description, 'the social ceiling').toContain(social);

  // AND THE FIGURES ARE REAL ONES, so a scope returning two empty strings
  // cannot satisfy the two assertions above by making them vacuous.
  expect(fiscal).toMatch(/\d/u);
  expect(social).toMatch(/\d/u);

  // The sentence around them is still the copy module's, and that it survived
  // is worth one assertion.
  expect(description).toContain('Calculez votre part de télétravail annuelle');
});

// ---------------------------------------------------------------------------
// FW34: the home body, served.
// ---------------------------------------------------------------------------

test('card 3 makes no present-tense claim about an unreleased app (R138, §7.2 item 3)', async ({
  page,
}) => {
  // The precondition: the app does not exist, so card 3 must be in the future.
  // If this fails, the app shipped and the card needs re-reading, not the test.
  expect(
    PRODUCT_STATE.appExists,
    'appExists is true: card 3 is now present tense and this check is stale',
  ).toBe(false);

  await page.goto('/');

  const cards = await page.locator('[data-band="cards"]').innerText();

  // Presence before the absence assertion (R169's corollary): card 3's body is
  // actually on the page.
  expect(cards).toContain('En préparation pour Android');

  expect(presentTenseClaimsIn(cards)).toEqual([]);

  // The detector is not merely decorative: a known present form fires.
  expect(
    presentTenseClaimsIn('Un geste par jour, et la journée est enregistrée.').length,
  ).toBeGreaterThan(0);
});

test('the home page makes no compliance claim SPEC 20 forbids (§7.2 item 4)', async ({ page }) => {
  await page.goto('/');

  const main = await page.locator('main').innerText();

  // Presence: the page rendered real prose before we assert an absence.
  expect(main).toContain('Calculer mes jours');

  expect(complianceClaims(main)).toEqual([]);

  // Non-vacuity: the detector fires on a real forbidden claim.
  expect(complianceClaims('Vos journées sont certifiées conformes.').length).toBeGreaterThan(0);
});

test('every threshold, count and figure is delivered into the page (R154, §7.2 item 5)', async ({
  page,
}) => {
  await page.goto('/');

  const { fiscal, social, a1Threshold } = guideScope(currentTaxYear());

  // Every figure is a real one, so none of the toContain checks is vacuous.
  for (const figure of [fiscal, social, a1Threshold]) expect(figure).toMatch(/\d/u);

  // H1 and the hero lead.
  const hero = flat(await page.locator('[data-band="hero"]').innerText());
  const h1 = flat((await page.locator('h1').textContent()) ?? '');
  expect(h1).toContain(flat(fiscal));
  expect(hero).toContain(flat(fiscal));
  expect(hero).toContain(flat(social));
  expect(hero).toContain(flat(a1Threshold));

  // Cards: card 1's two thresholds, card 2's count word and five topics.
  const cards = await page.locator('[data-band="cards"]').innerText();
  const cardsFlat = flat(cards);
  expect(cardsFlat).toContain(flat(fiscal));
  expect(cardsFlat).toContain(flat(social));
  expect(cards).toContain('Sept'); // publishedGuides().length is 7 today
  for (const topic of cardTwoTopicLabels()) expect(cards).toContain(topic);

  // Trust band: the date, the publishers, the three counts.
  const trust = await page.locator('[data-band="trust"]').innerText();
  expect(trust).toContain(formatDate(LAST_REGULATORY_REVIEW ?? ''));
  for (const publisher of new Set(SOURCE_ENTRIES.map((entry) => entry.sourceName))) {
    expect(trust).toContain(publisher);
  }
  const transcribed = SOURCE_ENTRIES.filter((entry) => entry.status === 'transcribed').length;
  const pending = SOURCE_ENTRIES.filter((entry) => entry.status === 'pending').length;
  expect(trust).toContain(`${transcribed} des ${SOURCE_IDS.length}`);
  expect(trust).toContain(`${pending} restent`);
});

test('the buttons meet D40, per band (§7.2 item 10)', async ({ page }) => {
  await page.goto('/');

  const heightOf = async (selector: string): Promise<number> =>
    (await page.locator(selector).first().boundingBox())?.height ?? 0;

  expect(await heightOf('[data-band="hero"] a[data-variant="primaryLarge"]')).toBeGreaterThanOrEqual(
    55,
  );
  expect(await heightOf('[data-band="hero"] a[data-variant="secondary"]')).toBeGreaterThanOrEqual(
    47,
  );
  expect(await heightOf('[data-band="closing"] a[data-variant="primary"]')).toBeGreaterThanOrEqual(
    47,
  );

  const textLinks = page.locator('a[data-variant="text"]');
  const count = await textLinks.count();

  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await textLinks.nth(index).boundingBox();

    expect(box?.height ?? 0, `text link ${index} is below 44 px (D40)`).toBeGreaterThanOrEqual(43.5);
  }
});

test('every body link is registered, live and answers 200 (R175, §7.2 item 11)', async ({
  page,
  request,
}) => {
  await page.goto('/');

  const hrefs = await page
    .locator('main a[href]')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));

  // The non-vacuity floor: hero 2, cards 3, trust 3, closing 1.
  expect(hrefs.length).toBeGreaterThanOrEqual(9);

  for (const href of hrefs) {
    expect(href.startsWith('/'), `${href} is not an internal route`).toBe(true);
  }

  for (const href of new Set(hrefs)) {
    const response = await request.get(href);

    expect(response.status(), `${href} should answer 200`).toBe(200);
  }
});

test.describe('below the breakpoint', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('the hero actions stack full width, the cards and trust columns are one column (§7.2 item 12)', async ({
    page,
  }) => {
    await page.goto('/');

    // Hero actions: two buttons, same left edge, stacked, each near full width.
    const heroButtons = page.locator('[data-band="hero"] a');

    expect(await heroButtons.count()).toBe(2);

    const first = await heroButtons.nth(0).boundingBox();
    const second = await heroButtons.nth(1).boundingBox();

    expect(first && second).toBeTruthy();
    expect(Math.abs((first?.x ?? 0) - (second?.x ?? 0))).toBeLessThan(2);
    expect(second?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + 10);
    expect(Math.abs((first?.width ?? 0) - (second?.width ?? 0))).toBeLessThan(2);
    expect(first?.width ?? 0).toBeGreaterThan(200);

    // Cards: three titles, all at the same x => one column.
    const cardTitles = page.locator('[data-band="cards"] h3');

    expect(await cardTitles.count()).toBe(3);

    const cardXs = await cardTitles.evaluateAll((titles) =>
      titles.map((title) => Math.round(title.getBoundingClientRect().x)),
    );

    expect(new Set(cardXs).size).toBe(1);

    // Trust: three columns stacked, with HORIZONTAL rules (top border, no left).
    const columns = await page.evaluate(() => {
      const band = document.querySelector('[data-band="trust"]');
      const eyebrows = Array.from(band?.querySelectorAll('h3') ?? []);

      return eyebrows.map((eyebrow) => {
        const column = eyebrow.parentElement as Element;
        const style = getComputedStyle(column);

        return {
          top: Number.parseFloat(style.borderTopWidth),
          left: Number.parseFloat(style.borderLeftWidth),
          x: Math.round(column.getBoundingClientRect().x),
        };
      });
    });

    expect(columns.length).toBe(3);
    expect(new Set(columns.map((column) => column.x)).size).toBe(1);
    expect(columns[1]?.top ?? 0).toBeGreaterThan(0);
    expect(columns[1]?.left ?? 0).toBe(0);
    expect(columns[2]?.top ?? 0).toBeGreaterThan(0);
  });
});
