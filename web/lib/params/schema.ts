// web/lib/params/schema.ts
//
// SPEC 9.4's nine parameters, as data. THE NAMES ARE A PUBLIC CONTRACT.
//
// "Names are frozen once published - links live in Facebook threads for years
// and a renamed param breaks them silently." That last word is the reason this
// is a schema rather than nine `searchParams.get` calls scattered through a
// page: a rename in one place is a diff nobody reads twice, and the person
// whose link stopped working sees a calculator full of defaults and assumes
// they mis-copied it. SPEC 20 makes adding or renaming one an ask-first item;
// tests/unit/params/schema.test.ts asserts the list element by element so the
// asking is unavoidable.
//
// NO PERSONAL DATA IS REPRESENTABLE, and that is a property of this file
// rather than of validation downstream. Every param maps to a field of
// TeleworkInput, which holds days, a rate, a canton and a method - there is
// nowhere for a name, a salary or an employer to go. A schema with no field
// for a thing cannot carry it whatever anybody types.
//
// taxYear IS DELIBERATELY NOT A PARAM. It comes from the server's Europe/Paris
// clock (R55). A param for it would let a link pin the calculator to a year
// whose rules it is not showing, which is the kind of wrong that looks right.
//
// NO DEPENDENCIES. This module is imported by the codec, by the page's server
// render and by tests; it must not drag React, Next or the engine's runtime
// anywhere. The one import is a type.

import type { TeleworkInput } from '@/lib/calc-engine';

/**
 * The nine names, in SPEC 9.4's tabulated order.
 *
 * ORDER IS PART OF THE CONTRACT because encode walks this list: a shared URL
 * reads canton first and debut last, the way the table does, so two links to
 * the same scenario are the same string.
 */
export const PARAM_NAMES = [
  'canton',
  'taux',
  'tt',
  'mfr',
  'mtiers',
  'methode',
  'total',
  'decompte',
  'debut',
] as const;

export type ParamName = (typeof PARAM_NAMES)[number];

/**
 * Which field of TeleworkInput a param carries, as a path.
 *
 * A STRING PATH RATHER THAN A FUNCTION, so the mapping can be ASSERTED: the
 * schema test checks every param maps into the engine's input and that the
 * nine between them reach everything except the tax year. A pair of closures
 * would be equivalent code and unreadable as a table.
 */
export type EngineField =
  | keyof Omit<TeleworkInput, 'denominator'>
  | 'denominator.kind'
  | 'denominator.totalWorkDays';

export interface ParamSpec {
  /** The TeleworkInput field this param carries. */
  readonly field: EngineField;
  /**
   * What an ABSENT param means, as the string a present one would have had -
   * or null where SPEC 9.4's table leaves the default column empty, which is
   * the same as saying the calculator cannot compute without it.
   *
   * AS A STRING, NOT A VALUE, on purpose: it is what encode compares against
   * when deciding to omit a param, and comparing the rendered form is the only
   * way "omit the default" and "write the value" can be guaranteed to agree.
   */
  readonly fallback: string | null;
}

export const PARAM_SCHEMA: Readonly<Record<ParamName, ParamSpec>> = {
  // No default: the canton decides the regime, and there is no defensible
  // guess. A link without it pre-fills nothing.
  canton: { field: 'canton', fallback: null },

  // Full time. The overwhelming case, so omitting it keeps shared URLs short.
  taux: { field: 'employmentRate', fallback: '100' },

  // NO DEFAULT, and SPEC 9.4's table is the authority: its default column is
  // empty for this row. So encode always writes tt, even when it is 0, and a
  // URL without it pre-fills nothing - the same as a URL without a canton.
  //
  // The first draft of this file gave it a fallback of 0 with a comment
  // saying it had no default. Both readings round-trip; only one is the
  // contract, and a link that omits the number the reader came for is not a
  // shared scenario.
  tt: { field: 'teleworkDays', fallback: null },

  mfr: { field: 'missionDaysFrance', fallback: '0' },
  mtiers: { field: 'missionDaysThirdState', fallback: '0' },

  // The simplified 240-day basis, which is what most employers use and what
  // every Geneva published case uses.
  methode: { field: 'denominator.kind', fallback: '240' },

  // Only meaningful under the exact method, and absent otherwise.
  total: { field: 'denominator.totalWorkDays', fallback: null },

  // SPEC 9.4's default is whole days. The FORM starts at half-days (FW11,
  // because its day field steps by 0.5) and the two do not contradict: this
  // is what an ABSENT param means, and that is what a form that starts empty
  // begins at. A link from a half-day form carries decompte=dj explicitly.
  decompte: { field: 'granularity', fallback: 'j' },

  // No default: a whole year, expressed as the absence of a start date.
  debut: { field: 'periodFraction', fallback: null },
};

/** SPEC 9.4's three-value code for Granularity, and back. */
export const GRANULARITY_CODES = {
  j: 'day',
  dj: 'halfDay',
  h: 'hours',
} as const satisfies Record<string, TeleworkInput['granularity']>;

export type GranularityCode = keyof typeof GRANULARITY_CODES;

/** SPEC 9.4's two-value code for the denominator method. */
export const METHOD_CODES = {
  '240': 'simplified240',
  exact: 'exact',
} as const satisfies Record<string, TeleworkInput['denominator']['kind']>;

export type MethodCode = keyof typeof METHOD_CODES;
