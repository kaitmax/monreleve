// web/tests/unit/meta/gate-covers-ci.test.ts
//
// RULING R106: THE GATE IS DERIVED FROM THE WORKFLOW. A test parses
// .github/workflows/ci.yml and asserts every job step is covered locally.
// "Divergence is a test failure, not a report claim."
//
// WHY THIS EXISTS, and it is not hypothetical. R94 says "the local gate is the
// CI command", and FW11's report asserted that it was. It was not: CI also
// runs pnpm parity:check on two Node majors and pnpm gate did not, so CI
// failed on eight consecutive commits while every local gate ran green. The
// claim was in a report, where nothing can check it. It is now in a test.
//
// COVERED BY THE RECORDED LOCAL COMMAND SET, not by pnpm gate alone - which is
// a deliberate reading of R106 and is stated rather than assumed. The visual
// job needs Docker, and folding it into pnpm gate would make the ordinary
// gate unrunnable without a container. So the set is the four commands every
// report already quotes - gate, test:visual, test:a11y, test:clean-tree - and
// LOCAL_ENTRY_POINTS below is asserted to be exactly those four, so widening
// it is a deliberate edit rather than a way to make this test pass.
//
// NO YAML PARSER. None is installed and adding a dependency is an ask-first
// item under SPEC 20, so the run steps are read with a line scanner. That is
// only safe with the non-vacuity assertion below: a workflow reformatted into
// block scalars would make a naive scanner find NOTHING and report every step
// covered, which is the exact failure shape ruling R63 exists to catch.

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
 * The commands a session is expected to run before committing.
 *
 * Asserted to be exactly this list further down. Adding one here is how a new
 * kind of check becomes locally required; it is not a way to silence a
 * failure, because the assertion names them.
 */
const LOCAL_ENTRY_POINTS = ['gate', 'test:visual', 'test:a11y', 'test:clean-tree'] as const;

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
  return readFileSync(WORKFLOW, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- run:'))
    .map((line) => line.slice('- run:'.length).trim())
    .filter((command) => command !== '' && !command.startsWith('|'));
}

/** Script names reachable from the entry points, following `pnpm <name>`. */
function reachableScripts(): ReadonlySet<string> {
  const found = new Set<string>();
  const queue = [...LOCAL_ENTRY_POINTS] as string[];

  while (queue.length > 0) {
    const name = queue.pop();

    if (name === undefined || found.has(name)) continue;

    const command = PACKAGE.scripts[name];

    if (command === undefined) continue;

    found.add(name);

    // `pnpm <name>` inside a script chain, which is how gate composes.
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
 * Everything the local command set actually executes, as text.
 *
 * The script bodies are included, not only the package.json commands, because
 * one local command reaches CI's work indirectly: pnpm test:visual runs
 * scripts/visual.mjs, which runs `pnpm exec playwright test --project=visual`
 * INSIDE the container - the same string CI runs directly. Without the file
 * contents this test would report the visual job uncovered and be wrong.
 */
function localCorpus(): string {
  const parts: string[] = [];

  for (const name of reachableScripts()) {
    const command = PACKAGE.scripts[name] ?? '';

    parts.push(command);

    for (const match of command.matchAll(/scripts\/[\w.-]+\.mjs/g)) {
      parts.push(readFileSync(join(WEB, match[0]), 'utf8'));
    }
  }

  return parts.join('\n');
}

/** Is this workflow step run by something in the local set? */
function isCovered(step: string): boolean {
  const scripts = reachableScripts();
  const asScript = /^pnpm ([\w:-]+)/.exec(step);
  const name = asScript?.[1];

  // `pnpm test:floor -- --report ...` is the same script with other
  // arguments, so the name is what matters, not the whole line.
  if (name !== undefined && PACKAGE.scripts[name] !== undefined) {
    return scripts.has(name);
  }

  // Anything else - `pnpm exec ...`, a bare `node ...` - has to appear
  // verbatim in something the local set runs.
  return localCorpus().includes(step);
}

describe('the workflow was parsed at all', () => {
  it('finds the run steps, so nothing below can pass vacuously', () => {
    const steps = workflowSteps();

    expect(steps.length).toBeGreaterThanOrEqual(11);
    expect(steps).toContain('pnpm typecheck');
    expect(steps).toContain('pnpm parity:build');
  });

  it('knows the four local entry points, and only those', () => {
    expect([...LOCAL_ENTRY_POINTS]).toEqual([
      'gate',
      'test:visual',
      'test:a11y',
      'test:clean-tree',
    ]);
    for (const name of LOCAL_ENTRY_POINTS) {
      expect(PACKAGE.scripts[name], name).toBeDefined();
    }
  });

  it('reaches the scripts the entry points compose', () => {
    const scripts = reachableScripts();

    // gate composes eight of these; if the chain stopped being followed this
    // test would pass every coverage assertion by finding nothing.
    expect(scripts.has('typecheck')).toBe(true);
    expect(scripts.has('parity:check')).toBe(true);
    expect(scripts.has('parity:build')).toBe(true);
    expect(scripts.size).toBeGreaterThanOrEqual(10);
  });
});

describe('every CI check step is run locally too (R106)', () => {
  const steps = workflowSteps().filter((step) => !SETUP_STEPS.includes(step));

  it('has check steps left after the setup ones are removed', () => {
    expect(steps.length).toBeGreaterThanOrEqual(9);
  });

  it.each(steps)('%s', (step) => {
    expect(
      isCovered(step),
      `CI runs "${step}" and no local command does. Add it to one of: ${LOCAL_ENTRY_POINTS.join(', ')}.`,
    ).toBe(true);
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
