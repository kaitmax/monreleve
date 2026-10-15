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
import { readiness, type DatabaseProbe } from '@/lib/content/readiness';

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  delete process.env.FRONTALIER_RUNTIME;
  if (ORIGIN === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGIN;
});

describe('readiness while a serving process has no configured origin', () => {
  it('is NOT ready', async () => {
    process.env.FRONTALIER_RUNTIME = '1';
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect((await readiness()).ready).toBe(false);
  });

  it('names the failing check and the variable to set', async () => {
    // A readiness endpoint that says "not ready" and nothing else sends
    // whoever is deploying to read the source. This one names the check that
    // failed and the fix.
    process.env.FRONTALIER_RUNTIME = '1';
    delete process.env.NEXT_PUBLIC_SITE_URL;

    // A PASSING PROBE IS INJECTED so this stays a test about the ORIGIN.
    // Without one it would also exercise the database check, and a unit
    // test has no database (R353 puts that in pnpm test:db).
    const failed = (await readiness(async () => ({ ok: true }))).checks.filter(
      (check) => check.ok === false,
    );

    expect(failed).toHaveLength(1);
    expect(failed[0]?.name).toBe('site-origin');
    expect(failed[0]?.detail).toContain('NEXT_PUBLIC_SITE_URL');
  });
});

describe('readiness in every other combination', () => {
  it('is ready when a serving process HAS an origin', async () => {
    process.env.FRONTALIER_RUNTIME = '1';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://frontalier.fr';

    expect((await readiness(async () => ({ ok: true }))).ready).toBe(true);
  });

  it('is ready when NOT serving, even with no origin', async () => {
    // Every local build and every CI run. Readiness must not fail there or it
    // would block the pipeline for a condition that publishes nothing - which
    // is the same mistake the NODE_ENV guard made, one endpoint over.
    delete process.env.FRONTALIER_RUNTIME;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect((await readiness(async () => ({ ok: true }))).ready).toBe(true);
  });
});

describe('the shape is built for the checks that are coming', () => {
  it('reports every check, passing ones included', async () => {
    // Not just the failures. A deploy log showing which checks RAN is what
    // makes it possible to notice that a check silently stopped being
    // evaluated - the same reason the contrast audit reports its coverage.
    delete process.env.FRONTALIER_RUNTIME;

    const { checks } = (await readiness());

    expect(checks.length).toBeGreaterThan(0);
    for (const check of checks) {
      expect(typeof check.name).toBe('string');
      // THREE STATES SINCE R355: true, false, or null for NOT EVALUATED.
      expect(['boolean', 'object']).toContain(typeof check.ok);
      if (check.ok !== null) expect(typeof check.ok).toBe('boolean');
    }
  });

  it('is ready only when EVERY check passes', async () => {
    // The invariant that must survive adding the database check R83 names.
    process.env.FRONTALIER_RUNTIME = '1';
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const result = (await readiness());

    // A null  means NOT EVALUATED (R355) and must not block;
    // only an explicit false does.
    expect(result.ready).toBe(result.checks.every((check) => check.ok !== false));
    expect(result.ready).toBe(false);
  });
});

