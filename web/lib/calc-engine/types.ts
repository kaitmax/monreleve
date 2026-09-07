// web/lib/calc-engine/types.ts
//
// The engine's public type surface, transcribed from SPEC section 7.4, plus
// taxYear on TeleworkInput per section 7.7.
//
// Pure types. No runtime dependency, no I/O, no clock. Everything readonly:
// a dossier is computed, never mutated.

/** The 26 Swiss cantons. SPEC section 7.4. */
export type Canton =
  | 'AG'
  | 'AI'
  | 'AR'
  | 'BE'
  | 'BL'
  | 'BS'
  | 'FR'
  | 'GE'
  | 'GL'
  | 'GR'
  | 'JU'
  | 'LU'
  | 'NE'
  | 'NW'
  | 'OW'
  | 'SG'
  | 'SH'
  | 'SO'
  | 'SZ'
  | 'TG'
  | 'TI'
  | 'UR'
  | 'VD'
  | 'VS'
  | 'ZG'
  | 'ZH';

/**
 * Derived from the canton, never asked. The 40 % ceiling is the same either
 * way; the consequence of breaching it is not (SPEC section 7.2 step 1).
 */
export type Regime = 'source' | 'residence-1983';

/** How hours become countable days (SPEC section 7.2 step 3). */
export type Granularity = 'day' | 'halfDay' | 'hours';

/**
 * The employer chooses the method and must apply it uniformly; the engine
 * mirrors it and never invents one (SPEC section 7.2 step 2).
 */
export type DenominatorMethod =
  | { readonly kind: 'simplified240' }
  | { readonly kind: 'exact'; readonly totalWorkDays: number };

export interface TeleworkInput {
  /** Resolves the RuleSet. SPEC section 7.7. */
  readonly taxYear: number;
  readonly canton: Canton;
  readonly employmentRate: number; // 1-100
  readonly periodFraction: number; // 0 < f <= 1
  readonly denominator: DenominatorMethod;
  readonly granularity: Granularity;
  readonly teleworkDays: number;
  readonly missionDaysFrance: number;
  readonly missionDaysThirdState: number;
}

export interface TeleworkResult {
  readonly regime: Regime;
  readonly regimeApplies: boolean;
  readonly totalWorkDays: number;
  readonly missionCap: number;
  readonly fiscalCeilingDays: number;
  readonly declarableRate: number; // truncated, 2 dp - for the AFC
  readonly rawRate: number; // rounded up, 1 dp - for display
  readonly swissTaxedDays: number;
  readonly frenchTaxedDays: number;
  readonly creditedMissionDays: number;
  readonly remainingToFiscal: number; // may be negative
  readonly remainingToSocial: number; // may be negative
  readonly warnings: readonly Warning[];
}

export type Warning =
  | { readonly code: 'FISCAL_CEILING_EXCEEDED'; readonly regime: Regime }
  | { readonly code: 'MISSION_CAP_EXCEEDED'; readonly cap: number; readonly excess: number }
  | { readonly code: 'MISSIONS_EXCEED_HEADROOM'; readonly excess: number }
  | { readonly code: 'SOCIAL_CEILING_EXCEEDED' }
  | { readonly code: 'A1_REQUIRED' }
  | { readonly code: 'FRONTALIER_STATUS_AT_RISK' } // residence-1983 only
  | { readonly code: 'EXACT_METHOD_UNVERIFIED' } // user-supplied denominator
  // Ruling R11: ruleSetFor falls back to the latest known set for an unknown
  // year, and the substitution must reach the user rather than being implied
  // by a taxYear a caller has to think to compare.
  | {
      readonly code: 'RULE_SET_FALLBACK';
      readonly requestedYear: number;
      readonly appliedYear: number;
    };

export type ValidationError =
  | { readonly code: 'RATE_OUT_OF_RANGE' }
  | { readonly code: 'PERIOD_OUT_OF_RANGE' }
  | { readonly code: 'NEGATIVE_DAYS'; readonly field: keyof TeleworkInput }
  | { readonly code: 'GRANULARITY_MISMATCH'; readonly field: keyof TeleworkInput }
  | { readonly code: 'DAYS_EXCEED_TOTAL' }
  | { readonly code: 'TOTAL_WORK_DAYS_NOT_POSITIVE' };

/**
 * Invalid input is the expected output of a form, so the engine returns this
 * and never throws (SPEC section 7).
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** The year-keyed constants. SPEC section 7.7. */
export interface RuleSet {
  readonly taxYear: number;
  readonly fiscalCeiling: number;
  readonly socialCeiling: number;
  readonly missionCapDays: number;
  readonly simplifiedBasisDays: number;
  readonly residence1983Cantons: readonly Canton[];
  readonly sources: readonly string[];
}

/** What allowedTeleworkDays answers. SPEC section 7.4. */
export interface AllowedTeleworkDays {
  readonly atFiscal: number;
  readonly atSocial: number;
  readonly missionCap: number;
}
