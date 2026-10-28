// web/lib/lamal/types.ts
//
// The shapes of the LAMal / CMU comparator. Pure data; no React, no I/O, no
// clock (R657). NOT lib/calc-engine and never importing it: a different
// domain, different sources, a different verification status - the lint
// fence in eslint.config.mjs asserts the separation.

/** The three premium classes of the OFSP file (LAMal art. 16a, OAMal art. 91). */
export type AgeClass = 'adult' | 'youngAdult' | 'child';

/** One class's monthly premium, with and without accident cover, in CHF centimes. */
export interface ClassPremium {
  readonly withAccident: number;
  readonly withoutAccident: number;
}

/** One insurer's France premiums. Identified by its OFSP number, never named (R668). */
export interface InsurerPremiums {
  readonly ofsp: number;
  readonly adult: ClassPremium;
  readonly youngAdult: ClassPremium;
  readonly child: ClassPremium;
}

/** One premium year, as web/scripts/lamal-generate.mjs writes it. */
export interface PremiumYearTable {
  readonly premiumYear: number;
  readonly sourceFile: string;
  readonly sourceSha256: string;
  /** ISO date the dataset was read (the operator's collection). */
  readonly readOn: string;
  /** The franchise each class's premium carries, in CHF. */
  readonly franchiseChf: Readonly<Record<AgeClass, number>>;
  readonly insurers: readonly InsurerPremiums[];
}

/**
 * Whether a PASS is final or only announced (R671). 2027's figure was
 * announced by URSSAF on 20.10.2026 with the arrêté still to be published.
 */
export type PassStatus = 'final' | 'announced';

/** Everything one comparison year needs, never mixed with another year's. */
export interface ComparatorYear {
  readonly year: number;
  readonly premiums: PremiumYearTable;
  /** Plafond annuel de la sécurité sociale, in whole euros. */
  readonly passEur: number;
  readonly passStatus: PassStatus;
  /** ISO date of the URSSAF page the PASS was read from. */
  readonly passPageDate: string;
  /** D380-2 I: the rate, in percent. */
  readonly ratePercent: number;
  /** D380-2 I: the allowance, as a share of the PASS, in percent. */
  readonly allowancePercentOfPass: number;
}

/** The ECB reference rate the Swiss figures are converted at (R672). */
export interface ExchangeRate {
  /** CHF for one euro, in ten-thousandths (0,9239 -> 9239). */
  readonly chfPerEurTenThousandths: number;
  /** ISO date of the rate. */
  readonly date: string;
}

/** One person of the household as the form describes them. */
export interface PersonInput {
  readonly birthYear: number;
  readonly withAccident: boolean;
}

export interface ComparatorInput {
  readonly year: number;
  /** A, in whole euros: the revenu fiscal de référence of the year before last. */
  readonly incomeEur: number;
  /** persons[0] is the frontalier; the others follow their option (row D8). */
  readonly persons: readonly PersonInput[];
}

/** A household total across the insurers, annual, in CHF centimes and in euros. */
export interface SwissSpread {
  readonly lowestCentimes: number;
  readonly medianCentimes: number;
  readonly highestCentimes: number;
  /** Converted at the ECB rate and rounded to the euro. */
  readonly lowestEur: number;
  readonly medianEur: number;
  readonly highestEur: number;
  readonly insurerCount: number;
}

export interface FrenchContribution {
  /** round(A - allowance), floored at 0 (PARK-28). */
  readonly baseEur: number;
  readonly contributionEur: number;
  /** True when A is below the allowance and the formula's negative result is shown as 0. */
  readonly floored: boolean;
  readonly allowanceEur: number;
}

/**
 * Which side is cheaper ACROSS THE WHOLE SPREAD. `depends` when the French
 * contribution falls between the lowest and the highest Swiss figure, or on
 * either bound: then the answer is the insurer, not the system.
 */
export type Cheaper = 'france' | 'switzerland' | 'depends';

export interface PersonResult extends PersonInput {
  readonly ageClass: AgeClass;
  /** Premium year minus year of birth: the age reached on 31 December. */
  readonly age: number;
}

export interface Comparison {
  readonly year: ComparatorYear;
  readonly rate: ExchangeRate;
  readonly incomeEur: number;
  readonly persons: readonly PersonResult[];
  readonly swiss: SwissSpread;
  readonly french: FrenchContribution;
  readonly cheaper: Cheaper;
}

export type ComparatorError =
  | { readonly code: 'YEAR_UNAVAILABLE'; readonly year: number }
  | { readonly code: 'INCOME_INVALID' }
  | { readonly code: 'NO_PERSON' }
  | { readonly code: 'BIRTH_YEAR_INVALID'; readonly index: number };

export type ComparatorResult =
  | { readonly ok: true; readonly value: Comparison }
  | { readonly ok: false; readonly error: ComparatorError };