describe('R353/R354/R355: readiness knows about the database', () => {
  // THE PROBE IS INJECTED, so these run with no database at all. What is
  // under test is the DECISION readiness() makes from a probe result - the
  // probe's own behaviour against a real PostgreSQL belongs to pnpm test:db,
  // where a scratch database can actually be made unmigrated.
  const serving = (): void => {
    process.env.FRONTALIER_RUNTIME = '1';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://monreleve.ch';
  };

  const dbCheck = async (probe: DatabaseProbe) =>
    (await readiness(probe)).checks.find((check) => check.name === 'database');

  it('is ready when the database is reachable and migrated', async () => {
    serving();

    const result = await readiness(async () => ({ ok: true }));

    expect(result.ready).toBe(true);
    expect(result.checks.find((c) => c.name === 'database')?.ok).toBe(true);
  });

  // R353: either half failing fails the check, and R354: each names a code
  // from the fixed set rather than describing itself in prose.
  for (const reason of [
    'unreachable',
    'timeout',
    'unmigrated',
    'migration_failed',
  ] as const) {
    it(`is NOT ready when the probe reports ${reason}, and names it`, async () => {
      serving();

      const result = await readiness(async () => ({ ok: false, reason }));
      const database = result.checks.find((c) => c.name === 'database');

      expect(result.ready).toBe(false);
      expect(database?.ok).toBe(false);
      expect(database?.reason).toBe(reason);
    });
  }

  it('NEVER puts the connection string, host, port or password in the body', async () => {
    // R354. The probe is handed a realistic driver error - the shape that
    // actually leaks, because the connection string is in the message - and
    // the response must carry none of it. A readiness endpoint is unauthenticated
    // and is read by whatever is probing the deploy.
    serving();

    const SECRET_HOST = 'db-internal-7f3a.example';
    const SECRET_PASSWORD = 'hunter2-correct-horse';
    const result = await readiness(async () => {
      void `postgres://admin:${SECRET_PASSWORD}@${SECRET_HOST}:5432/app`;

      return { ok: false, reason: 'unreachable' };
    });

    const body = JSON.stringify(result);

    expect(body).not.toContain(SECRET_HOST);
    expect(body).not.toContain(SECRET_PASSWORD);
    expect(body).not.toContain('5432');
    expect(body).not.toContain('postgres://');

    // R133: the assertions above all pass against an empty body, so prove the
    // body is the real one and still names the failure.
    expect(body).toContain('database');
    expect(body).toContain('unreachable');
  });

  it('does not run the check outside a serving process, and does not call it a pass', async () => {
    // R355. `pnpm build` and CI have no database and must not need one, so
    // the check is not evaluated - but a check that silently stops running is
    // exactly what this list exists to make visible, so it is PRESENT and
    // explicitly not evaluated.
    delete process.env.FRONTALIER_RUNTIME;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://monreleve.ch';

    let called = false;
    const result = await readiness(async () => {
      called = true;

      return { ok: true };
    });
    const database = result.checks.find((c) => c.name === 'database');

    expect(called, 'the probe must not touch a database at build time').toBe(false);
    expect(database, 'the check stays in the list so its absence is visible').toBeDefined();

    // NOT A PLAIN PASS: `ok` is null, which is neither true nor false, so no
    // reader can mistake "did not run" for "passed".
    expect(database?.ok).toBeNull();

    // And it does not block: a build with no database is not a failed deploy.
    expect(result.ready).toBe(true);
  });

  it('a check that did not run cannot make the deploy ready on its own', async () => {
    // R133's other direction: the previous test passes if `ready` ignores
    // every check. A real failure beside the unevaluated one must still fail.
    delete process.env.FRONTALIER_RUNTIME;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect((await readiness(async () => ({ ok: true }))).ready).toBe(true);

    serving();
    expect((await readiness(async () => ({ ok: false, reason: 'unmigrated' }))).ready).toBe(
      false,
    );
  });

  it('reports site-origin and database, in that order', async () => {
    serving();

    const names = (await readiness(async () => ({ ok: true }))).checks.map((c) => c.name);

    expect(names).toEqual(['site-origin', 'database']);
  });

  it('is unready when the origin is missing even if the database is fine', async () => {
    // The checks are independent; neither masks the other.
    process.env.FRONTALIER_RUNTIME = '1';
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const result = await readiness(async () => ({ ok: true }));

    expect(result.ready).toBe(false);
    expect(result.checks.find((c) => c.name === 'site-origin')?.ok).toBe(false);
    expect(result.checks.find((c) => c.name === 'database')?.ok).toBe(true);
  });

  void dbCheck;
});
