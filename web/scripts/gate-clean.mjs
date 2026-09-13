// web/scripts/gate-clean.mjs
//
// RULING R139: does this work on a CLEAN CHECKOUT WITH NO SECRETS?
//
// WHY IT EXISTS. FW14 put two red commits on main, and neither was a suite
// nobody ran - R132 selected the right suites both times and every one of them
// passed. The failures were about STATE:
//
//   da65dfa  @prisma/client has no exported member 'PrismaClient'. The client
//            is written by a postinstall, and my tree had one because I had
//            run generate by hand.
//   ef629d5  DATABASE_URL is not set, failing at BUILD - next build IMPORTS
//            every route module to collect page data, and the client was
//            constructed at module scope.
//
// Both passed locally. Both passed in the CI job that has a database. Both
// failed in the two jobs that do not. "It passes here" and "it passes on a
// clean checkout with no secrets" are different claims, and R132 can only
// make the first.
//
// A COPY, NOT A SCRUB, and that is the whole design. The obvious
// implementation moves .env aside and deletes node_modules, which mutates the
// working tree - R131 territory, needing a lock, and leaving a repository in
// pieces if it is interrupted. Instead this copies what GIT WOULD GIVE A
// FRESH CLONE into a temporary directory and works there. The main tree is
// never touched, so there is nothing to restore and nothing to lock.
//
// .env IS EXCLUDED BY CONSTRUCTION rather than by remembering to exclude it.
// The file list is `git ls-files` plus untracked-but-not-ignored files, so
// anything .gitignore hides - .env, node_modules, .next, test-results - is
// absent because git would not hand it to anyone either. A scrub list is a
// list somebody has to maintain; this one cannot fall behind.
//
// WHAT IT RUNS: install, typecheck, build. Not the test suites - they are
// R132's job and they need a database. The class of defect this catches lives
// entirely in install and build.
//
// R133: EVERY STEP ASSERTS A POSITIVE SIGNAL. A clean install that printed
// nothing recognisable, or a build that neither compiled nor errored, is a
// failure here rather than a silence read as success.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(web, '..');

/** Environment variables a clean checkout does not have. */
const SECRETS = [
  'DATABASE_URL',
  'RESEND_API_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'FRONTALIER_RUNTIME',
  'FRONTALIER_DEV_ROUTES',
];

function fileList() {
  // -z, AND IT IS NOT A DETAIL. git quotes any path with a non-ASCII byte in
  // it - core.quotePath - so a French filename comes back as
  // "panneau de r\303\251gime..." wrapped in literal quotes, and copying that
  // creates a directory named after the escape. This repository is a French
  // product; accented paths are the normal case, not the edge one.
  //
  // NUL-separated output is the raw bytes with no quoting at all.
  const NUL = String.fromCharCode(0);

  const git = (args) =>
    execFileSync('git', [...args, '-z'], {
      cwd: repo,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split(NUL)
      .filter((line) => line !== '');

  // Tracked, plus untracked files git is not ignoring. The second half
  // matters: a new route added but not yet committed is exactly the code an
  // increment is about to commit, and leaving it out would check the wrong
  // tree.
  return [...new Set([...git(['ls-files']), ...git(['ls-files', '--others', '--exclude-standard'])])];
}

function run(label, command, args, cwd, expect) {
  process.stdout.write(`--- ${label} ---\n`);

  const child = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: true,
    env: Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !SECRETS.includes(name)),
    ),
    maxBuffer: 64 * 1024 * 1024,
  });

  const output = `${child.stdout ?? ''}${child.stderr ?? ''}`;

  process.stdout.write(`${output.split('\n').slice(-12).join('\n')}\n`);

  if (child.status !== 0) {
    return { ok: false, why: `${label} exited ${String(child.status)}`, output };
  }

  // R133. A step that exited 0 without saying what it did is not a pass.
  if (!expect.test(output)) {
    return {
      ok: false,
      why:
        `${label} exited 0 but printed nothing matching ${String(expect)}. ` +
        'A step that reports nothing must not read as a pass (R133).',
      output,
    };
  }

  return { ok: true, output };
}

const root = mkdtempSync(join(tmpdir(), 'frontalier-clean-'));

try {
  const files = fileList();

  if (files.length < 100) {
    console.error(`gate:clean FAILED: git listed ${files.length} files, which cannot be this repository.`);
    process.exit(1);
  }

  for (const file of files) {
    const to = join(root, file);

    mkdirSync(dirname(to), { recursive: true });
    cpSync(join(repo, file), to);
  }

  console.log(`gate:clean - ${files.length} files copied, as git would hand them to a clone`);
  console.log(`scrubbed from the environment: ${SECRETS.join(', ')}`);
  console.log('');

  const there = join(root, 'web');

  const steps = [
    ['pnpm install --frozen-lockfile', 'pnpm', ['install', '--frozen-lockfile'], /Done in|Already up to date|packages/i],
    ['pnpm typecheck', 'pnpm', ['typecheck'], /tsc --noEmit/],
    ['pnpm build', 'pnpm', ['build'], /Compiled successfully|Generating static pages/],
  ];

  for (const [label, command, args, expect] of steps) {
    const result = run(label, command, args, there, expect);

    if (!result.ok) {
      console.error('');
      console.error(`GATE:CLEAN FAILED - ${result.why}`);
      console.error('');
      console.error('This is a defect a normal gate cannot see: it passes on a machine');
      console.error('that has a .env, a generated client, or a node_modules nobody');
      console.error('rebuilt. A clean checkout has none of those.');
      process.exit(1);
    }
  }

  console.log('');
  console.log('GATE:CLEAN PASSED - installs, typechecks and builds from a clean');
  console.log('checkout with no secrets in the environment.');
} finally {
  rmSync(root, { recursive: true, force: true });
}
