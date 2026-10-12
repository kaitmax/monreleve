// web/playwright.config.ts
import { TEST_ORIGIN } from './lib/content/identity';
import { defineConfig, devices } from '@playwright/test';

// R170: the port comes from the environment, default 3000. It was this
// literal, and that is half of how FW20 found the suite testing a different
// product - see e2e/support/base-url.ts and e2e/global-setup.ts.
import { BASE_URL, PORT } from './e2e/support/base-url';

export default defineConfig({
  testDir: './e2e',

  // RULING R169: the suite asserts what it is pointed at, FIRST. This runs
  // after webServer and before any spec, and aborts the entire run if the
  // address is answering for a different product. See e2e/global-setup.ts
  // for the measurement that produced the rule.
  globalSetup: './e2e/global-setup.ts',
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

  // RULING R114 - ZERO TOLERANCE, STATED. Playwright counts a pixel as
  // different only when its YIQ delta exceeds the threshold, and DEFAULTS
  // that threshold to 0.2: a 20 % per-pixel colour allowance which applies
  // while nobody writes the word. Declining to configure a tolerance is
  // therefore not zero tolerance - it is the vendor's.
  //
  // MEASURED, in FW-SHELL-BURGER. A 1 px border (--colour-border-strong on
  // white, delta 0.119) and a recoloured glyph (brand over text-primary,
  // delta 0.098) were added to the header of every page. Both sit under 0.2,
  // so the suite reported 108 passed / 3 failed twice in a row, certifying 34
  // phone baselines as unchanged against a header that had visibly changed -
  // and, because --update-snapshots only rewrites a FAILING comparison, those
  // 34 could not be regenerated at all. The picture was frozen, which is this
  // file's maxDiffPixels: 600 story from FW13 one layer down.
  //
  // maxDiffPixels is already 0 by default and is written anyway: the two
  // hatches are read together, and a value nobody states is a value nobody
  // checks. tests/unit/meta/visual-zero-tolerance.test.ts asserts BOTH are 0
  // by reading this object, not by grepping this file - a scan cannot tell
  // `threshold: 0` from `threshold: 0.2`.
  expect: {
    toHaveScreenshot: { threshold: 0, maxDiffPixels: 0 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // BOTH patterns, and the root-level testIgnore above is NOT inherited:
      // a project's testIgnore REPLACES the top-level value rather than merging
      // with it. With only the visual pattern here, this project collected
      // guard.runtime.spec.ts and ran the R81 guard against a correctly
      // configured server, where it asserts the opposite of what is true.
      // Exactly the ESLint flat-config trap - a narrower scope silently
      // deleting a broader rule - one config file over.
      testIgnore: ['**/*.visual.spec.ts', '**/*.runtime.spec.ts'],
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
    command: `node scripts/copy-fonts.mjs && next build && next start -p ${PORT}`,
    url: BASE_URL,
    // KEPT, AND R169 IS WHAT MAKES IT SAFE. Reusing a server is only sound
    // if it is OUR server, and until FW20 nothing established that: the
    // suite attached to whatever held the port and ran a full pass against
    // another product, reporting 91 tests passed. e2e/global-setup.ts now
    // refuses the run before a spec executes unless /api/health names this
    // product. Reuse stays because a warm server is worth minutes on every
    // local run; what changed is that it can no longer be the wrong one.
    // ...AND THE CONTAINER HARNESS SAYS SO EXPLICITLY (FW31, F-CI).
    //
    // `!process.env.CI` alone made the container job STRUCTURALLY INCAPABLE OF
    // PASSING, and it never once did. scripts/container-e2e.mjs starts the
    // image on this port and then runs this suite against it; in CI reuse was
    // off, so Playwright insisted on starting its own server, found the port
    // held BY THE CONTAINER IT WAS MEANT TO TEST, and refused before a single
    // spec executed:
    //
    //   Error: http://localhost:3100 is already used, make sure that nothing
    //   is running on the port/url or set reuseExistingServer:true
    //
    // The paragraph above argues that reuse is safe now because R169's global
    // setup refuses any server that does not NAME this product - and then the
    // clause disabled it in exactly the environment where the harness depends
    // on it. The fix is not to widen reuse generally: it is to let the process
    // that STARTED the server say so, which is a claim only that process can
    // make, and which R169 still verifies before any spec runs.
    reuseExistingServer: !process.env.CI || process.env.FRONTALIER_SERVER_IS_OURS === '1',
    // ========================================================================
    // A TOLERANCE, NOT A THRESHOLD (FW28, PARK-16)
    // ========================================================================
    //
    // 240 s was enough until FW28's increment 6, when `next build && next
    // start` began exceeding it on this machine - twice in the host suite and
    // once inside the visual container, which builds from scratch by design
    // (R98) and cannot borrow a warm .next. The build SUCCEEDS; it is slow.
    // A 25-minute `pnpm install` in the same container the same evening says
    // what the machine and the link were doing.
    //
    // THIS WEAKENS NO ASSERTION. Every spec still runs and every baseline is
    // still compared at zero tolerance; what changes is how long the harness
    // waits for a server to exist before giving up. R114's no-tolerance rule
    // is about DIFFS, and this is not one.
    //
    // Reversible in one line, and PARK-16 records the alternative not taken:
    // making the container reuse a host build, which would trade R98's
    // isolation - the property that makes a baseline mean anything - for a
    // few minutes.
    timeout: 600_000,
    // A SITE ORIGIN, BECAUSE OTHERWISE THERE ARE NO CANONICALS TO ASSERT.
    // Ruling R81 omits canonical and hreflang tags entirely when the origin is
    // the localhost stand-in - a canonical pointing at localhost is an
    // INSTRUCTION to a crawler, and absence is the safer failure. Correct, and
    // it means a build with no origin cannot prove the canonical machinery
    // works at all. So this suite supplies one.
    //
    // .example is reserved by RFC 2606 for exactly this: it can never resolve
    // and cannot be mistaken for the real domain, which is still an open
    // question gated at Checkpoint C. The runtime-guard suite deliberately
    // leaves it UNSET, which is how both directions get proved.
    //
    // RULING R129: THE TEST BUILD KEEPS /dev/**, THE PRODUCTION BUILD DOES
    // NOT. The workbench baselines, the rail gallery and the parity harness
    // are all driven through /dev routes, so this suite needs them - and the
    // shipped build must not have them, because a dev harness in the chunk
    // graph was costing the calculator 1,6 KiB and every other public route
    // 0,7. One flag, set here and nowhere a deployment can read it.
    env: {
      NEXT_PUBLIC_SITE_URL: TEST_ORIGIN,
      FRONTALIER_DEV_ROUTES: '1',
    },
  },
});
