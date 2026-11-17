// web/tests/unit/meta/visual-filter.test.ts
//
// R960: `pnpm test:visual -- <spec or --grep>` RUNS ONLY WHAT WAS NAMED.
// R961: node_modules LIVES IN A NAMED VOLUME, NAMED FROM THE LOCKFILE'S HASH.
//
// THE PARKED TASK (C9, Queue Ruling 16): scripts/visual.mjs could not run one
// spec. Its container command was fixed and --update was its only argument, so
// a visual proof of one page cost the whole suite, and the install into an
// anonymous volume took 10.5 of the run's ~25 minutes on every run.
//
// WHAT IS ASSERTED HERE IS THE COMMAND, not a run of it. The container command
// is built by pure functions exported from visual.mjs, so the docker argv a
// filter produces can be read directly: the filter is in it, as separate argv
// elements AFTER a shell script that never changes, and with no filter
// nothing follows the script, so Playwright receives `--project=visual` and
// nothing else - the full suite. A live filtered run and a live full run are
// the session's own evidence (REPORT-FW-VISUAL-FILTER.txt); this file is what
// keeps the command true after that.
//
// R962 - that no gate passes a filter - is a different claim with a different
// subject (the gate scripts), and lives in visual-filter-gates.test.ts.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTAINER_SCRIPT,
  dockerRunArguments,
  nodeModulesCache,
  visualArguments,
  volumeCreateArguments,
  volumeVerdict,
} from '../../../scripts/visual.mjs';
import { withoutComments } from '@/tests/support/quoted-spans';

const WEB = join(import.meta.dirname, '..', '..', '..');

const IMAGE = 'mcr.microsoft.com/playwright:v1.63.0-noble';
const LOCKFILE = readFileSync(join(WEB, 'pnpm-lock.yaml'), 'utf8');

/** Everything dockerRunArguments needs besides the parsed arguments. */
const RUN = {
  repo: 'C:/wt/example',
  volume: nodeModulesCache(LOCKFILE, IMAGE).volume,
  distDir: '.next-visual-1234-abc',
  image: IMAGE,
};

/** The docker argv for what a person typed after `node scripts/visual.mjs`. */
function dockerFor(argv: readonly string[]): readonly string[] {
  const parsed = visualArguments(argv);

  if (!parsed.ok) throw new Error(`refused: ${parsed.why}`);

  return dockerRunArguments({ ...RUN, update: parsed.update, filter: parsed.filter });
}

/**
 * What Playwright receives as "$@": every argv element after the script and
 * its $0. Located by the script's own position, so a reordering of the docker
 * flags cannot make this read the wrong slice.
 */
function playwrightReceives(argv: readonly string[]): readonly string[] {
  const docker = dockerFor(argv);
  const at = docker.indexOf(CONTAINER_SCRIPT);

  expect(at, 'the container script is in the docker argv').toBeGreaterThan(0);
  expect(docker.slice(at - 3, at), 'run by bash -lc in the pinned image').toEqual([IMAGE, 'bash', '-lc']);

  const name = docker[at + 1] ?? '';

  // bash -c's first argument after the script is $0, not $1. A $0 that looked
  // like an option would mean the filter had shifted by one.
  expect(name, 'a $0 follows the script').toMatch(/^[a-z]+$/u);

  return docker.slice(at + 2);
}

/** The -e pairs a docker argv passes into the container. */
function environmentOf(docker: readonly string[]): readonly string[] {
  return docker.flatMap((value, index) => (docker[index - 1] === '-e' ? [value] : []));
}

/** The -v specs a docker argv mounts. */
function volumesOf(docker: readonly string[]): readonly string[] {
  return docker.flatMap((value, index) => (docker[index - 1] === '-v' ? [value] : []));
}

