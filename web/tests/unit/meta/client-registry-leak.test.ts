// web/tests/unit/meta/client-registry-leak.test.ts
//
// RULING R976 (FW-CALC-BYTES): THE ROUTE REGISTRY NEVER REACHES THE BROWSER.
//
// lib/content/routes.ts decides R85's liveness against every registered route,
// and until this task three client modules imported it: the public shell, the
// calculator's form and its result panel. So the whole registry shipped in a
// chunk every public page loads, and any new route entry cost bytes on the
// calculator - the page with the least GATE A headroom (QUEUE-STATE BLOCKED 11).
//
// Next's 'server-only' marker would say this at build time, but it is not a
// dependency here and adding one is Ask-first (SPEC 20). So the guard is the
// other shape R976 names: `pnpm size` reads every client chunk of the build it
// measures and fails if one carries a string only the registry holds. The
// decisions are pure functions, proven here in both directions without a build;
// the end-to-end plant (a real client import, a real build, `pnpm size` red) is
// in REPORT-FW-CALC-BYTES.txt (R180, R979).

import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PUBLIC_ROUTES } from '@/lib/content/routes';
// The .mjs resolves through client-registry-leak.d.mts (R185); the parity test
// asserts the declaration and the module agree.
import {
  MIN_PROBE_LENGTH,
  REGISTRY_SOURCE,
  checkRegistryInClient,
  probesIn,
  registryProbes,
  registryVerdict,
} from '@/scripts/client-registry-leak.mjs';

const WEB = process.cwd();
const ROUTES_SOURCE = readFileSync(join(WEB, REGISTRY_SOURCE), 'utf8');

const temps: string[] = [];

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/** A throwaway directory shaped like a Next build: server/ and static/. */
function build(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'registry-leak-'));

  temps.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }

  return root;
}

describe('the probes are read from the registry itself (R181)', () => {
  const probes = registryProbes(ROUTES_SOURCE);

  it('finds some, so nothing below passes over an empty list (R133)', () => {
    expect(probes.length).toBeGreaterThanOrEqual(1);
  });

  it('takes only strings long enough to be the registry’s alone', () => {
    for (const probe of probes) expect(probe.length).toBeGreaterThanOrEqual(MIN_PROBE_LENGTH);
  });

  it('takes task strings the registry actually holds at runtime, not text near them', () => {
    // The source is read as text, so this ties each probe to the module's
    // value: a regex that picked up a comment would fail here.
    const tasks = new Set(PUBLIC_ROUTES.map((route) => route.task));

    for (const probe of probes) expect(tasks.has(probe), probe).toBe(true);
  });

  it('reads either quote style and ignores the interface field', () => {
    const source = [
      'readonly task: string;',
      "{ path: '/a', task: 'FW1 first of its kind', status: 'live' },",
      '{ path: "/b", task: "FW2, built elsewhere", status: "live" },',
      "{ path: '/c', task: 'FW3', status: 'live' },",
    ].join('\n');

    expect(registryProbes(source)).toEqual(['FW1 first of its kind', 'FW2, built elsewhere']);
  });
});

describe('a probe is found where it is, and only there', () => {
  it('names the probes a minified chunk carries', () => {
    const chunk = '{path:"/x",status:"live",task:"FW19, built FW-COMPARATEUR",priority:.8}';

    expect(probesIn(chunk, ['FW19, built FW-COMPARATEUR', 'FW16, content FW17'])).toEqual([
      'FW19, built FW-COMPARATEUR',
    ]);
  });

  it('finds nothing in a chunk that holds only a path', () => {
    // A path is not the registry: the leaf module's constants are meant to ship.
    expect(probesIn('let i="/calculateur-teletravail-frontalier"', ['FW16, content FW17'])).toEqual([]);
  });
});

describe('the verdict refuses to vouch for what it could not see (R154, R169)', () => {
  it('refuses with no probe at all', () => {
    const verdict = registryVerdict({ probes: [], serverHits: 3, clientFiles: 40, leaks: [] });

    expect(verdict.ok).toBe(false);
    expect(verdict.lines.join('\n')).toMatch(/no probe/i);
  });

  it('refuses when the server output carries no probe: absence would prove nothing', () => {
    const verdict = registryVerdict({ probes: ['FW16, content FW17'], serverHits: 0, clientFiles: 40, leaks: [] });

    expect(verdict.ok).toBe(false);
    expect(verdict.lines.join('\n')).toMatch(/server/i);
  });

  it('refuses when there is no client chunk to read', () => {
    const verdict = registryVerdict({ probes: ['FW16, content FW17'], serverHits: 3, clientFiles: 0, leaks: [] });

    expect(verdict.ok).toBe(false);
    expect(verdict.lines.join('\n')).toMatch(/client chunk/i);
  });

  it('fails naming every chunk that carries the registry, and what it carries', () => {
    const verdict = registryVerdict({
      probes: ['FW16, content FW17'],
      serverHits: 3,
      clientFiles: 40,
      leaks: [{ file: 'static/chunks/9879-abc.js', probes: ['FW16, content FW17'] }],
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.lines.join('\n')).toContain('static/chunks/9879-abc.js');
    expect(verdict.lines.join('\n')).toContain('FW16, content FW17');
  });

  it('passes when the server carries the registry and no client chunk does, and says how much it read', () => {
    const verdict = registryVerdict({ probes: ['FW16, content FW17'], serverHits: 3, clientFiles: 40, leaks: [] });

    expect(verdict.ok).toBe(true);
    expect(verdict.lines.join('\n')).toMatch(/1 probe.*3 server file.*40 client chunk/);
  });
});

describe('the check reads a build directory (both directions)', () => {
  const probe = 'FW19, built FW-COMPARATEUR';
  const routes = `export const PUBLIC_ROUTES = [{ path: '/x', task: '${probe}' }];`;

  it('passes a build whose registry stayed on the server', () => {
    const root = build({
      'server/chunks/123.js': `var n=[{path:"/x",task:"${probe}"}]`,
      'static/chunks/app/page-1.js': 'let i="/x"',
      'static/chunks/9879-a.js': 'console.log(1)',
    });

    expect(checkRegistryInClient(root, routes)).toMatchObject({ ok: true });
  });

  it('fails a build that ships it, naming the chunk', () => {
    const root = build({
      'server/chunks/123.js': `var n=[{path:"/x",task:"${probe}"}]`,
      'static/chunks/app/page-1.js': 'let i="/x"',
      'static/chunks/9879-a.js': `n=[{path:"/x",task:"${probe}"}]`,
    });
    const verdict = checkRegistryInClient(root, routes);

    expect(verdict.ok).toBe(false);
    expect(verdict.lines.join('\n')).toContain('static/chunks/9879-a.js');
    expect(verdict.lines.join('\n')).not.toContain('static/chunks/app/page-1.js');
  });
});

describe('pnpm size runs it', () => {
  it('is imported and called by check-budgets.mjs, on the shipping build', () => {
    // The wiring, pinned at the source; the plant in the report proves it end
    // to end. A guard nothing calls is a comment (CLAUDE.md, R85's lesson).
    const source = readFileSync(join(WEB, 'scripts', 'check-budgets.mjs'), 'utf8');

    expect(source).toContain("from './client-registry-leak.mjs'");
    expect(source).toMatch(/checkRegistryInClient\(\s*NEXT_DIR/);
  });
});
