// web/scripts/ci-readiness.d.mts
//
// R185: a hand-written declaration for a local module is generated or
// ASSERTED, never argued. tests/unit/meta/declaration-parity.test.ts imports
// both this file and the implementation and requires their exported names to
// match, so an export added to one and forgotten in the other goes red here
// rather than as a compile error on whoever writes the next caller.

/** What CI will do with a push, and why. */
export interface CiReadiness {
  /**
   * `refused` is the only state that costs anything: CI_FULL on while the
   * repository is private, where GitHub starts no job at all.
   */
  readonly state: 'refused' | 'quiet' | 'ready' | 'unknown';
  readonly why: string;
}

export declare function ciReadiness(): CiReadiness;

/**
 * Two `gh` answers, classified (R233).
 *
 * Exported so a test can reach the PARSING without the I/O: the condition this
 * guard detects cannot be reproduced locally, but turning gh's answer into a
 * boolean is pure - and that is where the 22 September misreading lived.
 */
export declare function classifyReadiness(
  visibility: string,
  variables: string,
): CiReadiness;

export declare function describeReadiness(result: CiReadiness): string;
