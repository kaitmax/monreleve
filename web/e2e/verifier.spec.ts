// web/e2e/verifier.spec.ts
//
// The served verification page. FW-VERIFY (R330).
//
// ============================================================================
// WHAT THIS ADDS OVER THE UNIT TESTS
// ============================================================================
//
// The lookup test proves the email is never loaded; the Content test proves the
// renderer. This proves the PAGE AS SERVED: it is noindex and sets NO cookie
// (FW22's rule, on the public verification page explicitly), and the neutral
// message renders.
//
// A MALFORMED CODE, on purpose. lookupVerification returns the neutral null for
// a malformed code WITHOUT touching the database, so this spec exercises the
// full served render - rate limit, lookup, Content - without depending on the
// e2e server's database. The valid-but-unknown path (which also returns null)
// is proven in tests/db/verification-lookup.test.ts.

import { expect, test } from '@playwright/test';
import { goToServedPage } from './support/served';
import { VERIFICATION_COPY } from '../lib/fr/verification';

test.describe('the verification page (R330)', () => {
  test('a code with no match gets the neutral page, noindex, and sets no cookie', async ({
    page,
    context,
  }) => {
    await goToServedPage(page, '/verifier/aucun-code-de-ce-type');

    // The one neutral message - the same a reader sees for an unknown or an
    // erased code.
    await expect(page.getByText(VERIFICATION_COPY.unknown)).toBeVisible();

    // noindex: a verification URL must never reach an index.
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');

    expect(robots ?? '').toContain('noindex');

    // SPEC D12 / FW22: zero cookies on a public route, this one included.
    expect(await context.cookies(), 'the verification page set a cookie').toEqual([]);
  });
});
