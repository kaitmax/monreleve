// web/tests/unit/meta/container-db-stopped-verdict.test.ts
//
// FW-DB-STOPPED (R945-R948). The verdict on the container e2e suite's
// database-stopped step: plan Checkpoint D item 5, "the public site keeps
// serving with the database stopped", measured against the production IMAGE.
//
// scripts/container-db-stopped.mjs collects the answers - its own Postgres, the
// image against it, the answers with the database running, stopped, and
// started again. scripts/container-db-stopped-verdict.mjs decides what they
// mean. The deciding is pure, so every refusal is proven here without Docker
// (W3b's shape: container-render-verdict.mjs), and the run proves the
// collecting.
//
// THE REFERENCE IS THE SAME IMAGE WITH ITS DATABASE RUNNING. "Its own content"
// (R946) is each route's <h1> as the image served it a minute earlier, before
// the stop - read, not transcribed (R181), so a route added to the sitemap
// tomorrow is measured the day it ships, and an error page cannot pass for a
// page: its heading is not the page's.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  composePostgresImage,
  documentedStatus,
  headingsOf,
  judgeDatabaseStopped,
  leaksIn,
  redact,
  sitemapPaths,
  type DatabaseStoppedObservations,
  type HttpAnswer,
} from '../../../scripts/container-db-stopped-verdict.mjs';

const ORIGIN = 'https://monreleve.example';
const INSTANCE = 'container-db-stopped-0a1b2c3d';
const SECRETS = {
  'the database password': 'pw-5e1f0c9a7b3d',
  'the database user': 'u_c4a2e9',
  'the database host': 'monreleve-dbstop-0a1b2c3d-pg',
};

const ROUTES = ['/', '/cgu', '/guides/geneve'];
const HEADINGS: Record<string, string> = {
  '/': 'Combien de jours de télétravail vous reste-t-il ?',
  '/cgu': 'Conditions générales',
  '/guides/geneve': 'Télétravail frontalier à Genève',
};

function answer(status: number | null, body: string): HttpAnswer {
  return status === null ? { status, body, error: 'fetch failed' } : { status, body };
}

const page = (path: string): HttpAnswer =>
  answer(200, `<html><head><title>x</title></head><body><h1 class="h">${HEADINGS[path] ?? ''}</h1></body></html>`);

const SITEMAP = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...ROUTES.map((path) => `  <url><loc>${ORIGIN}${path}</loc></url>`),
  '</urlset>',
].join('\n');

const health = (instance = INSTANCE): HttpAnswer =>
  answer(200, JSON.stringify({ service: 'monreleve', instance, status: 'ok', reasons: [], runtime: true }));

const readyUp = answer(
  200,
  JSON.stringify({ ready: true, checks: [{ name: 'site-origin', ok: true }, { name: 'database', ok: true }] }),
);
const readyDown = answer(
  503,
  JSON.stringify({
    ready: false,
    checks: [
      { name: 'site-origin', ok: true },
      { name: 'database', ok: false, reason: 'unreachable', detail: 'The database did not answer.' },
    ],
  }),
);

const APP = { id: 'abc123', startedAt: '2026-11-17T01:00:00.000Z', restartCount: 0, running: true };

/** A run where everything R946 states held: the base every case edits once. */
function observations(): DatabaseStoppedObservations {
  return {
    service: 'monreleve',
    instance: INSTANCE,
    origin: ORIGIN,
    databaseRoute: '/api/v1/entries?year=2026',
    documentedStatus: 500,
    secrets: SECRETS,
    up: {
      health: health(),
      ready: readyUp,
      sitemap: answer(200, SITEMAP),
      routes: ROUTES.map((path) => ({ path, answer: page(path) })),
      databaseRoute: answer(200, JSON.stringify({ status: 'ok', year: 2026, entries: [] })),
    },
    down: {
      databaseRunning: false,
      health: health(),
      ready: readyDown,
      sitemap: answer(200, SITEMAP),
      routes: ROUTES.map((path) => ({ path, answer: page(path) })),
      databaseRoute: answer(500, ''),
    },
    recovery: {
      ready: readyUp,
      health: health(),
      databaseRoute: answer(200, JSON.stringify({ status: 'ok', year: 2026, entries: [] })),
      appBefore: APP,
      appAfter: { ...APP },
    },
  };
}

