// web/tests/unit/meta/visual-filter-gates.test.ts
//
// R962: THE GATE STILL RUNS THE FULL SUITE. gate:changed and gate:clone pass
// no filter, and this file asserts it, so a filter cannot leak into a gate.
//
// WHY IT NEEDS SAYING. R960 gave scripts/visual.mjs a filter: `pnpm
// test:visual -- <spec or --grep>` runs only what was named, which is the
// point for a session proving one page. The same mechanism inside a gate would
// be a green that measured a fraction of the suite and looked like all of it -
// the FW13 shape R132 exists to prevent, arriving through an argument instead
// of a missing rule.
//
// HOW A FILTER COULD REACH A GATE, and what holds each path shut:
//
//   gate:changed's command. It runs `pnpm ${suite}` for every suite it
//   selects. The suite is a bare script name, the command is built from it and
//   nothing else, and the gate forwards none of its own arguments. Asserted
//   below by reading the script, because it runs the gate on import and so
//   cannot be imported (R221's note in gate-selection.mjs).
//
//   gate:clone's steps. It runs no visual step at all - the suite needs the
//   Playwright container (R98) and is NAMED as not run, with the claim the run
//   therefore does not make. Asserted below, presence first.
//
//   The environment. A gate runs with the shell's environment, so a filter read
//   from an environment variable would ride into a gate unseen. visual.mjs
//   reads none: its filter comes from argv alone.
//
//   package.json. `test:visual` is `node scripts/visual.mjs` with nothing
//   after it, so `pnpm test:visual` hands the script an empty argv - which
//   visual.mjs's own parser reads as the full suite.
//
// THE FLOOR IS A SECOND LINE, NOT THE FIRST. gate:changed holds test:visual to
// scripts/suite-floor.json, so a filtered count would likely fail it - but a
// filter naming enough specs would not, and "the floor would probably notice"
// is the judgement version of a rule. This file is the rule.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVERY_SUITE, selectSuites } from '../../../scripts/gate-selection.mjs';
import { visualArguments } from '../../../scripts/visual.mjs';
import { withoutComments } from '@/tests/support/quoted-spans';

const WEB = join(import.meta.dirname, '..', '..', '..');

/** A script's code with its comments removed, so prose about a filter is not read as one. */
const codeOf = (path: string): string => withoutComments(readFileSync(join(WEB, path), 'utf8'));

const PACKAGE = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('R962: gate:changed runs `pnpm test:visual` with nothing after it', () => {
  const gate = codeOf('scripts/gate-for-changes.mjs');

  it('starts processes in one place, and that place spawns the command it is given', () => {
    const spawns = [...gate.matchAll(/\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync)\(([^,)]*)/gu)].map(
      (match) => (match[1] ?? '').trim(),
    );

    expect(spawns).toEqual(['command']);
    expect(gate).toMatch(/function run\(command\) \{/u);
  });

  it('builds every command from the selected suite name and nothing else', () => {
    const calls = [...gate.matchAll(/\brun\(([^)]*)\)/gu)]
      .map((match) => (match[1] ?? '').trim())
      .filter((argument) => argument !== 'command');

    // PRESENCE: the one call is found, so "no other argument" is not satisfied
    // by a scan that matched nothing.
    expect(calls).toEqual(['`pnpm ${suite}`']);
    expect(gate).toMatch(/for \(const suite of selection\.suites\)/u);
  });

  it('forwards none of its own arguments', () => {
    const reads = [...gate.matchAll(/process\.argv[^;\n]*/gu)].map((match) => match[0]);

    expect(reads).toEqual(["process.argv.includes('--print')"]);
  });

  it('selects test:visual by its bare name, so the command is exactly `pnpm test:visual`', () => {
    for (const suite of EVERY_SUITE) {
      expect(suite, 'a suite is a script name, never a command with arguments').toMatch(
        /^[a-z]+(?::[a-z0-9]+)*$/u,
      );
    }

    // A path that selects the visual suite, so the name below is the one the
    // gate really emits rather than one this test typed.
    const { suites } = selectSuites(['web/e2e/home.visual.spec.ts']);

    expect(suites.filter((suite) => suite.includes('visual'))).toEqual(['test:visual']);
  });

  it('and `pnpm test:visual` with nothing after it is the full suite', () => {
    expect(PACKAGE.scripts['test:visual']).toBe('node scripts/visual.mjs');
    expect(visualArguments([])).toEqual({ ok: true, update: false, filter: [] });
  });
});

describe('R962: gate:clone passes no filter, because it runs no visual step', () => {
  const clone = codeOf('scripts/gate-clone.mjs');
  const parts = codeOf('scripts/gate-clone-parts.mjs');

  /** Every `[label, 'pnpm', [args...]` step tuple in the chain. */
  const steps = [...clone.matchAll(/\[\s*'([^']+)',\s*'pnpm',\s*\[([^\]]*)\]/gu)].map((match) => ({
    label: match[1] ?? '',
    args: [...(match[2] ?? '').matchAll(/'([^']*)'/gu)].map((argument) => argument[1] ?? ''),
  }));

  it('reads its steps at all, so the absence below means something', () => {
    expect(steps.map((step) => step.args[0])).toEqual(
      expect.arrayContaining([
        'install',
        'typecheck',
        'lint',
        'test',
        'build',
        'size',
        'db:deploy',
        'test:db',
        'test:container:write',
      ]),
    );
  });

  it('runs no visual step, here or in its parts', () => {
    for (const step of steps) {
      expect(step.args.join(' '), step.label).not.toMatch(/visual/u);
    }

    for (const source of [clone, parts]) {
      expect(source).not.toMatch(/visual\.mjs|--project=visual|'test:visual:update'/u);
    }

    expect(parts, 'the parts module was read').toMatch(/export function readStepSummary/u);
  });

  it('names the visual suite as NOT run, with the reason', () => {
    expect(clone).toMatch(/\[\s*'test:visual',\s*'needs the Playwright Docker container/u);
  });
});

describe('R962: visual.mjs takes its filter from argv alone', () => {
  const visual = codeOf('scripts/visual.mjs');

  it('reads the filter from its own argv', () => {
    expect(visual).toMatch(/visualArguments\(process\.argv\.slice\(2\)\)/u);
  });

  it('reads no environment variable, so a shell cannot hand a gate a filter', () => {
    expect(visual).not.toMatch(/process\.env|import\.meta\.env/u);
  });
});
