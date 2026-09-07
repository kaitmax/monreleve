// web/scripts/visual.mjs
//
// Screenshot baselines, generated and compared ONLY inside the Playwright
// Linux container. Ruling R37.
//
// WHY. Baselines made against one font stack and compared against another are
// a permanent source of false red, and Playwright's failure mode here is not
// a diff but a MISSING FILE: its default snapshot template carries the
// platform, so a baseline written on this workstation lands at
// rail-inline-compliant-chromium-win32.png and ubuntu CI looks for
// -chromium-linux.png, finds nothing, writes it, and fails. Run again with no
// change and it PASSES, because it now compares that file against itself.
// Measured, twice, before this script existed.
//
// Pinning the container removes the variable rather than tuning a tolerance.
// One baseline set, one font stack, one renderer - which is why
// playwright.config.ts can drop {platform} from the template.
//
//   node scripts/visual.mjs            compare against the committed baselines
//   node scripts/visual.mjs --update   regenerate them
//
// The image tag is pinned to the installed Playwright version: a container
// whose browser differs from the one the tests were written against would
// reintroduce exactly the drift this exists to remove.

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { version } = require('@playwright/test/package.json');

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(WEB, '..');
const IMAGE = `mcr.microsoft.com/playwright:v${version}-noble`;

const update = process.argv.includes('--update');

// node_modules is NOT mounted: it holds Windows-native binaries here and
// Linux ones in the container, so the container installs its own. That is the
// slow part and it is not avoidable - sharing them is what would break.
const inContainer = [
  'corepack enable',
  'cd /repo/web',
  'pnpm install --frozen-lockfile',
  `pnpm exec playwright test --project=visual${update ? ' --update-snapshots' : ''}`,
].join(' && ');

process.stdout.write(`visual baselines in ${IMAGE}${update ? ' (regenerating)' : ''}\n`);

try {
  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      // Playwright's own recommendation: Chromium needs a larger /dev/shm
      // than Docker's 64 MB default or it crashes on bigger pages.
      '--ipc=host',
      '-v',
      `${REPO}:/repo`,
      // Anonymous volumes shadowing the mounted tree. Without them pnpm sees
      // the HOST's node_modules - Windows-native binaries - decides it must
      // purge the directory, and (with no TTY) aborts:
      //
      //   ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
      //
      // Setting CI=true alone would "fix" that by letting it go ahead and
      // DELETE the host's install, which is worse than the error. Shadowing
      // gives the container its own empty directory and leaves the host's
      // alone. .next is shadowed for the same reason: the webServer builds
      // inside the container and would otherwise overwrite the host's build.
      '-v',
      '/repo/web/node_modules',
      '-v',
      '/repo/web/.next',
      '-e',
      'CI=true',
      '-w',
      '/repo/web',
      IMAGE,
      'bash',
      '-lc',
      inContainer,
    ],
    { stdio: 'inherit' },
  );
} catch {
  // execFileSync already streamed the failure; adding a stack would bury it.
  process.exitCode = 1;
}