/** The refusals of one edited run, and the assertion that it was refused at all. */
function refusalsOf(edit: (run: DatabaseStoppedObservations) => void): string[] {
  const run = observations();

  edit(run);

  const { refusals } = judgeDatabaseStopped(run);

  expect(refusals.length, 'the edit must be refused').toBeGreaterThan(0);

  return refusals;
}

describe('judgeDatabaseStopped: the positive direction first (R196)', () => {
  it('passes a run where every route kept serving, and counts what it checked', () => {
    const { passed, refusals } = judgeDatabaseStopped(observations());

    expect(refusals).toEqual([]);
    // Five checks of the reference, eight with the database stopped, four of
    // the recovery, and two per route (running, stopped). A check that
    // silently stopped being made would shrink this number (R133).
    expect(passed).toHaveLength(5 + 8 + 4 + 2 * ROUTES.length);
    expect(passed.filter((name) => name.includes('/guides/geneve'))).toHaveLength(2);
  });
});

describe('R946: every route in the sitemap answers 200 with its own content, the database stopped', () => {
  it('names a route that fails with the database stopped (R948: the plant this step exists to catch)', () => {
    const refusals = refusalsOf((run) => {
      run.down.routes[1] = { path: '/cgu', answer: answer(500, '<html><h1>Erreur</h1></html>') };
    });

    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toContain('/cgu');
    expect(refusals[0]).toContain('500');
  });

  it('refuses a 200 that is not the page: an error page has a heading of its own', () => {
    const refusals = refusalsOf((run) => {
      run.down.routes[2] = {
        path: '/guides/geneve',
        answer: answer(200, '<html><h1>Service momentanément indisponible</h1></html>'),
      };
    });

    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toContain('/guides/geneve');
    expect(refusals[0]).toContain('Service momentanément indisponible');
    expect(refusals[0]).toContain(HEADINGS['/guides/geneve']);
  });

  it('refuses a route that did not answer at all', () => {
    const refusals = refusalsOf((run) => {
      run.down.routes[0] = { path: '/', answer: answer(null, '') };
    });

    expect(refusals.join('\n')).toContain('no answer');
  });

  it('refuses when the stopped run measured fewer routes than the sitemap lists (the count, R133)', () => {
    const refusals = refusalsOf((run) => {
      run.down.routes.pop();
    });

    expect(refusals.join('\n')).toContain('/guides/geneve');
  });

  it('refuses a sitemap that changed with the database stopped', () => {
    refusalsOf((run) => {
      run.down.sitemap = answer(200, SITEMAP.replace('/cgu', '/autre'));
    });
  });
});

describe('the reference is sound before anything is compared with it (R169, presence first)', () => {
  it('refuses a route that already failed with the database running', () => {
    const refusals = refusalsOf((run) => {
      run.up.routes[1] = { path: '/cgu', answer: answer(404, '<html><h1>Page introuvable</h1></html>') };
    });

    expect(refusals.join('\n')).toContain('/cgu');
  });

  it('refuses a page with no heading to compare: "its own content" needs one', () => {
    refusalsOf((run) => {
      run.up.routes[0] = { path: '/', answer: answer(200, '<html><body><p>texte</p></body></html>') };
      run.down.routes[0] = { path: '/', answer: answer(200, '<html><body><p>texte</p></body></html>') };
    });
  });

  it('refuses an empty sitemap: every route of nothing serves perfectly (R63)', () => {
    refusalsOf((run) => {
      const empty = answer(200, '<urlset></urlset>');

      run.up.sitemap = empty;
      run.down.sitemap = empty;
      run.up.routes = [];
      run.down.routes = [];
    });
  });

  it('refuses a sitemap that lists a route on another origin', () => {
    refusalsOf((run) => {
      const foreign = answer(200, SITEMAP.replace(`${ORIGIN}/cgu`, 'https://ailleurs.example/cgu'));

      run.up.sitemap = foreign;
      run.down.sitemap = foreign;
    });
  });

  it('refuses a database route that did not work with the database running', () => {
    refusalsOf((run) => {
      run.up.databaseRoute = answer(401, '{"status":"error","code":"invalid_token"}');
    });
  });

  it('refuses a readiness that was not ready with the database running', () => {
    refusalsOf((run) => {
      run.up.ready = readyDown;
    });
  });
});