describe('R960: the container command carries the filter, and only the filter', () => {
  it('runs the full suite when nothing is named: no argument reaches Playwright', () => {
    // `pnpm test:visual` with nothing after it - which is exactly what
    // gate:changed runs - gives the script an empty argv.
    expect(visualArguments([])).toEqual({ ok: true, update: false, filter: [] });
    expect(playwrightReceives([])).toEqual([]);

    // The regeneration is the same full suite with one flag of Playwright's own.
    expect(playwrightReceives(['--update'])).toEqual(['--update-snapshots']);
  });

  it('carries a named spec into the container command', () => {
    // pnpm 11 passes the `--` through verbatim, measured on 11.17.0:
    // `pnpm probe -- e2e/a.visual.spec.ts` gave the script
    // ["--","e2e/a.visual.spec.ts"]. It is a separator, never a filter.
    expect(playwrightReceives(['--', 'e2e/calculateur.visual.spec.ts'])).toEqual([
      'e2e/calculateur.visual.spec.ts',
    ]);
    expect(playwrightReceives(['e2e/calculateur.visual.spec.ts'])).toEqual([
      'e2e/calculateur.visual.spec.ts',
    ]);
  });

  it('carries --grep as argv elements, and a pattern with a space as ONE element', () => {
    expect(playwrightReceives(['--', '--grep', 'erreur desktop'])).toEqual(['--grep', 'erreur desktop']);
    expect(playwrightReceives(['--', '-g', 'avis'])).toEqual(['-g', 'avis']);
    expect(playwrightReceives(['--', '--grep=avis'])).toEqual(['--grep=avis']);
    expect(playwrightReceives(['--', 'e2e/calculateur.visual.spec.ts', '--grep', 'erreur'])).toEqual([
      'e2e/calculateur.visual.spec.ts',
      '--grep',
      'erreur',
    ]);
  });

  it('keeps a filtered regeneration a regeneration of only what was named', () => {
    expect(playwrightReceives(['--update', '--', 'e2e/calculateur.visual.spec.ts'])).toEqual([
      '--update-snapshots',
      'e2e/calculateur.visual.spec.ts',
    ]);
  });

  it('never puts the filter in a shell string: the script is one constant, the filter is argv', () => {
    const typed = [
      [],
      ['--update'],
      ['--', 'e2e/calculateur.visual.spec.ts'],
      ['--', '--grep', 'erreur; touch /tmp/owned'],
      ['--', '--grep', '"$(id)" `id`'],
    ];

    for (const argv of typed) {
      const docker = dockerFor(argv);
      const scripts = docker.filter((value) => value === CONTAINER_SCRIPT);

      expect(scripts, `exactly one copy of THE script for ${JSON.stringify(argv)}`).toHaveLength(1);

      // Nothing typed is inside the script. The script never varies, so a
      // quote, a semicolon or a command substitution in a pattern stays one
      // argument to Playwright and is never parsed by bash.
      for (const token of argv.filter((value) => value !== '--')) {
        expect(CONTAINER_SCRIPT.includes(token), `${token} is not pasted into the script`).toBe(false);
      }
    }

    // And the script hands its parameters on, once, straight after the project.
    expect(CONTAINER_SCRIPT.split('"$@"')).toHaveLength(2);
    expect(CONTAINER_SCRIPT).toContain('pnpm exec playwright test --project=visual "$@" ');
  });

  it('passes the same environment whatever the filter, so nothing travels by environment', () => {
    const plain = environmentOf(dockerFor([]));

    expect(plain).toEqual(['CI=true', `NEXT_DIST_DIR=${RUN.distDir}`]);
    expect(environmentOf(dockerFor(['--', '--grep', 'erreur']))).toEqual(plain);
    expect(environmentOf(dockerFor(['--update', '--', 'e2e/og.visual.spec.ts']))).toEqual(plain);
  });

  it('refuses every option that is not a filter, naming it, before Docker is called', () => {
    // Each of these is accepted by Playwright and each would change what a
    // passing run MEANS rather than which tests run: compare nothing, write
    // baselines outside --update's R135/R208 report, change R345's retries,
    // break the count R133 reads, or run another project.
    const notFilters = [
      ['--ignore-snapshots'],
      ['--update-snapshots'],
      ['-u'],
      ['--retries=0'],
      ['--retries', '0'],
      ['--reporter=dot'],
      ['--project=chromium'],
      ['--pass-with-no-tests'],
      ['--grep-invert', 'erreur'],
      ['--max-failures=1'],
    ];

    for (const argv of notFilters) {
      const parsed = visualArguments(['--', ...argv]);

      expect(parsed.ok, `${argv.join(' ')} must be refused`).toBe(false);
      if (!parsed.ok) expect(parsed.why).toContain(argv[0]);
    }
  });

  it('refuses an empty or missing filter, which would match every spec and read as a filtered run', () => {
    for (const argv of [[''], ['  '], ['--grep'], ['--grep', ''], ['--grep='], ['-g', '--update'], ['--grep', '-u']]) {
      expect(visualArguments(['--', ...argv]).ok, JSON.stringify(argv)).toBe(false);
    }
  });
});

