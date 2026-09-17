// web/e2e/analytics.spec.ts
//
// THE TEST THAT HOLDS THE PRIVACY PAGE'S ANALYTICS SENTENCE.
//
// /confidentialite says "Le site ne mesure pas encore son audience" - present
// tense, about today, and therefore a claim that needs a test rather than a
// promise that needs a date. Ruling R138 exists because that sentence was
// once in the present tense describing analytics that did not exist; FW14
// corrected the tense and could not map it to a test, because there was no
// code to test. This is the map: not code that measures, but an assertion
// that nothing does.
//
// WHY IT IS WORTH ASSERTING AN ABSENCE. The failure this catches is somebody
// adding a tag - ours or a vendor's - without touching the privacy page,
// which is exactly how a privacy page comes to describe a different product
// from the one being served. The page then reads correctly and is false, and
// nothing in a test suite about analytics would notice, because there would
// be no test about analytics.
//
// FW15 MEASURED WHY IT STILL SAYS "PAS ENCORE". SPEC 15 asks for Umami,
// self-hosted, same-origin. Serving its tracker same-origin needs either a
// running instance to proxy or copy from - FW28 deploys one, and there is
// none yet - or a copy of a third-party script committed to this repository,
// which SPEC 20 makes an ask-first item and which nothing here could verify
// against upstream. There is no npm package to vendor either: @umami/browser
// and umami-browser are both 404 on the registry, and @umami/node is a
// server-side client rather than a tracker. So the script does not ship this
// task, the sentence stays in the future tense, and this spec is what makes
// the "pas encore" half checkable in the meantime.
//
// EVERY PUBLIC ROUTE, not just the home page. The one that exists today
// covers "/" alone, and a tag added to the calculator - the page with a
// reason to want one - would pass it.

import { expect, test } from '@playwright/test';
import { goToServedPage } from './support/served';
import { BASE_URL } from './support/base-url';
import {
  CONFIRMATION_PATH,
  CONFIRM_STATES,
  UNSUBSCRIBE_PATH,
  UNSUBSCRIBE_STATES,
} from '../lib/alerts/status';
import { liveRoutes } from '../lib/content/routes';

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

/**
 * Hostnames that host the analytics anybody would reach for. Named rather
 * than inferred: "any third-party request" is already asserted below, and
 * this catches the subtler case of a vendor script proxied through our own
 * origin, where the hostname test sees nothing.
 */
const VENDORS = [
  'umami',
  'google-analytics',
  'googletagmanager',
  'gtag',
  'plausible',
  'matomo',
  'piwik',
  'fathom',
  'segment',
  'mixpanel',
  'hotjar',
  'clarity',
  'posthog',
];

/**
 * The live public routes, plus the two alert status pages.
 *
 * THE STATES COME FROM THE CONSTANTS, and FW20 found out why. This list held
 * the literal `/alertes/desinscription/desinscrit` - a state that does not
 * exist, since UNSUBSCRIBE_STATES is { unsubscribed: 'ok', unknown:
 * 'invalide' }. The route 404s, and it has 404ed since FW14.
 *
 * IT PASSED THE WHOLE TIME. Every assertion in this file is an absence - no
 * analytics host, no cookie, no third-party request - and an error page
 * satisfies all three perfectly. The route was certified clean by never being
 * loaded. Found the moment R169's corollary made these tests require a 200
 * first, which is the entire argument for that rule in one line.
 */
const ROUTES = [
  ...liveRoutes().map((route) => route.path),
  `${CONFIRMATION_PATH}/${CONFIRM_STATES.confirmed}`,
  `${UNSUBSCRIBE_PATH}/${UNSUBSCRIBE_STATES.unsubscribed}`,
];

test('the routes under test are the real registry, not a chosen few', () => {
  // R63. If liveRoutes() ever returned nothing, every assertion below would
  // pass by iterating an empty list.
  expect(ROUTES.length).toBeGreaterThanOrEqual(8);
  expect(ROUTES).toContain('/calculateur-teletravail-frontalier');
  expect(ROUTES).toContain('/confidentialite');
});

for (const route of ROUTES) {
  test(`${route} loads no analytics, sets no cookie, calls no third party`, async ({
    page,
    context,
  }) => {
    const foreign: string[] = [];

    page.on('request', (request) => {
      if (!request.url().startsWith(ORIGIN)) foreign.push(request.url());
    });

    await goToServedPage(page, route);
    await page.waitForLoadState('networkidle');

    // SPEC 17, from a real trace rather than a hostname grep.
    expect(foreign, `${route} made third-party requests`).toEqual([]);

    // SPEC D12: no cookies on public routes. An analytics tag that set one
    // would be caught here even if it were served from our own origin.
    expect(await context.cookies(), `${route} set a cookie`).toEqual([]);

    // AND NO SCRIPT THAT LOOKS LIKE MEASUREMENT, same-origin included. This
    // is the assertion the two above cannot make: a vendor script copied
    // into public/ is first-party by hostname and third-party by every
    // meaning that matters to a reader of the privacy page.
    const scripts = await page.locator('script').evaluateAll((nodes) =>
      nodes.map((node) => `${node.getAttribute('src') ?? ''} ${node.textContent ?? ''}`),
    );

    for (const vendor of VENDORS) {
      expect(
        scripts.some((script) => script.toLowerCase().includes(vendor)),
        `${route} loads something that looks like ${vendor}, while ` +
          '/confidentialite says the site does not measure its audience yet. ' +
          'If analytics now ships, that sentence is what changes first.',
      ).toBe(false);
    }
  });
}