describe('R945: the condition under test must hold while it is measured', () => {
  it('refuses a run whose database was still running', () => {
    const refusals = refusalsOf((run) => {
      run.down.databaseRunning = true;
    });

    expect(refusals.join('\n')).toContain('R945');
  });
});

describe('R946: liveness, readiness and the database-backed route, the database stopped', () => {
  it('refuses a liveness that failed: a restart cannot bring a database back (R375)', () => {
    refusalsOf((run) => {
      run.down.health = answer(503, '{}');
    });
  });

  it('refuses a server that is not this run\'s instance (R301): a sibling would pass R169', () => {
    const refusals = refusalsOf((run) => {
      run.down.health = health('container-e2e-sibling');
    });

    expect(refusals.join('\n')).toContain('container-e2e-sibling');
  });

  it('refuses a readiness that still says ready', () => {
    refusalsOf((run) => {
      run.down.ready = readyUp;
    });
  });

  it('refuses a 503 readiness that does not name the database', () => {
    refusalsOf((run) => {
      run.down.ready = answer(
        503,
        JSON.stringify({ ready: false, checks: [{ name: 'site-origin', ok: false }] }),
      );
    });
  });

  it('accepts either reason code: unreachable and timeout are both a stopped database', () => {
    const run = observations();

    run.down.ready = answer(
      503,
      JSON.stringify({ ready: false, checks: [{ name: 'database', ok: false, reason: 'timeout' }] }),
    );

    expect(judgeDatabaseStopped(run).refusals).toEqual([]);
  });

  it('refuses a database-backed route that answers anything but its documented status', () => {
    const refusals = refusalsOf((run) => {
      run.down.databaseRoute = answer(401, '{"status":"error","code":"invalid_token"}');
    });

    expect(refusals.join('\n')).toContain('401');
    expect(refusals.join('\n')).toContain('500');
  });

  it('refuses a body that carries the password, by name and never by value', () => {
    const refusals = refusalsOf((run) => {
      run.down.databaseRoute = answer(500, `{"message":"auth failed for ${SECRETS['the database password']}"}`);
    });

    expect(refusals.join('\n')).toContain('the database password');
    expect(refusals.join('\n')).not.toContain(SECRETS['the database password']);
  });

  it('refuses a stack trace in an API body', () => {
    refusalsOf((run) => {
      run.down.databaseRoute = answer(
        500,
        'Error: boom\n    at inspectAccessToken (/app/.next/server/chunks/123.js:1:2049)',
      );
    });
  });

  it('refuses the database host in a page served while it is down', () => {
    refusalsOf((run) => {
      run.down.routes[0] = {
        path: '/',
        answer: answer(200, `<h1>${HEADINGS['/']}</h1><p>${SECRETS['the database host']}</p>`),
      };
    });
  });
});

