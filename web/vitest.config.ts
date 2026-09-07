// web/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Reads the paths block out of tsconfig.json, so a test that imports
    // through "@/..." proves the real alias rather than a second one
    // declared here.
    tsconfigPaths: true,
  },
  test: {
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    environment: 'node',

    coverage: {
      provider: 'v8',
      // The engine, and from FW6 lib/ui/core - which is the commitment this
      // block's previous comment made ("lib/ui and app/ get their own gates
      // when they have behaviour to cover (FW6 onward)"), come due now that
      // zones.ts and the formatters exist. app/ still has none: it holds one
      // placeholder page.
      include: ['lib/calc-engine/**', 'lib/ui/core/**'],
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
