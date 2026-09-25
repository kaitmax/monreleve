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
 * R111's recorded commands. Every CI check step maps to exactly one.
 *
 * Asserted to be exactly this list further down, so widening it is a
 * deliberate edit rather than a way to make a failure go away. It has been
 * widened twice, both times by a ruling: R118 added test:runtime, and R129
 * added size:dev.
 *
 * WHY size:dev IS ITS OWN TARGET AND NOT PART OF gate. R129 takes /dev/**
 * out of the production build, so `pnpm build` has no dev route and
 * `pnpm size` cannot measure GATE W or GATE I. The measurement needs a
 * SECOND full build, which is a minute of CI and a minute nobody wants on
 * every local gate run - so the ruling puts it in CI ("CI runs one
 * dev-enabled build") and this list records it as a command in its own
 * right rather than hiding a second build inside the first.
 */
const MAPPING_TARGETS = [
  'gate',
  'test:e2e',
  'test:visual',
  'test:a11y',
  'test:runtime',
  'size:dev',
  'db:deploy',
  'test:db',
  'test:container',
  'test:container:e2e',
  'test:container:scheduler',
  'test:container:restore',
  'test:container:write',
] as const;

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
  // FW28. The restore probe talks to a SUPPLIED server directly rather than
  // through the compose container CI does not have, so CI needs the client
  // binaries. It installs something and checks nothing, which is exactly what
  // this list is for.
  'sudo apt-get update && sudo apt-get install -y postgresql-client',
];

/**
 * Steps belonging to a job entirely outside the web/pnpm ecosystem (AN1
 * increment 6, the `android` job). MAPPING_TARGETS and ownersOf() are pnpm
 * scripts; a Gradle task can never be "mapped" by them even when it satisfies
 * R106's actual property - a command a developer runs locally and CI runs
 * VERBATIM, nothing paraphrased (R206). `./gradlew gate` (defined in
 * android/app/build.gradle.kts) is exactly that command: the aggregate task
 * the Android report names, verified below to be real rather than declared,
 * the same shape as the SETUP_STEPS/LOCAL_ONLY verification just above.
 */
