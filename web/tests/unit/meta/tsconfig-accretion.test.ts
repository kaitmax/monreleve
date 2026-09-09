// web/tests/unit/meta/tsconfig-accretion.test.ts
//
// RULING R98's SIDE EFFECT, and it was growing in a committed file.
//
// R98 requires a baseline to come from an ISOLATED build, so scripts/visual.mjs
// gives every run its own distDir - .next-visual-<pid>-<time>. Next then does
// something the ruling did not anticipate: on each build it APPENDS that
// directory's generated route types to the `include` array of the repo's real
// tsconfig.json, because the tsconfig is on the bind mount and Next treats
// keeping it current as a courtesy.
//
// The directory is deleted when the run ends. The include entry is not. Seven
// had accumulated by FW11 increment 1, every one of them pointing at nothing,
// and the list could only ever grow - one entry per visual run, forever, in a
// file that goes into every commit. It also meant `git status` was never clean
// after a visual run, which is exactly the noise that hides a real change.
//
// TWO HALVES, AND THIS IS THE ONE THAT CAN SEE THE FAILURE. scripts/visual.mjs
// now snapshots tsconfig.json before the container starts and restores it in
// the same `finally` that checks the mount point. If that restore ever breaks -
// a changed flag, a crash between snapshot and restore, a future Next that
// writes somewhere else - the repo would start accreting again with no symptom
// beyond a diff nobody reads. This assertion is the symptom.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = process.cwd();

function tsconfigText(): string {
  return readFileSync(join(WEB, 'tsconfig.json'), 'utf8');
}

function includeEntries(): readonly string[] {
  // tsconfig.json permits comments, so this is not guaranteed to be JSON.
  // It happens to be clean JSON here, and if that ever stops being true the
  // parse failure is a louder and more accurate signal than a regex that
  // silently matched nothing.
  const parsed: unknown = JSON.parse(tsconfigText());

  expect(parsed, 'tsconfig.json parsed to an object').toBeTypeOf('object');

  const include = (parsed as { include?: unknown }).include;

  expect(Array.isArray(include), 'tsconfig.json has an include array').toBe(true);

  return include as readonly string[];
}

describe('tsconfig.json carries no leftovers from a visual run', () => {
  it('has no .next-visual-* entry in include', () => {
    const leaked = includeEntries().filter((entry) => entry.startsWith('.next-visual-'));

    expect(
      leaked,
      `${leaked.length} per-run distDir(s) left in tsconfig include: ${leaked.join(', ')}`,
    ).toEqual([]);
  });

  it('still includes the real .next types, so the check is not just an empty array', () => {
    // Non-vacuous in the direction that matters: a test asserting the absence
    // of something passes trivially if include were emptied by a bad restore,
    // which would be a worse defect than the one above.
    expect(includeEntries()).toContain('.next/types/**/*.ts');
  });

  it('mentions no per-run distDir anywhere in the file, include or not', () => {
    // Wider than the include check on purpose. Next has written this path into
    // `exclude` in other people's repos depending on version, and the point is
    // that no trace of a temporary directory survives in a committed file.
    expect(tsconfigText()).not.toContain('.next-visual-');
  });
});
