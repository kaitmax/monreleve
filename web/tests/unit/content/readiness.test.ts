// web/tests/unit/content/readiness.test.ts
//
// RULING R83: liveness and readiness are separate concerns and separate
// endpoints.
//
//   /api/health   LIVENESS.  200 whenever the process is up, degraded in the
//                 body, never fails on configuration.
//   /api/ready    READINESS. 503 while degraded - a fallback origin now, an
//                 unreachable database later.
//
// WHY THE SPLIT IS THE RIGHT ANSWER, since I asked the question and got it.
// I built /api/health returning 200 with a degraded body and flagged the
// consequence: a deploy could go live degraded - pages fine, no sitemap, no
// canonicals - because Coolify would see a healthy container. Making health
// 503 instead would have been worse, because an orchestrator restarts a
// container that fails liveness, and restarting cannot fix a missing
// environment variable. It would loop.
//
// Readiness is the endpoint that means "do not send this version live", and
// failing it stops a DEPLOY rather than killing a running process. That is the
// distinction the two words carry in every orchestrator, and conflating them
// is why so many deploys either loop or go live broken.
//
// THE SHAPE IS A LIST OF CHECKS, not a boolean, because R83 names the next one
// already: "unreachable database later". A boolean would have to be replaced;
// a list gets an entry.

import { afterEach, describe, expect, it } from 'vitest';
import { readiness } from '@/lib/content/readiness';

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  delete process.env.FRONTALIER_RUNTIME;
  if (ORIGIN === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGIN;
});

describe('readiness while a serving process has no configured origin', () => {
  it('is NOT ready', () => {
    process.env.FRONTALIER_RUNTIME = '1';
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(readiness().ready).toBe(false);
  });

  it('names the failing check and the variable to set', () => {
    // A readiness endpoint that says "not ready" and nothing else sends
    // whoever is deploying to read the source. This one names the check that
    // failed and the fix.
    process.env.FRONTALIER_RUNTIME = '1';
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const failed = readiness().checks.filter((check) => !check.ok);

    expect(failed).toHaveLength(1);
    expect(failed[0]?.name).toBe('site-origin');
    expect(failed[0]?.detail).toContain('NEXT_PUBLIC_SITE_URL');
  });
});

describe('readiness in every other combination', () => {
  it('is ready when a serving process HAS an origin', () => {
    process.env.FRONTALIER_RUNTIME = '1';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://frontalier.fr';

    expect(readiness().ready).toBe(true);
  });

  it('is ready when NOT serving, even with no origin', () => {
    // Every local build and every CI run. Readiness must not fail there or it
    // would block the pipeline for a condition that publishes nothing - which
    // is the same mistake the NODE_ENV guard made, one endpoint over.
    delete process.env.FRONTALIER_RUNTIME;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(readiness().ready).toBe(true);
  });
});

describe('the shape is built for the checks that are coming', () => {
  it('reports every check, passing ones included', () => {
    // Not just the failures. A deploy log showing which checks RAN is what
    // makes it possible to notice that a check silently stopped being
    // evaluated - the same reason the contrast audit reports its coverage.
    delete process.env.FRONTALIER_RUNTIME;

    const { checks } = readiness();

    expect(checks.length).toBeGreaterThan(0);
    for (const check of checks) {
      expect(typeof check.name).toBe('string');
      expect(typeof check.ok).toBe('boolean');
    }
  });

  it('is ready only when EVERY check passes', () => {
    // The invariant that must survive adding the database check R83 names.
    process.env.FRONTALIER_RUNTIME = '1';
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const result = readiness();

    expect(result.ready).toBe(result.checks.every((check) => check.ok));
    expect(result.ready).toBe(false);
  });
});
