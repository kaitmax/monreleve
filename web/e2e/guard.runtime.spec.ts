// web/e2e/guard.runtime.spec.ts
//
// RULING R81, proved where it has to be proved: against a real `next start`
// with FRONTALIER_RUNTIME=1 and NEXT_PUBLIC_SITE_URL unset. Run by
// `pnpm test:runtime` against playwright.runtime.config.ts, which is a
// separate config because this suite needs a server in a deliberately broken
// configuration and every other suite needs one that works.
//
// WHAT IS BEING PROVED, and why a unit test could not do it. lib/content/site.ts
// has unit coverage for the four combinations of marker and origin, and that
// covers the LOGIC. It cannot cover the wiring: whether the sitemap route
// actually reads the guard, whether Next really omits a canonical when
// `alternates` is absent, whether the health route is reachable at the path
// FW28 will point Coolify at. Those are integration facts, and the only place
// they are true or false is a running server.
//
// THE HISTORY THIS CLOSES. The first version of the origin module threw when
// the variable was unset and NODE_ENV was production. That broke every local
// build - `pnpm build` is part of the Definition of Done - because NODE_ENV
// cannot tell "serving" from "building on a laptop". R81 supplied the marker
// that can, so the guard finally has a trigger that fires exactly when it
// should. These tests are what say so.

import { expect, test } from '@playwright/test';

test('/sitemap.xml REFUSES with 503 rather than publishing localhost URLs', async ({
  request,
}) => {
  // The core of R81. A sitemap listing http://localhost:3000/... is
  // well-formed XML: a crawler fetches it, resolves nothing, and may treat the
  // document as authoritative - so the failure is not "no sitemap" but "a
  // sitemap asserting the site has no reachable pages", and no other gate
  // objects because the file is valid.
  const response = await request.get('/sitemap.xml');

  expect(response.status()).toBe(503);

  const body = await response.text();

  // The refusal names the variable, so whoever is on call does not have to
  // read the source to learn the fix.
  expect(body).toContain('NEXT_PUBLIC_SITE_URL');
  expect(body).toContain('R81');

  // And it must not have leaked a single localhost URL into the body while
  // refusing, which would defeat the point of refusing.
  expect(body).not.toContain('<urlset');
  expect(body).not.toContain('localhost:3101');
});

test('the refusal is not cached, so a redeploy fixes it immediately', async ({ request }) => {
  // The fix is an environment variable. A cached 503 would survive the fix and
  // send someone hunting a bug that no longer exists.
  const response = await request.get('/sitemap.xml');

  expect(response.headers()['cache-control']).toContain('no-store');
});

test('/api/health reports degraded, and names what is missing', async ({ request }) => {
  const response = await request.get('/api/health');

  // 200, not 503. A degraded origin does not stop pages rendering, so taking
  // the container out of rotation for it would turn a configuration mistake
  // into an outage. R81 says the sitemap "return 503" and this one "report
  // degraded" - different words for the two surfaces.
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    status: string;
    reasons: string[];
    origin: string | null;
    runtime: boolean;
  };

  expect(body.status).toBe('degraded');
  expect(body.runtime).toBe(true);
  expect(body.reasons.join(' ')).toContain('NEXT_PUBLIC_SITE_URL');

  // NULL rather than the resolved stand-in. A health payload echoing
  // "http://localhost:3000" invites a reader to take it for the configured
  // value, which is the confusion this whole ruling exists to prevent.
  expect(body.origin).toBeNull();
});

test('the home page omits its canonical rather than pointing at localhost', async ({ page }) => {
  // A canonical pointing at localhost is worse than no canonical: a crawler
  // treats it as an INSTRUCTION, so it would be told the real page lives at an
  // address it cannot reach. Absence is recoverable; a wrong instruction is
  // acted upon.
  await page.goto('/');

  expect(await page.locator('link[rel="canonical"]').count()).toBe(0);
  expect(await page.locator('link[rel="alternate"]').count()).toBe(0);
});

test('no localhost URL reaches the rendered head at all', async ({ page }) => {
  // The broader version of the assertion above, because a canonical is not the
  // only tag Next builds from metadataBase - og:url and friends come from the
  // same place, and this suite should catch a leak through any of them.
  await page.goto('/');

  const head = (await page.locator('head').innerHTML()).toLowerCase();

  expect(head).not.toContain('localhost:3000');
  expect(head).not.toContain('localhost:3101');
});

test('the site still SERVES - degraded is not broken', async ({ page }) => {
  // The other half of R81, and the reason it guards the sitemap rather than
  // the build: pages must still render. A guard that took the site down for a
  // missing sitemap variable would be a worse outcome than the one it
  // prevents.
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
});

// ---------------------------------------------------------------------------
// RULING R83: liveness and readiness under the SAME conditions, which is the
// only way the split can be shown to be real. Asserting them in separate
// tests would leave the pair unproven - the point is that one endpoint says
// 200 and the other says 503 about the identical process at the identical
// moment.
// ---------------------------------------------------------------------------

test('liveness stays 200 while readiness refuses - the same process, the same moment', async ({
  request,
}) => {
  const [health, ready] = await Promise.all([
    request.get('/api/health'),
    request.get('/api/ready'),
  ]);

  // Liveness: the process is alive, and an orchestrator must not restart it.
  // A restart cannot supply a missing environment variable, so a liveness
  // check that failed here would crash-loop while the previous version
  // stayed down.
  expect(health.status()).toBe(200);
  expect(((await health.json()) as { status: string }).status).toBe('degraded');

  // Readiness: do not send this version live. Failing here stops a deploy and
  // leaves the running version serving.
  expect(ready.status()).toBe(503);
});

test('/api/ready names the failing check and the variable to set', async ({ request }) => {
  const response = await request.get('/api/ready');
  const body = (await response.json()) as {
    ready: boolean;
    checks: { name: string; ok: boolean; detail?: string }[];
  };

  expect(body.ready).toBe(false);

  const failed = body.checks.filter((check) => !check.ok);

  expect(failed).toHaveLength(1);
  expect(failed[0]?.name).toBe('site-origin');
  expect(failed[0]?.detail).toContain('NEXT_PUBLIC_SITE_URL');

  // Reports the passing checks too - a deploy log listing which checks RAN is
  // what makes it possible to notice one silently ceasing to be evaluated.
  expect(body.checks.length).toBeGreaterThanOrEqual(failed.length);
});

test('the readiness refusal is not cached', async ({ request }) => {
  // A cached 503 would survive the fix and fail the next deploy for a reason
  // that no longer exists.
  const response = await request.get('/api/ready');

  expect(response.headers()['cache-control']).toContain('no-store');
});
