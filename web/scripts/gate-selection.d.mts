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
  /** The suites a match requires, beyond the base chain. */
  readonly suites: readonly string[];
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

// THE DRIFT THIS FILE PREDICTED HAPPENED, TWICE, AND IS RECORDED HERE RATHER
// THAN QUIETLY FIXED.
//
// The header above says a hand-written declaration "is a second description of
// one module and can disagree with it", and argues the disagreement is safe
// because the test exercises the real module at runtime. That argument holds
// for a declaration that is WRONG. It does not cover one that is INCOMPLETE:
// an omitted export is not a type that disagrees, it is a compile error on
// correct code, and the failure lands on whoever adds the next export rather
// than on whoever forgot the last one.
//
//   RUNTIME_SUITES  added to the module when test:runtime became selectable,
//                   never added here. Nothing noticed because no test imported
//                   it.
//   LATE_SUITES     added by R182. tsc refused a correct test, and the first
//                   three diagnoses were wrong - a stale tsbuildinfo, the `@/`
//                   alias, then a duplicate file - because the error says
//                   "no exported member" of a module whose source plainly
//                   exports it. The module TypeScript reads is this file.
//
// R181's shape, one layer out: this IS a transcription of something else, and
// the honest reading is that it should be derived. It is kept because the
// alternative - allowJs in the strict project - drags six build scripts into
// it for one import, which R107's header already argued against.
/** web/, derived from the module's own location rather than from the cwd. */
export declare const PACKAGE_ROOT: string;

export declare const BASE_SUITES: readonly string[];
export declare const BROWSER_SUITES: readonly string[];
export declare const DATABASE_SUITES: readonly string[];
export declare const RUNTIME_SUITES: readonly string[];
export declare const LATE_SUITES: readonly string[];
export declare const SELECTOR_PATTERNS: readonly SelectorPattern[];
export declare const SUITE_COUNTS: Readonly<Record<string, RegExp>>;

/**
 * Every source file the database suite transitively depends on (R218).
 *
 * Package-relative POSIX paths. Memoised per root.
 */
export declare function databaseClosure(root: string): ReadonlySet<string>;

export declare function selectSuites(paths: readonly string[]): Selection;
export declare function describeSelection(selection: Selection): string;
export declare function readCount(
  suite: string,
  output: string,
  floor?: number,
): SuiteCount;
