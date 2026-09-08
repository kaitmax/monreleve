// web/tests/unit/fr/errors.types.ts
//
// RULING R65: "When tsc enforces a criterion, the test says so. FW9 AC1's
// exhaustiveness proof becomes a type-level test: a @ts-expect-error asserting
// that a seventh ValidationError code without lib/fr copy fails to compile."
//
// WHY THE RULING WAS ISSUED. FW9's first run proved AC1 by planting a seventh
// code in the engine's union and watching `pnpm typecheck` fail twice - and
// recorded that the runtime suite stayed GREEN at 11 passed throughout. The
// criterion held, but nothing in the repository SAID that tsc was the thing
// holding it. A reader would reasonably assume the tests did. This file is
// where the mechanism is written down and where it is checked.
//
// NOT A .test.ts FILE, DELIBERATELY. There is nothing here to run: every
// assertion is discharged by the compiler. vitest's include globs collect
// tests/**/*.test.{ts,tsx}, so this is not collected - the same reason
// tests/unit/calc-engine/arbitraries.ts and tests/support/markup.ts are not.
// tsconfig.json's include is "**/*.ts", which puts this file in the program
// regardless of whether anything imports it, so `pnpm typecheck` checks it.
//
// HOW A @ts-expect-error IS A TEST. The directive fails the build in BOTH
// directions, which is what makes it an assertion rather than a suppression:
//
//   the line still errors  -> the directive absorbs it, build passes, the
//                             guard is intact
//   the line stops erroring -> tsc reports "Unused '@ts-expect-error'
//                             directive", the build FAILS, and the failure
//                             says the guard has been weakened
//
// So loosening ERROR_COPY to Record<string, string> - the exact change that
// would let a code ship without copy - breaks this file. Verified by doing it;
// the run is in REPORT-FW9.txt.
//
// tests/unit/fr/errors.test.ts asserts that this file exists and still carries
// its directives, because a type test that is deleted leaves no trace: there is
// no red run, only a criterion silently unenforced.

import type { ValidationError } from '@/lib/calc-engine';
import { ERROR_COPY, errorMessage } from '@/lib/fr/errors';

type Code = ValidationError['code'];

/** A code the engine does not have. Stands in for tomorrow's seventh member. */
type SeventhCode = 'PLANTED_SEVENTH_CODE';

/**
 * Never called. Its body exists to be type-checked, not executed - which is
 * also why the two statements inside it are safe: `errorMessage` with a bogus
 * code would return the argument rather than throw, but it never runs.
 */
function assertionsCheckedByTsc(): void {
  // ASSERTION 1 - the copy map is EXHAUSTIVE AND TIGHT.
  //
  // ERROR_COPY is Record<Code, string>. It therefore cannot satisfy a Record
  // over a union carrying one more member, because the seventh key is missing.
  // That is precisely the situation "a seventh ValidationError code without
  // lib/fr copy" describes, expressed without editing the engine.
  //
  // If ERROR_COPY were ever widened to Record<string, string>, this assignment
  // would succeed and the directive below would become unused - so the loose
  // type that would let a code ship uncovered is the change this catches.
  // @ts-expect-error PLANTED_SEVENTH_CODE has no entry in ERROR_COPY, and must not.
  const widened: Record<Code | SeventhCode, string> = ERROR_COPY;

  void widened;

  // ASSERTION 2 - the message function REJECTS an unknown code at the call
  // site. Assertion 1 guards the data; this guards the function, which is the
  // half a caller actually touches. errorMessage's switch ends in a `never`
  // assignment, so a widened parameter type would break there too - but a
  // caller passing an unrecognised code should be refused HERE, before any of
  // that matters.
  // @ts-expect-error a code outside the union is not a ValidationError.
  errorMessage({ code: 'PLANTED_SEVENTH_CODE' });
}

void assertionsCheckedByTsc;
