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
      // The engine only. SPEC 7.6 requires 100 % here and nowhere else yet;
      // lib/ui and app/ get their own gates when they have behaviour to
      // cover (FW6 onward). Measuring everything would dilute this one into
      // an average nobody can act on.
      include: ['lib/calc-engine/**'],
      reporter: ['text'],

      // SPEC 7.6: "100% statement and branch coverage - not an aspiration."
      // A drop below any of these fails the run, and CI runs it as a
      // blocking step.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