describe('R946: after the database is started again, readiness recovers without a restart', () => {
  it('refuses a readiness that never recovered', () => {
    refusalsOf((run) => {
      run.recovery.ready = readyDown;
    });
  });

  it('refuses a database-backed route that did not recover', () => {
    refusalsOf((run) => {
      run.recovery.databaseRoute = answer(500, '');
    });
  });

  it('refuses a container that was restarted: the same start time is the proof', () => {
    const refusals = refusalsOf((run) => {
      run.recovery.appAfter = { ...APP, startedAt: '2026-11-17T01:02:00.000Z', restartCount: 1 };
    });

    expect(refusals.join('\n')).toContain('2026-11-17T01:02:00.000Z');
  });

  it('refuses a container that died, which no restart policy brought back', () => {
    refusalsOf((run) => {
      run.recovery.appAfter = { ...APP, running: false };
    });
  });
});

describe('the readers', () => {
  it('reads the sitemap as paths on the origin, and keeps any other origin apart', () => {
    expect(sitemapPaths(SITEMAP, ORIGIN)).toEqual({ paths: ROUTES, foreign: [] });
    expect(sitemapPaths(`<loc>${ORIGIN}</loc><loc>https://x.example/a</loc>`, ORIGIN)).toEqual({
      paths: ['/'],
      foreign: ['https://x.example/a'],
    });
  });

  it('reads every <h1> as text: tags out, entities decoded, whitespace collapsed', () => {
    expect(headingsOf('<h1 class="a"><span>Mentions</span>\n  l&#233;gales&nbsp;&amp;&#x20;co</h1>')).toEqual([
      'Mentions légales & co',
    ]);
    expect(headingsOf('<h2>pas un titre de page</h2>')).toEqual([]);
    expect(headingsOf('<h1>Un</h1><h1>Deux</h1>')).toEqual(['Un', 'Deux']);
  });

  it('names a leak by what it is, and finds none in a clean body', () => {
    expect(leaksIn('{"status":"error"}', SECRETS, { api: true })).toEqual([]);
    expect(leaksIn('', SECRETS, { api: true })).toEqual([]);
    expect(leaksIn('postgresql://u:p@h:5432/d', {}, { api: true })).toEqual(['a connection string']);
    expect(leaksIn("Can't reach database server at `h:5432`", {}, { api: true })).toEqual([
      'a driver message',
    ]);
    // A page's prose is checked by VALUE only: the shapes are for API bodies.
    expect(leaksIn('rendez-vous at 12:30:45', {}, { api: true })).toEqual([]);
    expect(leaksIn(`<p>${SECRETS['the database user']}</p>`, SECRETS, { api: false })).toEqual([
      'the database user',
    ]);
  });

  it('redacts each secret by name, so a body can be printed after the check', () => {
    expect(redact(`x ${SECRETS['the database password']} y`, SECRETS)).toBe(
      'x <the database password> y',
    );
  });
});

describe('the documented status and the Postgres image are READ, not typed (R181, R211)', () => {
  const API_DOC = readFileSync(join(process.cwd(), '..', 'docs', 'api-v1.md'), 'utf8');
  const COMPOSE = readFileSync(join(process.cwd(), '..', 'docker-compose.yml'), 'utf8');

  it('reads the status docs/api-v1.md documents for read_failed on GET', () => {
    const status = documentedStatus(API_DOC, 'read_failed', 'GET');

    expect(status).toBeGreaterThanOrEqual(500);
    expect(status).toBeLessThan(600);
  });

  it('refuses a document with no such row, or two of them, rather than guessing', () => {
    expect(() => documentedStatus('| `other` | `GET` | 400 | x |', 'read_failed', 'GET')).toThrow(/R211/u);
    expect(() =>
      documentedStatus('| `read_failed` | `GET` | 500 | a |\n| `read_failed` | `GET` | 503 | b |', 'read_failed', 'GET'),
    ).toThrow(/R211/u);
  });

  it('reads the one Postgres image docker-compose.yml runs, so the step pulls nothing new', () => {
    expect(composePostgresImage(COMPOSE)).toMatch(/^postgres:\S+$/u);
    expect(() => composePostgresImage('services:\n  a:\n    image: redis:7\n')).toThrow(/R211/u);
  });
});
