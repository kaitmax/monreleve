// web/lib/ui/react/Container/Container.types.ts
//
// FW9 increment 3: "No arbitrary widths accepted - the prop is a union, and a
// test asserts no other value compiles."
//
// THAT CLAIM IS NOT TESTABLE AT RUNTIME. There is no value you can pass to
// demonstrate that a different value WOULD have been refused. A runtime test
// could only show that an invalid width is ignored - a weaker and different
// claim, and one that would still let `<Container width="1337px">` compile and
// ship, laid out at whatever the fallback happens to be. The refusal is a
// property of the type, so the test is a type.
//
// The mechanism is ruling R65's: a @ts-expect-error is an assertion because it
// fails in BOTH directions. While ContainerWidth is a union of three literals
// each line below is a genuine error and the directive absorbs it. Widen the
// prop to `string` - the one change that would let a caller invent a width -
// and every directive becomes unused, which tsc reports as TS2578 and the
// build fails.
//
// Not a .test.ts file: there is nothing to run, and naming it .test.ts would
// make vitest fail it for containing no tests, which would read as the guard
// working when it is not. tsconfig's include is "**/*.ts", so tsc checks it
// whether or not anything imports it. Container.test.tsx asserts this file
// still exists and still carries all three directives, because a deleted type
// test leaves no red run behind it.

import type { ContainerWidth } from './Container';

/** Never called. Its body exists to be type-checked, not executed. */
function assertionsCheckedByTsc(): void {
  // ASSERTION 1 - an arbitrary length is refused. The literal a caller reaches
  // for when a page "needs to be a bit wider", and the exact thing the union
  // exists to prevent.
  // @ts-expect-error an arbitrary length is not one of the three named widths.
  const arbitrary: ContainerWidth = '1337px';

  void arbitrary;

  // ASSERTION 2 - a plausible-but-wrong NAME is refused. More dangerous than
  // assertion 1, because it looks like it belongs: 'content' was the old
  // $layout-content-max, 'wide' and 'full' are what a reader might guess.
  // @ts-expect-error 'content' is not a named width; R64 removed that token.
  const plausible: ContainerWidth = 'content';

  void plausible;

  // ASSERTION 3 - a value typed as `string` is refused. This is the one a
  // caller actually hits: a width read from a CMS field, a route param, or a
  // prop threaded through a wrapper as string. Assertions 1 and 2 are literals
  // and a widened union would still reject neither; this one is what proves
  // the prop is not assignable FROM string.
  const fromElsewhere: string = 'public';

  // @ts-expect-error a plain string is not assignable to the union, even when its value happens to be a member.
  const widened: ContainerWidth = fromElsewhere;

  void widened;
}

void assertionsCheckedByTsc;