describe('R961: node_modules lives in a named volume, named from the lockfile hash', () => {
  const sha256 = createHash('sha256').update(LOCKFILE.replace(/\r\n/gu, '\n')).digest('hex');

  it('names the volume from the lockfile hash: an unchanged lockfile reuses, a changed one does not', () => {
    const cache = nodeModulesCache(LOCKFILE, IMAGE);

    expect(cache.volume).toBe(`monreleve-visual-node-modules-${sha256.slice(0, 16)}`);
    expect(cache.lockfileSha256).toBe(sha256);

    // A Docker volume name: [a-zA-Z0-9][a-zA-Z0-9_.-]+.
    expect(cache.volume).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/u);

    expect(nodeModulesCache(LOCKFILE, IMAGE).volume, 'the same lockfile, the same volume').toBe(cache.volume);
    expect(nodeModulesCache(`${LOCKFILE} `, IMAGE).volume, 'one byte more, another volume').not.toBe(cache.volume);

    // The CONTENT is hashed, not the checkout's line endings: two worktrees
    // with the same lockfile share one install whatever autocrlf did.
    const crlf = LOCKFILE.replace(/\r\n/gu, '\n').replace(/\n/gu, '\r\n');

    expect(nodeModulesCache(crlf, IMAGE).volume).toBe(cache.volume);
  });

  it('labels the volume with the product, and states what it caches', () => {
    const { labels } = nodeModulesCache(LOCKFILE, IMAGE);

    expect(labels).toEqual({
      'ch.monreleve.product': 'monreleve',
      'ch.monreleve.cache': 'visual-node-modules',
      'ch.monreleve.lockfile-sha256': sha256,
      'ch.monreleve.image': IMAGE,
    });
  });

  it('creates the volume with every label, by its exact name', () => {
    const cache = nodeModulesCache(LOCKFILE, IMAGE);

    expect(volumeCreateArguments(cache)).toEqual([
      'volume',
      'create',
      '--label',
      'ch.monreleve.product=monreleve',
      '--label',
      'ch.monreleve.cache=visual-node-modules',
      '--label',
      `ch.monreleve.lockfile-sha256=${sha256}`,
      '--label',
      `ch.monreleve.image=${IMAGE}`,
      cache.volume,
    ]);
  });

  it('mounts node_modules from the named volume, and keeps .next and the distDir per run', () => {
    expect(volumesOf(dockerFor([]))).toEqual([
      `${RUN.repo}:/repo`,
      `${RUN.volume}:/repo/web/node_modules`,
      // Anonymous, as R98 requires: the BUILD stays per run.
      '/repo/web/.next',
      `/repo/web/${RUN.distDir}`,
    ]);
  });

  it('reuses only its own volume for this lockfile, creates one that is absent, refuses any other', () => {
    const cache = nodeModulesCache(LOCKFILE, IMAGE);

    expect(volumeVerdict(null, cache)).toEqual({ action: 'create' });
    expect(volumeVerdict({ ...cache.labels }, cache)).toEqual({ action: 'reuse' });

    // A volume of that name this script did not make: not reused, not removed.
    const foreign = volumeVerdict({}, cache);

    expect(foreign.action).toBe('refuse');
    if (foreign.action === 'refuse') expect(foreign.why).toContain(cache.volume);

    // Ours, but for another lockfile or image: a 16-hex collision, or a hand
    // edit. Refused rather than trusted.
    for (const label of ['ch.monreleve.lockfile-sha256', 'ch.monreleve.image', 'ch.monreleve.product']) {
      const verdict = volumeVerdict({ ...cache.labels, [label]: 'something-else' }, cache);

      expect(verdict.action, label).toBe('refuse');
      if (verdict.action === 'refuse') expect(verdict.why).toContain(label);
    }
  });

  it('issues no docker volume command but inspect and create - never ls, prune or rm', () => {
    const code = withoutComments(readFileSync(join(WEB, 'scripts', 'visual.mjs'), 'utf8'));
    const volumeCommands = [...code.matchAll(/'volume',\s*'([a-z]+)'/gu)].map((match) => match[1]);

    // PRESENCE FIRST (R169's corollary): the scan sees both commands it is
    // about to bound, so the absences below are not satisfied by a scan that
    // reads nothing.
    expect(volumeCommands.sort()).toEqual(['create', 'inspect']);

    for (const verb of ['prune', 'ls', 'rm', 'remove', 'list']) {
      expect(code.includes(`'${verb}'`), `visual.mjs names '${verb}'`).toBe(false);
    }
  });
});
