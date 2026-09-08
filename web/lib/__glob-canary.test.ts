// web/lib/__glob-canary.test.ts
//
// RULING R63. A canary for one (directory, extension) pair in the include
// list of vitest.config.ts. It asserts one thing - that it was collected from
// lib/ with the .ts extension - because that is the only thing it can
// usefully assert. Its VALUE is not in the assertion; it is in being counted.
//
// The failure it guards is silent: a glob that stops matching removes files
// from the run and `pnpm test` still exits 0. This file cannot report that
// itself, because a file that does not run cannot fail. Absence is noticed
// from OUTSIDE the run, by scripts/check-suite-floor.mjs, which names this
// path when it goes missing.
//
// The near miss that produced the ruling: FW8's component tests are .test.tsx
// and the glob then ended in .test.ts, which matches neither. It was caught
// only because those tests were new and someone was waiting to see them run.
// Hence a canary per EXTENSION, not merely per directory.
//
// Do not add behavioural assertions here. This file must be able to fail for
// exactly one reason.

import { basename, dirname } from 'node:path';
import { expect, it } from 'vitest';

it('was collected from lib/ as a .ts file', () => {
  // basename/dirname rather than a separator regex: the path arrives with
  // the platform separator, and hardcoding either one would make the canary
  // fail on the other OS for a reason that has nothing to do with globs.
  const path = expect.getState().testPath ?? '';

  expect(basename(path)).toBe('__glob-canary.test.ts');
  expect(basename(dirname(path))).toBe('lib');
});
