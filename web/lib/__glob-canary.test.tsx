// web/lib/__glob-canary.test.tsx
//
// RULING R63. A canary for one (directory, extension) pair in the include
// list of vitest.config.ts. It asserts one thing - that it was collected from
// lib/ with the .tsx extension - because that is the only thing it can
// usefully assert. Its VALUE is not in the assertion; it is in being counted.
//
// THIS PAIR IS THE ONE THAT ALREADY CAUGHT SOMETHING. FW8's component tests
// live at lib/ui/react/**/*.test.tsx and the glob then ended in .test.ts,
// which matches neither of them; the suite went green while asserting nothing
// about the components. It was noticed only because those tests were new and
// someone was waiting to see them run. Hence a canary per EXTENSION and not
// merely one per directory.
//
// It holds no JSX deliberately. A canary that needed the JSX transform could
// fail for a transform reason, and then a red run would no longer mean what
// this file exists to make it mean. It must be able to fail for exactly one
// reason: the glob stopped matching .tsx.
//
// Since a file that does not run cannot fail, the absence is noticed from
// OUTSIDE the run, by scripts/check-suite-floor.mjs, which names this path.

import { basename, dirname } from 'node:path';
import { expect, it } from 'vitest';

it('was collected from lib/ as a .tsx file', () => {
  // basename/dirname rather than a separator regex: the path arrives with
  // the platform separator, and hardcoding either one would make the canary
  // fail on the other OS for a reason that has nothing to do with globs.
  const path = expect.getState().testPath ?? '';

  expect(basename(path)).toBe('__glob-canary.test.tsx');
  expect(basename(dirname(path))).toBe('lib');
});
