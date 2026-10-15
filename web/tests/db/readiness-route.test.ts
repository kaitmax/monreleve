// web/tests/db/readiness-route.test.ts
//
// R353-R356 THROUGH THE ROUTE HANDLERS, which is the only place the contract
// actually lives (R204). lib/content/readiness.ts can be perfect while the
// route forgets to await it, serves a Promise, or returns 200 on a failure -
// and every unit test would still pass.
//
// It needs a database, so it is here rather than in tests/unit.

import { describe, expect, it } from 'vitest';
import { GET as ready } from '@/app/api/ready/route';
import { GET as health } from '@/app/api/health/route';

const serving = <T>(run: () => T): T => {
  const marker = process.env.FRONTALIER_RUNTIME;
  const origin = process.env.NEXT_PUBLIC_SITE_URL;

  process.env.FRONTALIER_RUNTIME = '1';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://monreleve.ch';

  try {
    return run();
  } finally {
    if (marker === undefined) delete process.env.FRONTALIER_RUNTIME;
    else process.env.FRONTALIER_RUNTIME = marker;
    if (origin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = origin;
  }
};

describe('/api/ready against a migrated database', () => {
  it('answers 200 and lists BOTH checks', async () => {
    const response = await serving(async () => ready());
    const body = (await response.json()) as {
      ready: boolean;
      checks: ReadonlyArray<{ name: string; ok: boolean | null }>;
    };

    expect(response.status).toBe(200);
    expect(body.ready).toBe(true);
    expect(body.checks.map((c) => c.name)).toEqual(['site-origin', 'database']);
    expect(body.checks.find((c) => c.name === 'database')?.ok).toBe(true);
  });

  it('is never cached - a readiness answer from a minute ago is not an answer', async () => {
    const response = await serving(async () => ready());

    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('R354: the body carries nothing that identifies the database', async () => {
    const response = await serving(async () => ready());
    const text = await response.text();
    const url = process.env.DATABASE_URL ?? '';
    const host = /@([^:/?]+)/.exec(url)?.[1];

    if (host !== undefined && host !== '') expect(text).not.toContain(host);
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('postgresql://');

    // R133: the three assertions above hold for an empty body.
    expect(text).toContain('database');
  });
});

describe('R356: health is LIVENESS and the database cannot change that', () => {
  it('answers 200 while serving, and names this product (R169)', async () => {
    const response = await serving(() => health());
    const body = (await response.json()) as { service: string; status: string };

    expect(response.status).toBe(200);
    expect(body.service).toBe('monreleve');
  });

  it('does NOT probe the database, and that is the decision (R156)', async () => {
    // R356 permits health to add "database" to its degraded reasons. It does
    // not, deliberately, and the reason is R83's own argument one level down:
    //
    //   an orchestrator RESTARTS what fails liveness.
    //
    // A liveness endpoint that queries the database fails when the database
    // is merely SLOW - and the restart that follows cannot fix a database,
    // so the container crash-loops while the previous version stays down.
    // That is the exact failure R83 exists to prevent, reintroduced through
    // the body rather than the status code.
    //
    // Readiness is where a database problem belongs: failing it stops a
    // DEPLOY and leaves the running version serving.
    //
    // Asserted by TIMING, because "it did not query" is otherwise invisible:
    // a handler that awaited even a fast local SELECT would not come back
    // this quickly, and against a stopped database it would sit on the
    // probe's 2 s budget. The runtime suite proves the same thing with the
    // database actually stopped.
    const started = Date.now();
    const response = await serving(() => health());
    const elapsed = Date.now() - started;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(100);

    const body = (await response.json()) as { reasons: readonly string[] };

    expect(body.reasons.some((r) => /database/i.test(r))).toBe(false);
  });
});
