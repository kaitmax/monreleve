// web/e2e/routing.spec.ts
//
// The routing contract: robots, the sitemap, one URL per page, and a
// self-referencing canonical on every public route.
//
// EVERY ASSERTION HERE NEEDS A SERVER, which is why none of them is a unit
// test. lib/content/routes.ts has unit coverage for the registry's SHAPE - who
// is live, what robots keeps out, that the shell's hrefs are all declared. It
// cannot answer whether Next actually serves robots.txt at that path, whether
// the slashed form of a URL really redirects, or whether a canonical tag
// reaches the rendered head. Those are integration facts.
//
// THE ORIGIN IS https://frontalier.example, set by playwright.config.ts. Under
// ruling R81 a build with no configured origin omits canonicals entirely, so a
// suite that did not supply one could not prove they work. .example is
// reserved by RFC 2606 and can never resolve, so it cannot be mistaken for the
// real domain - which is still an open question.

import { expect, test } from '@playwright/test';
import { NON_INDEXED, PUBLIC_ROUTES, liveRoutes } from '../lib/content/routes';
import { complianceClaims } from '../tests/support/vocabulary';

const ORIGIN = 'https://frontalier.example';

test.describe('robots.txt', () => {
  test('allows the site and keeps out the three prefixes R53 names', async ({ request }) => {
    const response = await request.get('/robots.txt');

    expect(response.status()).toBe(200);

    const body = await response.text();

    expect(body).toContain('Allow: /');
    for (const prefix of NON_INDEXED) {
      expect(body, prefix).toContain(`Disallow: ${prefix}`);
    }
  });

  test('does not mention the withdrawn signed-in routes (D14, R53)', async ({ request }) => {
    // SPEC 14 still lists /app/, /connexion and /inscription. D14 deleted the
    // signed-in web area, so disallowing them would be a robots file
    // describing a site that does not exist.
    const body = await request.get('/robots.txt').then((r) => r.text());

    for (const withdrawn of ['/app/', '/connexion', '/inscription']) {
      expect(body, withdrawn).not.toContain(withdrawn);
    }
  });

  test('points at the sitemap with an absolute URL', async ({ request }) => {
    // A relative sitemap path in robots.txt is ignored by crawlers, so this is
    // the one place the configured origin has to appear in plain text.
    const body = await request.get('/robots.txt').then((r) => r.text());

    expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
});

test.describe('sitemap.xml', () => {
  test('lists exactly the live routes, absolute, on the configured origin', async ({ request }) => {
    const response = await request.get('/sitemap.xml');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('xml');

    const body = await response.text();
    const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();

    expect(locations).toEqual(liveRoutes().map((route) => `${ORIGIN}${route.path}`).sort());
  });

  test('lists no planned route, because a sitemap of 404s is a claim', async ({ request }) => {
    const body = await request.get('/sitemap.xml').then((r) => r.text());
    const planned = PUBLIC_ROUTES.filter((route) => route.status === 'planned');

    // NON-VACUOUS, AND NAMED RATHER THAN COUNTED. This was
    // toBeGreaterThan(5) in two files - here and in
    // tests/unit/content/routes.test.ts - and FW18b's flip of
    // /guides/droit-option-lamal-cmu to live took the count from six to five
    // and turned both red. The unit copy was found first and fixed; this one
    // was found by the gate, four minutes into test:e2e, which is the reason
    // R132 selects e2e from the diff rather than from judgement.
    //
    // A floor that has to be lowered every time a page ships gets lowered
    // until it guards nothing. The set says which five, so shipping one is an
    // edit that names it.
    expect(planned.map((route) => route.path).sort()).toEqual([
      // FW20 took /a-propos out of this list; it is a live page now.
      '/application',
      '/calculateur-lamal-cmu',
    ]);

    for (const route of planned) {
      expect(body, route.path).not.toContain(`<loc>${ORIGIN}${route.path}</loc>`);
    }
  });

  test('every listed URL actually answers 200', async ({ request }) => {
    // The assertion that makes "live" mean something. The registry's status
    // field is hand-maintained, and this is what stops it drifting into a
    // sitemap that promises a page nobody built.
    const body = await request.get('/sitemap.xml').then((r) => r.text());
    const paths = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
      (match[1] ?? '').slice(ORIGIN.length),
    );

    expect(paths.length).toBeGreaterThanOrEqual(4);

    for (const path of paths) {
      const page = await request.get(path);

      expect(page.status(), `${path} is in the sitemap`).toBe(200);
    }
  });
});

test.describe('one URL per page', () => {
  test('the slashed form redirects permanently to the bare one', async ({ request }) => {
    const response = await request.get('/cgu/', { maxRedirects: 0 });

    // 308, not 301. Next emits 308 for slash normalisation, `permanent: true`
    // in a redirects() rule emits 308 as well, and search engines treat the
    // two identically - 308 additionally preserves the request method. A
    // literal 301 would have to come from the reverse proxy. The prompt says
    // 301; this accepts either and the report records the deviation.
    expect([301, 308]).toContain(response.status());
    expect(response.headers()['location']).toBe('/cgu');
  });

  test('the bare form serves, so the redirect is not a loop', async ({ request }) => {
    // The other direction, and the failure it catches is real: a
    // misconfiguration that redirects both ways answers every assertion above
    // and serves nothing.
    const response = await request.get('/cgu');

    expect(response.status()).toBe(200);
  });

  test('following the slashed form lands on the bare URL', async ({ page }) => {
    await page.goto('/mentions-legales/');

    expect(new URL(page.url()).pathname).toBe('/mentions-legales');
  });
});

/**
 * What the canonical for a path should read.
 *
 * THE ROOT IS THE BARE ORIGIN, with no trailing slash. Next resolves the
 * layout's relative `canonical: './'` that way, and it is not a defect: RFC
 * 3986 section 6.2.3 makes an empty path equivalent to "/", so
 * https://frontalier.example and https://frontalier.example/ are the same URL
 * and every crawler normalises them together. The sitemap writes the slashed
 * form because that is the conventional shape of a <loc>; the two therefore
 * differ by one character on one route and mean the same thing. Recorded here
 * rather than papered over by adding per-page canonical machinery, which would
 * put every path in two places.
 */
function canonicalFor(path: string): string {
  return path === '/' ? ORIGIN : `${ORIGIN}${path}`;
}

test.describe('canonical and hreflang on every public page', () => {
  for (const route of liveRoutes()) {
    test(`${route.path} carries a self-referencing canonical and fr-FR`, async ({ page }) => {
      await page.goto(route.path);

      // SCOPED TO head, AND THAT SCOPING IS THE ASSERTION. The unscoped
      // version of this line passed for the calculator while its canonical sat
      // in the BODY: Next streams the head of a dynamically rendered route and
      // emitted the metadata after the closing head tag - measured on a
      // production build at byte 7921 against a </head> at byte 1115. Google
      // ignores rel=canonical outside <head>, so the tag was present, correct,
      // and discarded.
      //
      // A canonical that is silently ignored is worse than an absent one: it
      // reads as done in every review of the source. The page is statically
      // rendered now (see its revalidate export) and this is the line that
      // keeps it that way.
      const canonical = page.locator('head > link[rel="canonical"]');

      await expect(canonical).toHaveCount(1);
      expect(await canonical.getAttribute('href')).toBe(canonicalFor(route.path));

      // SPEC 14: hreflang="fr-FR", self-referencing. One locale by design, so
      // this is a statement about the language rather than a switcher.
      // head-scoped for the same reason as the canonical above.
      const alternate = page.locator('head > link[rel="alternate"][hreflang="fr-FR"]');

      await expect(alternate).toHaveCount(1);
      expect(await alternate.getAttribute('href')).toBe(canonicalFor(route.path));
    });
  }

  test('the 404 carries no canonical', async ({ page }) => {
    // A canonical on an error page tells a crawler the URL is legitimate,
    // which is the opposite of what a 404 means.
    await page.goto('/cette-page-nexiste-pas');

    // Deliberately UNSCOPED here, and the asymmetry is intentional: the
    // assertion is that no canonical exists anywhere in the document, which is
    // strictly stronger than none in the head.
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// RULING R95: the vocabulary check reads METADATA too - title, description, OG
// fields - not just rendered text. "Conforme au RGPD in a meta description is
// a certification claim to a crawler."
//
// HOW THIS RULING CAME ABOUT, since it is worth not repeating: FW10 probed the
// existing check by putting exactly that string into a meta description and
// expected it to go red. It stayed green. The check read the DOM, and a meta
// description is not in the DOM - it is the string a search engine quotes back
// to a reader, which is arguably the worst place of the three to claim
// compliance.
//
// THE HEAD, NOT THE METADATA OBJECTS. Asserting on lib/fr constants would miss
// anything Next assembles - a title composed through the layout's template, an
// og:description derived from a description, a JSON-LD block (FW15). Reading
// the rendered head catches all of it whatever produced it, which is the only
// version of this check that stays true as more metadata arrives.
// ---------------------------------------------------------------------------

// THE SHARED GUARD, and it replaced a substring list that was wrong. That
// list banned 'certifi' outright and so failed the calculator's explanatory
// copy for saying "un certificat A1 en cours de validite" - the name of a
// document SPEC 7.1 itself uses. 'attest' would likewise have forbidden
// SPEC 9.5's launch guide at /guides/attestation-employeur-teletravail.
//
// tests/support/vocabulary.ts separates the CLAIM from the document noun and
// carries its own two-directional test.

test.describe('SPEC section 20 vocabulary, in the head as well as the body', () => {
  for (const route of liveRoutes()) {
    test(`${route.path} claims no certification in its metadata`, async ({ page }) => {
      await page.goto(route.path);

      // WAIT FOR THE TITLE BEFORE READING THE HEAD. Next STREAMS the head of a
      // dynamically rendered route, so innerHTML() taken straight after goto()
      // can return the first chunk only - stylesheets, scripts, the icon - and
      // none of the metadata this test exists to judge. It happened: the
      // calculator failed here under a loaded parallel run and passed when run
      // alone, which is the shape of a race rather than a defect.
      //
      // toHaveCount auto-retries, so this waits rather than sleeping. And the
      // non-vacuity assertion below is what caught the race in the first
      // place: without it the scan would have run over an empty string and
      // reported no claims, which is a false pass.
      await expect(page.locator('head > title')).toHaveCount(1);

      const head = (await page.locator('head').innerHTML()).toLowerCase();

      // Non-vacuous: the head must actually contain the metadata being judged.
      expect(head).toContain('<title>');

      const claims = complianceClaims(head);

      expect(claims, `${route.path} head claims: ${claims.join(', ')}`).toEqual([]);
    });
  }

  test('and the same words are absent from the rendered body', async ({ page }) => {
    // The half that already existed, kept here so the pair is visible in one
    // place: declare, enregistre, horodate - never certifie, atteste, conforme.
    await page.goto('/cgu');

    const body = (await page.locator('body').innerText()).toLowerCase();
    const claims = complianceClaims(body);

    expect(claims, `/cgu body claims: ${claims.join(', ')}`).toEqual([]);
  });
});
