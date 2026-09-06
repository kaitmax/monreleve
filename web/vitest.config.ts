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
  },
});
