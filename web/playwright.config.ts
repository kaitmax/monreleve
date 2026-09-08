// web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // The R81 runtime-guard suite is excluded here and run by
  // playwright.runtime.config.ts, which starts a server with
  // FRONTALIER_RUNTIME=1 and no origin. Collected by this config it would
  // run against a correctly configured server and assert the opposite of
  // what is true.
  testIgnore: '**/*.runtime.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // The html reporter is what writes playwright-report/, which CI uploads as
  // an artifact; 'list' alone would make that upload step silently empty.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  // RULING R37: screenshot baselines are generated and compared ONLY inside
  // the Playwright Linux container (pnpm test:visual / test:visual:update).
  // Baselines produced against a Windows or macOS font stack and compared on
  // Linux CI are a permanent source of false red - and the failure is not a
  // diff but a MISSING FILE, because Playwright's default template carries
  // the platform: resolved live here, a baseline lands at
  // rail-inline-compliant-chromium-win32.png, which ubuntu never looks for.
  //
  // Because the container is the only place they are made or read, the
  // template below deliberately drops {platform}: one baseline set serves
  // everyone, which is only safe BECAUSE of R37.
  snapshotPathTemplate: '{testDir}/../tests/visual/baselines/{arg}{ext}',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/*.visual.spec.ts',
    },
    {
      // Not part of `pnpm test:e2e`: these must never run outside the
      // container, where they would either write a platform-specific
      // baseline or fail against one.
      name: 'visual',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/*.visual.spec.ts',
    },
  ],
  // The e2e suite runs against a production build, not the dev server: the
  // font payload, the chunking and the CSS output all differ.
  webServer: {
    command: 'node scripts/copy-fonts.mjs && next build && next start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
