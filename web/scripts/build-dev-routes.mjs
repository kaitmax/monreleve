// web/scripts/build-dev-routes.mjs
//
// RULING R129: the one dev-enabled build, for GATE W and GATE I.
//
// WHAT THIS IS FOR. /dev/** is out of the production build, so `pnpm build`
// followed by `pnpm size` reports the public routes and nothing else - which
// is the point, and it means the two dev ceilings have nothing to measure.
// They still have to be measured: GATE I is the only thing standing between
// the component library and another 207 KiB of icons, and it needs a build
// that contains the harness.
//
// So this is that build, and it writes to its OWN distDir. Ruling R98's
// lesson, paid for twice: two builds sharing .next is how a baseline came to
// be compared against a tree another process was writing. The production
// build stays where it is, untouched, and this one cannot be mistaken for it.
//
// NODE, NOT A SHELL ENV PREFIX. `FRONTALIER_DEV_ROUTES=1 next build` is POSIX
// syntax that cmd.exe does not understand, and this repo is developed on
// Windows and built on Linux. Spawning next's JS entry point with an explicit
// env also sidesteps the .cmd shim that made execFileSync('pnpm', ...) fail
// with ENOENT in FW12 - the same class of Windows problem, one layer down.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_DIST_DIR, DEV_ROUTES_FLAG } from './dev-routes.mjs';
import { refuseIfTreeLocked } from './tree-lock.mjs';

const WEB_ROOT = process.cwd();

refuseIfTreeLocked('pnpm build:dev');

/** Next's own JS entry, so no shell and no platform-specific shim. */
const NEXT_BIN = join(WEB_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');


if (!existsSync(NEXT_BIN)) {
  console.error(`next not found at ${NEXT_BIN} - run pnpm install`);
  process.exit(1);
}

/**
 * The two files `next build` REWRITES to point at whatever distDir it used.
 *
 * THE SAME TRAP scripts/visual.mjs DOCUMENTS, and it caught this script on
 * its first run: the dev build pointed next-env.d.ts at .next-dev-routes and
 * appended a glob to tsconfig.json, and distdir-leaks.test.ts failed on the
 * next gate. Both files are COMMITTED, so without this they would travel to
 * CI naming a directory that only exists on the machine that built it.
 *
 * Restored rather than gitignored, and reported rather than restored in
 * silence: if Next stops doing this, or starts doing it somewhere new, this
 * line appearing or not is the cheap way to notice.
 */
const OWNED_BY_NEXT = ['tsconfig.json', 'next-env.d.ts'];

const snapshots = OWNED_BY_NEXT.map((file) => ({
  file,
  path: join(WEB_ROOT, file),
  before: readFileSync(join(WEB_ROOT, file), 'utf8'),
}));

const result = spawnSync(process.execPath, [NEXT_BIN, 'build'], {
  cwd: WEB_ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    [DEV_ROUTES_FLAG]: '1',
    NEXT_DIST_DIR: DEV_DIST_DIR,
  },
});

for (const snapshot of snapshots) {
  if (readFileSync(snapshot.path, 'utf8') !== snapshot.before) {
    writeFileSync(snapshot.path, snapshot.before);
    process.stdout.write(
      `${snapshot.file} restored: next had pointed it at ${DEV_DIST_DIR}.
`,
    );
  }
}

if (result.status !== 0) {
  console.error('the dev-enabled build failed; GATE W and GATE I were not measured.');
  process.exit(result.status ?? 1);
}

console.log(`dev-enabled build written to ${DEV_DIST_DIR}/ (ruling R129).`);
