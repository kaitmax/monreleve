// web/e2e/og.spec.ts
//
// AC1, over HTTP, where a crawler meets it.
//
// THE PRIVACY PROPERTY IS BYTE EQUALITY, NOT INTENT. A user who shares their
// calculator URL shares the query string with it - nine parameters describing
// their canton, their rate and their telework days. The card that URL unfurls
// into must be the same card everybody else's URL unfurls into, because a
// Facebook thread is not where somebody's fiscal exposure gets published.
//
// WHY NOT "THE ROUTE READS NO SEARCHPARAMS". Because an assertion about the
// INPUTS is satisfied by code that reads the query and happens to ignore it
// today. This one is about the OUTPUT, so it survives a rewrite of how the
// card is produced - including the one this increment made, from a rendered
// route to a static asset.
//
// R142, AND IT IS A PRECONDITION RATHER THAN A SECOND TEST. Two requests with
// the SAME input are compared first. Until that holds, the comparison below
// means nothing: two byte arrays can differ for a reason that has no privacy
// content at all - a font fallback, a timestamp, a compression level. A
// failure in the first test is a rendering defect and is fixed at the cause.
// A failure in the second is a privacy defect. Never a tolerance, never a
// skip.

import { expect, test } from '@playwright/test';
import { PARAM_NAMES } from '../lib/params/schema';
import { SOCIAL_HEIGHT, SOCIAL_WIDTH } from '../lib/ui/core/rail/geometry';

/** Where Next serves public/opengraph-image.png. */
const CARD = '/opengraph-image.png';

/**
 * A full nine-param URL: every parameter SPEC 9.4 defines, carrying a
 * plausible position rather than a placeholder. R120 - a fixture that cannot
 * disagree with the bare request proves nothing, so these values are a real
 * shared calculation, the kind that would carry somebody's exposure.
 */
const NINE = new URLSearchParams({
  canton: 'GE',
  taux: '100',
  tt: '84',
  mfr: '6',
  mtiers: '2',
  methode: 'exact',
  total: '220',
  decompte: 'j',
  debut: '2026-03-01',
});

test.describe('the social card', () => {
  test('R142 PRECONDITION: the same request twice returns identical bytes', async ({
    request,
  }) => {
    const first = await request.get(CARD);
    const second = await request.get(CARD);

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);

    const a = await first.body();
    const b = await second.body();

    expect(
      a.equals(b),
      'The card is not deterministic for one input, so comparing two ' +
        'different inputs below would prove nothing about privacy. Fix the ' +
        'cause - a font with a fallback, a timestamp, a random seed - never ' +
        'the assertion.',
    ).toBe(true);
  });

  test('a nine-param URL and the bare path return the same bytes (AC1)', async ({ request }) => {
    // The nine names are read from the schema, so a tenth parameter added to
    // the product arrives here rather than being remembered.
    expect(PARAM_NAMES.length).toBe(9);
    for (const name of PARAM_NAMES) expect(NINE.has(name)).toBe(true);

    const bareResponse = await request.get(CARD);
    const sharedResponse = await request.get(`${CARD}?${NINE.toString()}`);

    // NON-VACUITY, AND IT CAUGHT ITSELF ON THE RED RUN. With no card in the
    // tree both requests returned the SAME 404 HTML page, so the comparison
    // below was true and this test passed while the product had no card at
    // all. Two equal bodies are only evidence when both are the card.
    for (const response of [bareResponse, sharedResponse]) {
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }

    const bare = await bareResponse.body();
    const shared = await sharedResponse.body();

    expect(
      shared.equals(bare),
      'The card differs when the URL carries a calculation. That is a user ' +
        "exposure leaking into a social thread, whatever the picture shows.",
    ).toBe(true);
  });

  test('is named in the head of a public page, absolute and fetchable', async ({
    page,
    request,
  }) => {
    // THE TAGS ARE DECLARED, NOT CONVENTIONAL, and this is where that shows.
    // A crawler never reads our metadata objects; it reads these four
    // attributes, resolved by Next against metadataBase. The unit test asserts
    // the declaration and cannot assert the resolution.
    await page.goto('/calculateur-teletravail-frontalier');

    const content = async (selector: string): Promise<string | null> =>
      page.locator(selector).first().getAttribute('content');

    const image = await content('meta[property="og:image"]');

    expect(image, 'no og:image in the head').not.toBeNull();
    expect(image).toContain(CARD);

    // ABSOLUTE, because a relative og:image is not resolved by every platform
    // - and R81 is the other half: with no configured origin these tags are
    // absent entirely rather than absolute against localhost. The e2e server
    // configures https://frontalier.example, so here they must be present.
    expect(image).toMatch(/^https:\/\/frontalier\.example\//);

    expect(await content('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(await content('meta[property="og:image:width"]')).toBe(String(SOCIAL_WIDTH));
    expect(await content('meta[property="og:image:height"]')).toBe(String(SOCIAL_HEIGHT));

    // AND IT RESOLVES TO THE CARD. A well-formed tag naming a 404 is the
    // failure nobody sees until a link is shared, because every assertion
    // above passes on a URL that serves nothing.
    const fetched = await request.get(CARD);

    expect(fetched.status()).toBe(200);
    expect(fetched.headers()['content-type']).toContain('image/png');
  });

  test('is served as a PNG at the social dimensions', async ({ request }) => {
    const response = await request.get(CARD);
    const bytes = await response.body();

    expect(response.headers()['content-type']).toContain('image/png');
    expect(bytes.readUInt32BE(16)).toBe(SOCIAL_WIDTH);
    expect(bytes.readUInt32BE(20)).toBe(SOCIAL_HEIGHT);
  });
});
