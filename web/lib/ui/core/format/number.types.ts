// web/lib/ui/core/format/number.types.ts
//
// RULING R97: "formatPercent HAS NO DEFAULT PRECISION - the parameter is
// required. Compile error, not convention."
//
// WHY A TYPE FILE AND NOT A TEST. There is nothing to run. The criterion is
// that a call omitting the precision does not COMPILE, and the only thing that
// can assert that is the compiler - ruling R65: "when tsc enforces a criterion,
// the test says so, and a @ts-expect-error type test is the proof."
//
// THE MECHANISM IS TWO-DIRECTIONAL, which is what makes a directive an
// assertion rather than a suppression. While `decimals` is required, the call
// below is a genuine TS2554 and the directive absorbs it. Restore the default -
// the one change that would let a caller forget the precision again - and the
// directive becomes UNUSED, which tsc reports as TS2578 and the build fails.
// So this file fails loudly in both directions and is silent only while R97
// holds.
//
// WHAT IT COST TO LEARN THIS. `decimals = 1` was a reasonable-looking default
// taken straight from SPEC 6.4's own example. RateDisplay then called
// formatPercent(declarableRate) with one argument, and the figure SPEC 7.3
// says "must match the employer's filing" rendered 39.16 as "39,1 %" on every
// result for three tasks. Nothing failed, because the test asserted
// toContain(formatPercent(39.16)) - the same wrong argument on both sides.
//
// A default is a decision nobody makes at the call site. This file is what
// stops one coming back.
//
// Not a .test.ts: naming it that would make vitest collect a file with no
// tests, and R63's glob canaries would have to account for it.

import { formatPercent } from './number';

// @ts-expect-error R97: the precision is required, so one argument is TS2554.
formatPercent(39.16);

// @ts-expect-error R97: still required when the value is a whole number - the
// case that reads most like it could safely default.
//
// DELIBERATELY NOT 40. This file lives under lib/ui/core, where ruling R73's
// guard forbids a bare 40 or 49.9 - the thresholds must come from the RuleSet
// so that a rule change cannot leave a stale number behind. The first draft of
// this file used 40 here and in the example below, and
// tests/unit/calc-engine/no-magic-thresholds.test.ts caught both. The
// assertion is about the ARITY, so the value is free; using a threshold would
// have been a real instance of what that guard exists to prevent, inside the
// file asserting a different rule.
formatPercent(12);

/**
 * The compiling forms, so this file also documents what a caller should write.
 *
 * These are not assertions - they are here so that a reader who arrives via a
 * TS2554 can see the answer without opening another file.
 */
export const DECLARABLE_RATE_EXAMPLE = formatPercent(39.16, 2);
export const RAW_RATE_EXAMPLE = formatPercent(45, 1);

/**
 * A whole value at one decimal - the shape a threshold label takes.
 *
 * The number is 12 rather than 40 for the reason above: a real threshold
 * belongs to the RuleSet, and R73's guard is right to refuse one here.
 */
export const WHOLE_VALUE_EXAMPLE = formatPercent(12, 1);