const NON_WEB_STEPS: readonly string[] = ['./gradlew gate'];

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

  it('knows the mapping targets, and only those', () => {
    // EIGHT NOW, AND EACH WIDENING WAS A RULING OR A TASK THAT NEEDED ONE.
    //
    // R111 named four. R118 added test:runtime after the FW12 audit found
    // R81's production wiring was run by nothing at all: "Declaring it
    // local-only would have left it un-run in exactly the way it already
    // was."
    //
    // R129 added size:dev. /dev/** left the production build, so `pnpm size`
    // has no dev route to measure and GATE W and GATE I need a build of
    // their own. The alternative was a second build inside `gate`, which
    // doubles every local run for a number only CI needs.
    //
    // FW14 added db:deploy and test:db. test:db needs a running
    // PostgreSQL, so it cannot go inside gate without making the primary
    // loop command depend on a service - which is the road that ends in
    // somebody mocking the database to get pnpm test green. R132's
    // selector runs it locally whenever the database layer changes.
    //
    // db:deploy is a target rather than a SETUP_STEPS exemption, and the
    // guard below is why: an exemption has to look like an install, so
    // that "it only sets things up" can never be claimed for something
    // that checks. Applying migrations is a real command a developer runs,
    // and naming it here says so.
    //
    // The list is pinned so that widening it is an edit here with a reason,
    // never a way to make a failing mapping go quiet.
    //
    // R251 ADDED test:container, and the reason it is a TARGET rather than a
    // step inside `gate` is the same one that made size:dev its own: it costs
    // a docker build, and folding that into every local gate run is how a
    // check becomes something people route around. The selector runs it only
    // when the Dockerfile, .dockerignore or the entrypoint changed.
    //
    // It is NOT in LOCAL_ONLY, deliberately. Every entry there has a
    // STRUCTURAL reason CI cannot answer the question; a container has none,
    // and running it on a runner with no store cache and no image layers is
    // the closest thing to gate:clone's question that CI can ask.
    expect([...MAPPING_TARGETS]).toEqual([
      'gate',
      'test:e2e',
      'test:visual',
      'test:a11y',
      'test:runtime',
      'size:dev',
      'db:deploy',
      'test:db',
      'test:container',
      'test:container:e2e',
      'test:container:scheduler',
      'test:container:restore',
      // FW31/R256. It is in CI as REDUNDANCY: the claim it makes lives in
      // gate:clone, because this job has never passed, so a CI-only test
      // would be a test that does not exist.
      'test:container:write',
    ]);
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
  const steps = workflowSteps().filter(
    (step) => !SETUP_STEPS.includes(step) && !NON_WEB_STEPS.includes(step),
  );

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
  const steps = workflowSteps().filter(
    (step) => !SETUP_STEPS.includes(step) && !NON_WEB_STEPS.includes(step),
  );

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

describe('the non-web exemption is honest, not a blank check (AN1 increment 6)', () => {
  it('exempts only steps the workflow actually has', () => {
    const all = workflowSteps();

    for (const exempt of NON_WEB_STEPS) {
      expect(all, exempt).toContain(exempt);
    }
  });

  it('is exactly the one Gradle task, widening it is a deliberate edit', () => {
    // Pinned the same way MAPPING_TARGETS is: a second entry here should be a
    // reviewed addition, never a quiet way to excuse a new unmapped step.
    expect([...NON_WEB_STEPS]).toEqual(['./gradlew gate']);
  });

  it('names a task that is real, not merely declared (R133)', () => {
    // The claim this exemption makes is "this command exists and IS the
    // Android gate" - checked against the actual build file rather than
    // trusted, the same way SETUP_STEPS/LOCAL_ONLY entries are checked
    // against real scripts/package.json entries above.
    const buildFile = readFileSync(join(WEB, '..', 'android', 'app', 'build.gradle.kts'), 'utf8');

    expect(buildFile).toContain('tasks.register("gate")');
  });

  it('only exempts the android job, and that job stays gated like web (R156)', () => {
    // R156/R241: written and disabled behind the SAME variable as `web`,
    // never a new one - so this exemption cannot quietly cover a job that
    // pushes on its own trigger.
    const workflow = readFileSync(WORKFLOW, 'utf8');
    const androidJobMatch = /^ {2}android:\n([\s\S]*?)\n {2}\S/m.exec(`${workflow}\n  z`);

    expect(androidJobMatch, 'expected an `android:` job in the workflow').not.toBeNull();
    expect(androidJobMatch?.[1]).toContain("vars.CI_FULL == 'on'");
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

// ---------------------------------------------------------------------------
// THE REVERSE DIRECTION, found by ruling R112's audit.
//
// R106 and R111 assert CI -> local: every workflow step is run by one of the
// four. Nothing asserted local -> CI, and the audit found what fell through
// it: `pnpm test:runtime` exists, runs ruling R81's runtime guard against a
// deliberately misconfigured server, and is invoked by NOTHING - not the
// workflow, not gate, not the recorded five. Those wiring assertions - the
// sitemap refusing with 503, the canonical omitted, the health route
// reachable - have not run since FW10 wrote them.
//
// R112's rule is the general form: anything removed from one verification
// layer is NAMED and picked up by another. A check command nobody runs is the
// same failure with the layers swapped, so every check script must now be
// accounted for: run by CI, or listed here with the reason it is not.
// ---------------------------------------------------------------------------

/**
 * Check commands that deliberately do not run in CI, and why.
 *
 * test:runtime WAS HERE and is not any more. It was listed with the reason
 * "needs a server in a deliberately broken configuration", which was true and
 * was not a reason - ruling R118: "a guard that hasn't run since FW10 is a
 * guard we don't have", and the config starts that server itself, so the job
 * is install plus one command. Declaring it local-only would have left it
 * un-run in exactly the way it already was.
 */
const LOCAL_ONLY: Record<string, string> = {
  test:
    'The fast inner-loop form. CI runs test:coverage, which is a strict ' +
    'superset - the same suite plus the 100% thresholds - so a pass here that ' +
    'failed there is impossible.',
  'test:visual:update':
    'Writes baselines rather than checking them. Running it in CI would mean ' +
    'CI deciding what the product looks like, which is the whole failure ' +
    'ruling R114 forbids in its other form.',
  'test:late':
    'R182 re-runs two checks AFTER test:visual, because the visual run ' +
    'rewrites the artefacts they read - tsconfig.json, next-env.d.ts and ' +
    'og-card.png. THE HAZARD IS THE SHARED LOCAL WORKING TREE: the gate chain ' +
    'runs pnpm test and test:visual one after the other in one directory. CI ' +
    'runs each job in its own fresh checkout and calls playwright directly ' +
    'rather than through scripts/visual.mjs, so no CI job can see another ' +
    'job leak into its files. Running it there would assert nothing.',
  'test:clean-tree':
    'CI is already a fresh checkout, so moving the generated directories ' +
    'aside there would assert nothing (R94).',
};

describe('every check command is accounted for (R112, reverse direction)', () => {
  /** Scripts that look like a check rather than a build step or a helper. */
  const checkScripts = Object.keys(PACKAGE.scripts).filter((name) =>
    /^(test|lint|typecheck|size|parity)/.test(name),
  );

  it('finds the check scripts, so nothing below passes vacuously', () => {
    expect(checkScripts.length).toBeGreaterThanOrEqual(8);
    expect(checkScripts).toContain('test:runtime');
  });

  it.each(checkScripts)('%s is run by CI or listed as local-only', (name) => {
    const inCi = MAPPING_TARGETS.some((target) => reachableFrom(target).has(name));
    const declared = Object.prototype.hasOwnProperty.call(LOCAL_ONLY, name);

    expect(
      inCi || declared,
      `"pnpm ${name}" is run by no CI-mapped command and is not declared ` +
        'local-only. Either add it to CI, or add it to LOCAL_ONLY with the ' +
        'reason - a check nobody runs is a guard in name only.',
    ).toBe(true);
  });

  it('gives every local-only entry a reason worth reading', () => {
    for (const [name, reason] of Object.entries(LOCAL_ONLY)) {
      expect(PACKAGE.scripts[name], `${name} is listed but does not exist`).toBeDefined();
      expect(reason.length, name).toBeGreaterThan(40);
    }
  });

  it('does not excuse anything that IS run by CI', () => {
    // A stale entry here would quietly permit a command to leave CI later.
    for (const name of Object.keys(LOCAL_ONLY)) {
      const inCi = MAPPING_TARGETS.some((target) => reachableFrom(target).has(name));

      expect(inCi, `${name} is declared local-only but CI runs it`).toBe(false);
    }
  });
});
