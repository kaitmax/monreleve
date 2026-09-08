// web/playwright.runtime.config.ts
//
// RULING R81's proof: "Playwright proof against `next start` with the marker
// set and NEXT_PUBLIC_SITE_URL unset."
//
// A SEPARATE CONFIG, and not a project in playwright.config.ts, for one
// reason: this suite needs a server started with DIFFERENT ENVIRONMENT than
// every other suite. playwright.config.ts starts one server on :3000 without
// the marker, and the whole point here is a server WITH it. Two webServer
// entries in one config start in parallel and would race over the build
// directory; a project cannot change the env of a server it shares.
//
// Port 3101, so it cannot collide with a dev server on 3000 or with the main
// e2e suite if both run.
//
// It is its own script - `pnpm test:runtime` - and part of the verification
// chain rather than of `pnpm test:e2e`. A reader running the normal e2e suite
// should not be surprised by a server in a deliberately broken configuration.

import { defineConfig, devices } from '@playwright/test';

const PORT = 3101;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.runtime.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'runtime-guard', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // `next start`, not `next dev`: R81 is about a SERVING process, and the
    // dev server has different metadata behaviour. The build runs first
    // because the marker must not be set during it - R81 keeps the build-time
    // fallback, and baking the marker in would test the wrong thing.
    command: 'node scripts/copy-fonts.mjs && next build && next start -p 3101',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      // The two conditions R81 names, together. Deliberately NOT setting
      // NEXT_PUBLIC_SITE_URL is half the test, so it is written down here
      // rather than left to the ambient environment - if a developer has it
      // exported, this suite must still see it absent.
      FRONTALIER_RUNTIME: '1',
      NEXT_PUBLIC_SITE_URL: '',
    },
  },
});
