// web/tests/unit/meta/clean-worktree-guard.test.ts
//
// R379: `pnpm gate` refuses to start when the working tree differs from the
// index.
//
// ============================================================================
// THE DEFECT, WHICH NO EXISTING CHECK COULD SEE
// ============================================================================
//
// KMP-0 commits d808d05 and dfffee9 put `java.time` imports into commonMain -
// the one thing R369's platform-free fence exists to forbid - with every check
// green. The fence was not broken. The sequence was:
//
//     git mv <file> shared/...              the move is STAGED
//     <edit it to use kotlinx-datetime>     the edit is UNSTAGED
//     ./gradlew :app:gate                   compiles the WORKING TREE: green
//     git commit                            commits the INDEX: no edit in it
//
// A build reads the working tree. A commit writes the index. Each tool was
// correct about its own input, and nothing was positioned to notice they had
// diverged - which is why this is a guard rather than a stricter fence.
//
// ============================================================================
// THE TESTS RUN THE SCRIPT IN A SCRATCH REPOSITORY
// ============================================================================
//
// Not against this one: a test that depended on the state of the tree it runs
// in would pass or fail according to whether the person running it had saved
// a file, which is the least useful test imaginable. Each case below builds
// its own repository, puts it in exactly one state, and runs the real script
// as a child process - the entry point, not an imported function (R204).

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/require-clean-worktree.mjs');
const made: string[] = [];

afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A repository with one committed file, and nothing else. */
function scratchRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'r379-'));

  made.push(dir);

  const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  };

  git('init', '--quiet');
  git('config', 'user.email', 'r379@example.com');
  git('config', 'user.name', 'R379');
  writeFileSync(join(dir, 'tracked.txt'), 'original\n', 'utf8');
  git('add', 'tracked.txt');
  git('commit', '--quiet', '-m', 'one file');

  return dir;
}

function runGuard(cwd: string): { status: number; stderr: string; stdout: string } {
  const result = spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8' });

  return { status: result.status ?? -1, stderr: result.stderr, stdout: result.stdout };
}

describe('R379: the guard refuses exactly the state that produced the defect', () => {
  it('passes on a clean tree', () => {
    const run = runGuard(scratchRepo());

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('no unstaged changes');
  });

  it('REFUSES on an unstaged change to a tracked file, and names it', () => {
    const dir = scratchRepo();

    writeFileSync(join(dir, 'tracked.txt'), 'edited\n', 'utf8');

    const run = runGuard(dir);

    expect(run.status).toBe(1);
    // NAMING THE FILE IS THE REQUIREMENT, not an extra. "The tree is dirty"
    // sends somebody to `git status`, which lists untracked files too and
    // buries the one line that matters.
    expect(run.stderr).toContain('tracked.txt');
    expect(run.stderr).toContain('REFUSED');
  });

  it('passes once that same change is STAGED', () => {
    // THE POINT OF THE RULING, not a loophole: staged means the tree and the
    // index agree, so the build reads what the commit will write.
    const dir = scratchRepo();

    writeFileSync(join(dir, 'tracked.txt'), 'edited\n', 'utf8');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: dir, stdio: 'pipe' });

    expect(runGuard(dir).status).toBe(0);
  });

  it('IGNORES untracked files', () => {
    // .env, .kotlin/, a session lock and a scratch note are all untracked and
    // all normal. None can reach a commit by accident, and a guard that fired
    // on them would be switched off within a week.
    const dir = scratchRepo();

    writeFileSync(join(dir, 'scratch.txt'), 'not tracked\n', 'utf8');
    mkdirSync(join(dir, 'build'));
    writeFileSync(join(dir, 'build/output.bin'), 'generated\n', 'utf8');

    expect(runGuard(dir).status).toBe(0);
  });

  it('passes outside a git repository rather than blocking the build', () => {
    // A source tarball or an unpacked artefact has no index to disagree with,
    // so refusing there would block a legitimate build for a reason nobody
    // can act on.
    const dir = mkdtempSync(join(tmpdir(), 'r379-nogit-'));

    made.push(dir);

    expect(runGuard(dir).status).toBe(0);
  });
});

describe('R379: the guard is actually wired into the gate', () => {
  it('runs as the FIRST step of pnpm gate', () => {
    // A guard nobody calls is a comment (CLAUDE.md). And the position
    // matters: it has to refuse before the chain spends ten minutes proving
    // something about code that is not being committed.
    const scripts = (
      JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts;

    expect(scripts.gate).toMatch(/^node scripts\/require-clean-worktree\.mjs &&/u);
  });
});
