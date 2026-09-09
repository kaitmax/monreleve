// web/tests/unit/meta/gate-covers-ci.test.ts
//
// RULINGS R106 and R111: THE GATE IS DERIVED FROM THE WORKFLOW. A test parses
// .github/workflows/ci.yml and asserts every job step is run locally.
// "Divergence is a test failure, not a report claim."
//
// WHY THIS EXISTS, and it is not hypothetical. R94 said "the local gate is the
// CI command", and FW11's report ASSERTED that it was. It was not: CI also ran
// pnpm parity:check on two Node majors and pnpm gate did not, so CI failed on
// eight consecutive commits while every local gate ran green. The claim lived
// in a report, where nothing can check it. It lives in a test now.
//
// R111 REFINES THE PROPERTY, and the refinement is the interesting part.
// Single-command coverage was the wrong target: putting the container inside
// pnpm gate would make the primary loop command slow enough that people route
// around it, "and a gate people skip is worse than a gate with a documented
// seam". So the derivation is TOTAL BUT DISTRIBUTED across four recorded
// commands, and two things are asserted:
//
//   TOTALITY     every workflow check step maps to one of the four. No step
//                unmapped - that is the property the eight-commit failure
//                broke.
//   EXCLUSIVITY  each step maps to EXACTLY one. Two owners means nobody can
//                say which command is responsible for a step, and a step with
//                two owners is one deletion away from having none.
//
// EXCLUSIVITY COST A CHANGE TO gate, recorded because it is a real one. gate
// used to chain pnpm test:e2e, so that step had two owners. e2e builds the app
// and starts a server, which is the same "slow enough to route around"
// argument R111 makes about Docker - so it comes out of gate and stands as its
// own recorded command. The local sequence is five commands now, not four; the
// fifth is test:clean-tree, which has no CI step at all and is therefore not a
// mapping target. See the block at the bottom for why.
//
// NO YAML PARSER. None is installed and adding a dependency is an ask-first
// item under SPEC 20, so the run steps are read with a line scanner. That is
// only safe with the non-vacuity assertion below: a workflow reformatted into
// block scalars would make a naive scanner find NOTHING and report every step
// mapped, which is the exact failure shape ruling R63 exists to catch.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = process.cwd();
const WORKFLOW = join(WEB, '..', '.github', 'workflows', 'ci.yml');

const PACKAGE = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')) as {
  readonly scripts: Record<string, string>;
};

/**
 * Read a tsconfig, which is JSONC.
 *
 * tsc permits comments in these files and JSON.parse does not - the first
 * version of this test threw "Expected property name" on the very config it
 * was written to check. Only WHOLE-LINE comments are stripped: a general
 * comment stripper would eat the // inside a URL, and being narrow here costs
 * nothing because that is the only form these files use.
 */
function readTsconfig(file: string): {
  readonly compilerOptions: Record<string, unknown>;
  readonly include: readonly string[];
} {
  const NEWLINE = String.fromCharCode(10);
  const stripped = readFileSync(join(WEB, file), 'utf8')
    .split(NEWLINE)
    .filter((line) => !line.trim().startsWith('//'))
    .join(NEWLINE);

  return JSON.parse(stripped) as {
    readonly compilerOptions: Record<string, unknown>;
    readonly include: readonly string[];
  };
}

/**
 * R111's four. Every CI check step maps to exactly one of these.
 *
 * Asserted to be exactly this list further down, so widening it is a
 * deliberate edit rather than a way to make a failure go away.
 */
const MAPPING_TARGETS = ['gate', 'test:e2e', 'test:visual', 'test:a11y'] as const;

type MappingTarget = (typeof MAPPING_TARGETS)[number];

/**
 * Workflow steps that set the environment up rather than check anything.
 *
 * Kept as exact strings, not patterns: "anything containing install" would
 * also excuse a future step that installed and then checked something.
 */
const SETUP_STEPS: readonly string[] = [
  'pnpm install --frozen-lockfile',
  'pnpm exec playwright install --with-deps chromium',
];

/** Every `- run:` command in the workflow, in order. */
function workflowSteps(): readonly string[] {
  const NEWLINE = String.fromCharCode(10);

  return readFileSync(WORKFLOW, 'utf8')
    .split(NEWLINE)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- run:'))
    .map((line) => line.slice('- run:'.length).trim())
    .filter((command) => command !== '' && !command.startsWith('|'));
}

