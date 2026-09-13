// web/scripts/gate-selection.d.mts
//
// Types for gate-selection.mjs, so tests/unit/meta/gate-selection.test.ts can
// import it under the strict config.
//
// WHY A DECLARATION RATHER THAN allowJs. tsconfig.json sets allowJs: false and
// includes only .ts/.tsx; scripts are checked separately by
// tsconfig.scripts.json with strict OFF, and R107's header explains why that
// split exists - "an untyped local in a script that shells out to docker is
// not a defect". Turning allowJs on in the main project to let one test import
// one script would drag six build scripts into the strict config and produce a
// wall of findings that has nothing to do with this ruling.
//
// WHY THE DRIFT IS ACCEPTABLE, stated rather than hoped. A hand-written
// declaration is a second description of one module and can disagree with it.
// What keeps that honest here is that the test exercises the REAL module at
// runtime: a declaration that drifted would still compile, and the assertions
// would fail on the behaviour. The types are for the reader and the compiler;
// the test is the check.

/** A path pattern from R132, with the label used when reporting a match. */
export interface SelectorPattern {
  readonly label: string;
  readonly matches: (path: string) => boolean;
}

/** One changed path and the pattern that claimed it. */
export interface SelectorHit {
  readonly path: string;
  readonly pattern: string;
}

/** The answer: which suites to run, and what made them necessary. */
export interface Selection {
  readonly suites: string[];
  readonly matched: SelectorHit[];
}

/** What a finished suite reported, per R133. */
export interface SuiteCount {
  /** Whether this suite is one that reports a number at all. */
  readonly counted: boolean;
  /** How many tests it says passed, when it says. */
  readonly ran?: number;
  /** Why this is not a pass: a missing count, or a count of zero. */
  readonly failure?: string;
}

export declare const BASE_SUITES: readonly string[];
export declare const SELECTED_SUITES: readonly string[];
export declare const SELECTOR_PATTERNS: readonly SelectorPattern[];
export declare const SUITE_COUNTS: Readonly<Record<string, RegExp>>;

export declare function selectSuites(paths: readonly string[]): Selection;
export declare function describeSelection(selection: Selection): string;
export declare function readCount(
  suite: string,
  output: string,
  floor?: number,
): SuiteCount;
