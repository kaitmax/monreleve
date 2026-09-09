// web/tests/unit/meta/distdir-leaks.test.ts
//
// RULING R98's SIDE EFFECT ON THE FILES NEXT OWNS - and there are two of them,
// which is the whole reason this file is not called tsconfig-anything.
//
// R98 requires a baseline to come from an ISOLATED build, so scripts/visual.mjs
// gives every run its own distDir - .next-visual-<pid>-<time>. Next then
// rewrites the two typescript files it considers its own to point at it,
// because they sit on the bind mount and Next treats keeping them current as a
// courtesy. The distDir is deleted when the run ends. The edits are not.
//
// THE TWO FAIL DIFFERENTLY, and the second is much worse:
//
//   tsconfig.json   APPENDS a glob to `include`. Eight had accumulated by
//                   FW11, each pointing at nothing. Dead globs are harmless in
//                   themselves; the cost was a list that could only grow, in a
//                   file that goes into every commit, and a `git status` that
//                   was never clean after a visual run - which is the noise
//                   that hides a real change.
//
//   next-env.d.ts   REPLACES the reference to ./.next/types/routes.d.ts with
//                   one to the temporary directory. Not an addition: the live
//                   path is GONE, so Next's generated route types resolve to a
//                   directory that no longer exists.
//
// AND `tsc --noEmit` EXITS 0 EITHER WAY. That was measured, not assumed: with
// the dead reference committed, the whole gate stayed green. A missing
// /// <reference path> target is not an error, and the app's own sources are
// swept up by the `**/*.ts` include regardless, so nothing downstream
// complains. The defect has no symptom anywhere in the gate, which is exactly
// why the assertion has to exist rather than be left to typecheck.
//
// HOW THE SECOND ONE WAS FOUND, since it is the argument for the shape of this
// file: the first version of this test covered tsconfig.json only. One commit
// later next-env.d.ts turned up in `git status` for the same reason and got
// committed with a dead reference in it. A guard written for one instance of a
// class catches one instance of a class.
//
// The other half is the snapshot/restore in scripts/visual.mjs. This is the
// half that can SEE that break: a crash between snapshot and restore, or a
// future Next that writes to a third file, would otherwise leave no symptom.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = process.cwd();

/**
 * The files Next rewrites, each with the live path it must still point at.
 *
 * `mustContain` is the non-vacuity half and it is per-file on purpose. An
 * assertion that something is ABSENT passes trivially if the file were
 * truncated or emptied by a bad restore, which would be a worse defect than
 * the leak it is looking for.
 */
const OWNED_BY_NEXT: ReadonlyArray<{ readonly file: string; readonly mustContain: string }> = [
  { file: 'tsconfig.json', mustContain: '.next/types/**/*.ts' },
  { file: 'next-env.d.ts', mustContain: './.next/types/routes.d.ts' },
];

function textOf(file: string): string {
  return readFileSync(join(WEB, file), 'utf8');
}

describe.each(OWNED_BY_NEXT)('$file survives a visual run unchanged', ({ file, mustContain }) => {
  it('mentions no per-run distDir', () => {
    // Split on a computed newline: this file's own line endings differ
    // between the two watched files - tsconfig.json is LF and next-env.d.ts
    // is CRLF here - so a trim is cheaper than caring which.
    const NEWLINE = String.fromCharCode(10);
    const lines = textOf(file)
      .split(NEWLINE)
      .map((line) => line.trim())
      .filter((line) => line.includes('.next-visual-'));

    expect(
      lines,
      `${file} still points at a deleted distDir: ${lines.join(' | ')}`,
    ).toEqual([]);
  });

  it('still points at the real .next', () => {
    expect(textOf(file)).toContain(mustContain);
  });
});

describe('tsconfig.json specifically', () => {
  it('has an include array with no .next-visual-* glob', () => {
    // Parsed rather than grepped, so a malformed file fails loudly here
    // instead of letting a regex match nothing and report success. tsconfig
    // permits comments; this one happens to be clean JSON, and if that stops
    // being true the parse error is the more accurate signal.
    const parsed: unknown = JSON.parse(textOf('tsconfig.json'));
    const include = (parsed as { include?: unknown }).include;

    expect(Array.isArray(include), 'tsconfig.json has an include array').toBe(true);

    const leaked = (include as readonly string[]).filter((entry) =>
      entry.startsWith('.next-visual-'),
    );

    expect(leaked, `stale distDir globs: ${leaked.join(', ')}`).toEqual([]);
  });
});