/** Script names reachable from one command, following `pnpm <name>` chains. */
function reachableFrom(entry: string): ReadonlySet<string> {
  const found = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const name = queue.pop();

    if (name === undefined || found.has(name)) continue;

    const command = PACKAGE.scripts[name];

    if (command === undefined) continue;

    found.add(name);

    for (const match of command.matchAll(/pnpm ([\w:-]+)/g)) {
      const referenced = match[1];

      if (referenced !== undefined && PACKAGE.scripts[referenced] !== undefined) {
        queue.push(referenced);
      }
    }
  }

  return found;
}

/**
 * Everything one command actually executes, as text.
 *
 * The script BODIES are included, not only the package.json commands, because
 * one target reaches CI's work indirectly: pnpm test:visual runs
 * scripts/visual.mjs, which runs `pnpm exec playwright test --project=visual`
 * INSIDE the container - the same string CI runs directly. Without the file
 * contents this test would call the visual job unmapped and be wrong.
 */
function corpusOf(entry: string): string {
  const NEWLINE = String.fromCharCode(10);
  const parts: string[] = [];

  for (const name of reachableFrom(entry)) {
    const command = PACKAGE.scripts[name] ?? '';

    parts.push(command);

    for (const match of command.matchAll(/scripts\/[\w.-]+\.mjs/g)) {
      parts.push(readFileSync(join(WEB, match[0]), 'utf8'));
    }
  }

  return parts.join(NEWLINE);
}

/**
 * Which of the four run this step. DERIVED, never declared.
 *
 * A hand-written map from step to owner would be the same kind of unchecked
 * claim as the report sentence this test replaces: it would say what somebody
 * believed rather than what the scripts do.
 */
function ownersOf(step: string): readonly MappingTarget[] {
  const asScript = /^pnpm ([\w:-]+)/.exec(step);
  const name = asScript?.[1];

  return MAPPING_TARGETS.filter((target) => {
    // `pnpm test:floor -- --report ...` is the same script with other
    // arguments, so the name is what matters, not the whole line.
    if (name !== undefined && PACKAGE.scripts[name] !== undefined) {
      return reachableFrom(target).has(name);
    }

    // Anything else - `pnpm exec ...`, a bare `node ...` - has to appear
    // verbatim in something the target runs.
    return corpusOf(target).includes(step);
  });
}

describe('the workflow was parsed at all', () => {
  it('finds the run steps, so nothing below can pass vacuously', () => {
    const steps = workflowSteps();

    expect(steps.length).toBeGreaterThanOrEqual(11);
    expect(steps).toContain('pnpm typecheck');
    expect(steps).toContain('pnpm parity:build');
  });

  it('knows R111 four mapping targets, and only those', () => {
    expect([...MAPPING_TARGETS]).toEqual(['gate', 'test:e2e', 'test:visual', 'test:a11y']);
    for (const name of MAPPING_TARGETS) {
      expect(PACKAGE.scripts[name], name).toBeDefined();
    }
  });

  it('follows the chains inside a target', () => {
    // gate composes several scripts. If the chain stopped being followed this
    // test would call every step unmapped, which fails loudly rather than
    // quietly - but the assertion is here so the reason is visible.
    const gate = reachableFrom('gate');

    expect(gate.has('typecheck')).toBe(true);
    expect(gate.has('parity:check')).toBe(true);
    expect(gate.has('parity:build')).toBe(true);
    expect(gate.size).toBeGreaterThanOrEqual(7);
  });
});

describe('TOTALITY - every CI check step is run locally (R106)', () => {
  const steps = workflowSteps().filter((step) => !SETUP_STEPS.includes(step));

  it('has check steps left after the setup ones are removed', () => {
    expect(steps.length).toBeGreaterThanOrEqual(9);
  });

  it.each(steps)('%s is mapped', (step) => {
    expect(
      ownersOf(step).length,
      `CI runs "${step}" and none of ${MAPPING_TARGETS.join(', ')} does.`,
    ).toBeGreaterThan(0);
  });
});

