// web/scripts/tree-lock.mjs
//
// RULING R131: A COMMAND THAT MUTATES THE WORKING TREE TAKES AN EXCLUSIVE
// LOCK, and any gate command refuses to start while it is held.
//
// FOURTH INCIDENT OF ONE CLASS. The record, because the pattern is the
// argument for the ruling:
//
//   FW11  two command chains sharing .next - one built while the other read.
//   FW11  pnpm size read .next mid-build and measured a half-written tree.
//   FW11  a build raced clean-tree's stash of public/.
//   FW12  a vitest run raced clean-tree's stash of public/, and the failure
//         looked like a real tree dependency until it was re-run alone.
//
// R98 closed this class for CONTAINERS (refuse while another is alive) and
// R105 for PROCESSES. Neither covers the tree itself: clean-tree RENAMES
// public/ out of the way and back, and for those ninety seconds any other
// command sees a checkout that does not exist in git and will not exist again.
//
// WHAT MAKES IT WORTH A LOCK RATHER THAN A HABIT. Every one of the four was
// mine, in a session where I was being careful, and three of them produced a
// FAILURE THAT LOOKED LIKE A FINDING - a test failing for a reason the test
// was written to detect, with the real cause invisible. That is the expensive
// shape: not a broken run, a misleading one.
//
// THE LOCK IS A FILE, NOT A MUTEX, and that is deliberate. The processes here
// are separate pnpm invocations, often started from different shells, and the
// thing being protected is a directory rather than memory. A file with the
// holder's pid and command in it survives the parent dying, can be read by a
// human, and can be deleted by one when a run is killed mid-flight - which is
// how every previous orphan ended up being cleared anyway.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = process.cwd();
const LOCK = join(WEB_ROOT, '.tree-lock.json');
const NEWLINE = String.fromCharCode(10);

/**
 * A lock older than this is treated as an orphan.
 *
 * clean-tree's own run is ninety seconds and the visual suite is under three
 * minutes, so twenty is far past any real holder. The alternative - a lock
 * that never expires - turns one killed run into a repository that refuses
 * every command until somebody finds this file, which is a worse failure than
 * the one it prevents.
 */
const STALE_AFTER_MS = 20 * 60 * 1000;

/** Is a pid still alive? Signal 0 tests without sending anything. */
function alive(pid) {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
}

function readLock() {
  if (!existsSync(LOCK)) return null;

  try {
    const held = JSON.parse(readFileSync(LOCK, 'utf8'));

    // THREE WAYS A LOCK STOPS COUNTING, and all three have happened to a
    // container lock in this project: the holder exited, the machine was
    // rebooted so the pid belongs to something else entirely, or the file is
    // simply old. A lock nobody can clear is its own outage.
    if (!alive(held.pid)) return null;
    if (Date.now() - held.at > STALE_AFTER_MS) return null;

    return held;
  } catch {
    // A truncated or hand-edited lock is not a holder.
    return null;
  }
}

/**
 * Take the lock, or refuse.
 *
 * Called by the mutating commands. The write is last-writer-wins rather than
 * atomic, which is honest about what this is: two commands started in the same
 * millisecond can both proceed. That race is not the one that has ever
 * happened here - every incident was a long command running while a second was
 * started deliberately, seconds or minutes later.
 */
export function takeTreeLock(command) {
  const held = readLock();

  if (held !== null) {
    process.stderr.write(
      [
        '',
        `REFUSING TO RUN: ${command} mutates the working tree and the tree lock is held.`,
        `  held by: ${held.command} (pid ${held.pid}, since ${held.iso})`,
        '',
        'Two commands mutating one checkout is ruling R131, and it has produced',
        'four incidents in this project - three of which failed in a way that',
        'looked like a genuine finding rather than a collision.',
        '',
        'Wait for it to finish, or if that process is gone:',
        `  rm ${LOCK}`,
        '',
      ].join(NEWLINE),
    );

    process.exit(1);
  }

  writeFileSync(
    LOCK,
    `${JSON.stringify(
      { command, pid: process.pid, at: Date.now(), iso: new Date().toISOString() },
      null,
      2,
    )}${NEWLINE}`,
  );
}

/** Release it. Safe to call when it was never taken. */
export function releaseTreeLock() {
  if (existsSync(LOCK)) rmSync(LOCK, { force: true });
}

/**
 * Refuse to start while someone else is mutating the tree.
 *
 * Called by the READING commands - the gate's build and its measurement. They
 * do not take the lock themselves: two builds are not the problem R131 is
 * about, and making `pnpm build` exclusive would serialise things that have
 * never collided.
 */
export function refuseIfTreeLocked(command) {
  const held = readLock();

  if (held === null) return;

  process.stderr.write(
    [
      '',
      `REFUSING TO RUN: ${command} reads the working tree and ${held.command} is mutating it.`,
      `  held by: ${held.command} (pid ${held.pid}, since ${held.iso})`,
      '',
      'R131. The last time this happened, clean-tree had public/ renamed aside',
      'and a vitest run failed on the missing directory - a failure that reads',
      'exactly like the tree dependency clean-tree exists to detect.',
      '',
      'Wait for it to finish, or if that process is gone:',
      `  rm ${LOCK}`,
      '',
    ].join(NEWLINE),
  );

  process.exit(1);
}
