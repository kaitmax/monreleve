// web/tests/unit/meta/glob-canaries.test.ts
//
// RULING R63, the half that lives inside the run.
//
// The include globs in vitest.config.ts have a failure mode with no symptom:
// a glob that stops matching removes its files from the run, every assertion
// they carried silently stops being checked, and `pnpm test` still exits 0.
// Two things have to be true for the canary scheme to actually cover that:
//
//   every glob has a canary          <- this file
//   every canary was collected       <- scripts/check-suite-floor.mjs
//
// Only the second can catch a broken glob, because a file that does not run
// cannot fail and the absence must be seen from outside. This file exists so
// the second has an unambiguous list to look for, and so the scheme EXTENDS
// ITSELF: add a third glob, or a third extension, and this goes red until a
// canary exists for it. Without that, the floor script would keep passing
// while quietly covering a shrinking fraction of the config.
//
// It reads the config MODULE rather than the file's text. Parsing the source
// with a regex would be a second, weaker copy of vitest's own understanding
// of it - and a copy that drifts is how this kind of check goes quietly
// wrong, which is the failure being defended against in the first place.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../../vitest.config';

const root = process.cwd();

/** 'tests/**\/*.test.{ts,tsx}' -> ['tests:ts', 'tests:tsx'] */
function pairs(glob: string): string[] {
  const directory = glob.split('/')[0] ?? '';
  const braced = /\{([^}]+)\}\s*$/.exec(glob);
  const extensions = braced?.[1] ? braced[1].split(',') : [glob.split('.').pop() ?? ''];

  return extensions.map((extension) => `${directory}:${extension.trim()}`);
}

describe('every include glob has a canary proving it collects (R63)', () => {
  const include = config.test?.include ?? [];

  it('reads the real config, so every assertion below has something to check', () => {
    // Without this the two tests below pass by iterating an empty list -
    // precisely the vacuous green this whole mechanism exists to detect. If
    // the config's shape ever changes so that include cannot be read here,
    // this fails rather than letting the rest pass for free.
    expect(include.length).toBeGreaterThan(0);
    expect(include).toContain('tests/**/*.test.{ts,tsx}');
  });

  it('claims exactly the four (directory, extension) pairs the canaries cover', () => {
    const claimed = [...new Set(include.flatMap(pairs))].sort();

    expect(claimed).toEqual(['lib:ts', 'lib:tsx', 'tests:ts', 'tests:tsx']);
  });

  it('finds a canary on disk for every pair', () => {
    for (const pair of new Set(include.flatMap(pairs))) {
      const [directory, extension] = pair.split(':');
      const path = join(directory ?? '', `__glob-canary.test.${extension ?? ''}`);

      expect(existsSync(join(root, path)), `${path} is missing`).toBe(true);
    }
  });
});
