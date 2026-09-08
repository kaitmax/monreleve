// web/types/vitest-axe.d.ts
//
// vitest-axe 0.1.0 ships its own type augmentation, and it does not apply
// here. Its extend-expect.d.ts declares `namespace Vi { interface Assertion }`,
// which was the augmentation point up to vitest 2; vitest 5 exposes
// `interface Matchers<R, T>` from the "vitest" module instead. The runtime
// half works untouched - expect.extend registers the matcher and it fails on
// a real violation, verified against an <img> with no alt - so this closes a
// gap in the TYPES only, and `tsc --noEmit` was the only thing complaining.
//
// The type parameters are copied exactly from vitest's own declaration,
// defaults included, because TypeScript requires every declaration of a
// merged interface to have identical type parameters. Widening R to `unknown`
// here fails with "All declarations of 'Matchers' must have identical type
// parameters" rather than with anything about axe.

import type { AxeMatchers } from 'vitest-axe/matchers';

declare module 'vitest' {
  // R and T are unused HERE and cannot be dropped: TypeScript rejects a merged
  // interface whose type parameters differ from the original declaration, so
  // they are copied from vitest verbatim. One directive on one line, because
  // an eslint-disable-next-line above a two-line comment disables the second
  // comment line rather than the code - a trap this repo has already met.
  // Kept on ONE line so that both rules report against the line the directive
  // covers. Split across two, the empty-body error lands on the second line
  // and escapes a disable aimed at the first.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> extends AxeMatchers {}
}