describe('EXCLUSIVITY - each step has exactly one owner (R111)', () => {
  const steps = workflowSteps().filter((step) => !SETUP_STEPS.includes(step));

  it.each(steps)('%s has one owner', (step) => {
    const owners = ownersOf(step);

    expect(
      owners.length,
      `"${step}" is run by ${owners.length} of the four (${owners.join(', ')}). ` +
        'Two owners means nobody can say which command is responsible, and a ' +
        'step with two owners is one deletion away from having none.',
    ).toBe(1);
  });

  it('distributes the steps across more than one target', () => {
    // Otherwise "exactly one owner" would be satisfied by a single command
    // running everything, which is the arrangement R111 rejects.
    const owners = new Set(steps.flatMap((step) => ownersOf(step)));

    expect(owners.size).toBeGreaterThanOrEqual(3);
  });
});

describe('the setup exemptions are honest', () => {
  it('exempts only steps the workflow actually has', () => {
    // A stale exemption is worse than none: it would sit there excusing a step
    // that had been renamed into something real and unchecked.
    const all = workflowSteps();

    for (const exempt of SETUP_STEPS) {
      expect(all, exempt).toContain(exempt);
    }
  });

  it('exempts nothing that looks like a check', () => {
    for (const exempt of SETUP_STEPS) {
      expect(exempt, exempt).toMatch(/install/);
    }
  });
});

describe('test:clean-tree is local-only, and that is deliberate', () => {
  it('exists, and is not one of the four', () => {
    // R94's discipline: run the suite with the generated directories moved
    // aside, because CI has a fresh checkout. There is no CI STEP for it - CI
    // IS a fresh checkout, so the check would be tautological there - which is
    // why it is not a mapping target, and why saying so here is better than
    // leaving somebody to wonder whether it was forgotten.
    expect(PACKAGE.scripts['test:clean-tree']).toBeDefined();
    expect([...MAPPING_TARGETS]).not.toContain('test:clean-tree');
  });
});

// ---------------------------------------------------------------------------
// RULING R107, the drift half. Bringing scripts/*.mjs under checkJs closes the
// hole that let R97 be enforced as a compile error while a caller went
// unchecked - but only for as long as the config still points at them. These
// assertions are what would notice the include narrowing, checkJs being turned
// off, or typecheck quietly dropping the second project.
// ---------------------------------------------------------------------------

describe('the uncompiled scripts are type-checked (R107)', () => {
  const SCRIPTS_PROJECT = 'tsconfig.scripts.json';

  const project = readTsconfig(SCRIPTS_PROJECT);

  it('is run by pnpm typecheck, which is what CI invokes', () => {
    // Not by a script of its own: CI runs `pnpm typecheck` and nothing else
    // would have picked a new project up. This is the same mistake as the
    // parity job in a different costume.
    expect(PACKAGE.scripts.typecheck).toContain(SCRIPTS_PROJECT);
  });

  it('has checkJs on, or it is checking nothing', () => {
    expect(project.compilerOptions.checkJs).toBe(true);
    expect(project.compilerOptions.allowJs).toBe(true);
  });

  it('covers every script by glob rather than by a list', () => {
    // A list would go stale the first time somebody adds a script. The glob
    // cannot, which is why the include is asserted rather than the files.
    expect(project.include).toContain('scripts/**/*.mjs');
  });

  it('has scripts to check, so the glob is not pointing at an empty tree', () => {
    const scripts = readdirSync(join(WEB, 'scripts')).filter((name) => name.endsWith('.mjs'));

    expect(scripts.length).toBeGreaterThanOrEqual(5);
    expect(scripts).toContain('check-format-parity.mjs');
  });

  it('keeps the typed boundary at the dynamic import', () => {
    // THE ASSERTION THAT MATTERS MOST HERE, because checkJs alone does not do
    // the job. check-format-parity.mjs loads the built output through a
    // dynamic import of a computed path, which TypeScript types as any - so
    // without a JSDoc @type pointing at the source module, every formatter is
    // any again and any arity is legal. That is exactly how
    // formatPercent(100) survived R97 and failed CI for eight commits.
    const source = readFileSync(join(WEB, 'scripts', 'check-format-parity.mjs'), 'utf8');

    expect(source).toContain("@type {typeof import('../lib/ui/core/format/number')}");
    expect(source).toContain("@type {typeof import('../lib/ui/core/format/date')}");
  });
});
