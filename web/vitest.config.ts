// web/vitest.config.ts
import { cpus } from 'node:os';
import { defineConfig } from 'vitest/config';

/**
 * RULING R99: "gate commands run with a worker cap (half the cores) so they
 * cannot be starved."
 *
 * WHAT HAPPENED WITHOUT IT. pnpm test:clean-tree was run immediately after a
 * Playwright container finished. Vitest spawned one fork per test file - 67 of
 * them - against a machine still winding a container down. One exhaustive
 * property test timed out at 5 s having taken 5 177 ms, and THREE workers
 * never started at all ("Timeout waiting for worker to respond"). The run
 * reported a failure that had nothing to do with the code, and a failure of
 * that shape is worse than a slow suite: it teaches whoever sees it that red
 * sometimes means nothing.
 *
 * HALF THE CORES, not a fixed number, because this runs on a laptop and in CI
 * and the right cap is a fraction of what is there. Minimum one, so a
 * single-core runner still works.
 */
const WORKER_CAP = Math.max(1, Math.floor(cpus().length / 2));

export default defineConfig({
  resolve: {
    // Reads the paths block out of tsconfig.json, so a test that imports
    // through "@/..." proves the real alias rather than a second one
    // declared here.
    tsconfigPaths: true,
  },
  test: {
    // R99. Applied to EVERY run rather than only the gate commands: a cap that
    // holds sometimes is a cap nobody can rely on, and the failure it prevents
    // is a false red, which costs more than the seconds it adds.
    maxWorkers: WORKER_CAP,
    // .tsx as well as .ts: FW8's component tests are .test.tsx, and a glob
    // ending in .test.ts does not match them. The failure mode is the quiet
    // one - `pnpm test` still exits 0 while asserting nothing.
    include: ['tests/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    environment: 'node',

    // FW13: every DOM test starts at a bare URL. The calculator seeds from
    // window.location.search and writes back to it, and jsdom gives a whole
    // test FILE one window - so without this, one test leaves a scenario in
    // the address bar and the next one renders it. Nine assertions in
    // accessibility-calculateur.test.tsx failed exactly that way. The file
    // itself carries the measurement.
    setupFiles: ['tests/setup/address-bar.ts'],

    coverage: {
      provider: 'v8',
      // The engine, and from FW6 lib/ui/core - which is the commitment this
      // block's previous comment made ("lib/ui and app/ get their own gates
      // when they have behaviour to cover (FW6 onward)"), come due now that
      // zones.ts and the formatters exist. app/ still has none: it holds one
      // placeholder page.
      include: ['lib/calc-engine/**', 'lib/ui/core/**'],

      // TYPE-PROOF FILES ARE COMPILED, NOT EXECUTED, so there is nothing in
      // them to cover. lib/ui/core/format/number.types.ts asserts - through a
      // ts-expect-error directive, ruling R65 - that formatPercent's precision
      // is required (R97). Its statements never run in a test and never
      // should: the compiler is the assertion.
      //
      // (Written without the at-sign deliberately. A comment line BEGINNING
      // with the at-sign form IS a directive to tsc whatever the sentence
      // around it means, and this one earned a TS2578 on its first run -
      // prose about a mechanism invoking the mechanism, for the second time
      // this session after a no-break space typed into a comment about
      // no-break spaces.)
      //
      // Counting them pushed lib/ui/core from 100% to 97,1% and would leave
      // exactly two ways out, both bad: write a test that imports the file
      // only to satisfy a number, or delete the proof. Excluding them keeps
      // the 100% bar meaningful for code that actually runs.
      //
      // They are not unguarded: tsc compiles them on every typecheck, and
      // tests/unit/ui-core/format-number.test.ts asserts this one still
      // exists and still carries both directives.
      exclude: ['**/*.types.ts'],
      reporter: ['text'],

      // PER-DIRECTORY, not global. A single global threshold over both trees
      // would let a gap in one be paid for by the other, which is exactly
      // the average SPEC 7.6 refuses. Each directory answers for itself.
      //
      // SPEC 7.6: "100% statement and branch coverage - not an aspiration."
      // That is stated for lib/calc-engine. lib/ui/core is held to the same
      // bar because it reaches it today, measured, and because the alternative
      // is choosing an arbitrary number below it. FW7 adds renderRailSvg here
      // and inherits the gate.
      thresholds: {
        'lib/calc-engine/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'lib/ui/core/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
