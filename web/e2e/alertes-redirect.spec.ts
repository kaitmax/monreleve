// web/e2e/alertes-redirect.spec.ts
//
// FW-REDIRECT (R366): the confirm and unsubscribe links send a reader to a
// place a browser can actually open.
//
// ============================================================================
// WHY THIS SPEC EXISTS IN THE E2E SUITE RATHER THAN AS A UNIT TEST
// ============================================================================
//
// tests/db/redirect-location.test.ts already asserts the Location for every
// state of both routes, and it would have caught this defect. What it cannot
// do is run against the IMAGE, and the image is the only place the bug was
// ever visible: under `next start` the request origin is http://localhost:3000
// and an absolute Location is indistinguishable from a correct one.
//
// scripts/container-e2e.mjs points this whole suite at the built container
// (R249). So a spec placed here is run twice - against next start by
// `pnpm test:e2e`, and against the image by `pnpm test:container:e2e` - and
// it is the second run that has something to say. That is R366's "add both
// flows to the mode that runs against the image": the mode exists, so this
// needs no new harness.
//
// ============================================================================
// NO SEEDED SUBSCRIBER, AND WHY THAT PROVES THE SAME THING
// ============================================================================
//
// A real token would exercise the `confirmee` and `ok` states. These requests
// carry a token nobody was issued, so they exercise `invalide`.
//
// THE LOCATION IS BUILT THE SAME WAY IN EVERY STATE. One call, one helper,
// one header - the state only decides the last path segment. The defect was
// in how the URL was ASSEMBLED, which no state can vary. Seeding a subscriber
// from inside a Playwright spec would mean giving the e2e suite database
// credentials it has never had, to vary a segment that cannot change the
// thing under test.
//
// The seeded states are proven where seeding is natural: the db test above,
// and REPORT-FW-REDIRECT.txt's container run, which seeds a real subscriber
// and pastes the raw headers for `confirmee` and `ok`.

import { expect, test } from '@playwright/test';

/** A token nobody was issued: 64 hex characters, the shape the routes expect. */
const UNISSUED = 'f'.repeat(64);

const ROUTES = [
  {
    what: 'the confirmation link',
    path: `/api/alertes/confirm?token=${UNISSUED}`,
    lands: '/alertes/confirmation/invalide',
  },
  {
    what: 'the unsubscribe link',
    path: `/api/alertes/desinscription?token=${UNISSUED}`,
    lands: '/alertes/desinscription/invalide',
  },
] as const;

for (const route of ROUTES) {
  test(`${route.what} redirects to a path, never to the server's own address`, async ({
    request,
  }) => {
    const response = await request.get(route.path, { maxRedirects: 0 });

    expect(response.status()).toBe(303);

    const location = response.headers()['location'] ?? '';

    // THE ASSERTION THAT WOULD HAVE CAUGHT THE LIVE BUG. Inside the image the
    // old code emitted http://0.0.0.0:3000/alertes/confirmation/invalide.
    expect(location).toBe(route.lands);
    expect(location.startsWith('/')).toBe(true);
    expect(location).not.toContain('://');
    expect(location).not.toContain('0.0.0.0');
  });

  test(`${route.what} lands on a page that renders`, async ({ page }) => {
    // FOLLOWING IT IS THE HALF THAT MATTERS (R154: proven to deliver). A
    // Location that is well-formed and points at nothing passes every
    // assertion above. R169's presence corollary too: the status is checked
    // before anything is read off the page.
    const response = await page.goto(route.path);

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(route.lands);

    // The page said something, rather than being an empty 200. The outcome
    // HEADING, not a layout landmark: these pages render their state as an h1,
    // and asserting the landmark would pass on a shell with no content in it.
    await expect(page.locator('h1')).toBeVisible();
    expect((await page.locator('h1').innerText()).trim().length).toBeGreaterThan(0);
  });
}
