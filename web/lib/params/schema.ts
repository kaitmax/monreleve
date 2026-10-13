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
  'rythme',
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

/**
 * A field of the FORECAST rather than of the engine input (R343).
 *
 * WHY THIS TYPE EXISTS AT ALL. Until the rhythm, every parameter mapped
 * into TeleworkInput, and this file's header rested the privacy argument on
 * exactly that: the engine input holds days, a rate, a canton and a method,
 * so there is nowhere for a name to go. The rhythm is not an engine input -
 * it is what the projection imagines the rest of the year from - so that
 * sentence no longer covers the whole set on its own.
 *
 * THE ARGUMENT IS EXTENDED RATHER THAN DROPPED, and it comes out stronger.
 * A forecast field's value space is closed and enumerable: the rhythm is
 * three symbols in five positions, 243 legal strings, every one of them
 * checked by rhythm.test.ts. A format with 243 legal values cannot carry an
 * identity whatever anybody types. schema.test.ts asserts both halves - that
 * every parameter maps into one of the two sets, and that this set stays
 * tiny (R206: asserted, never merely small).
 */
export type ForecastField = 'rhythm';

export interface ParamSpec {
  /**
   * The field this param carries: a TeleworkInput field for the nine that
   * reach the engine, or a forecast field for the rhythm (R343).
   */
  readonly field: EngineField | ForecastField;
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

  // R343, AND THE OPERATOR AUTHORISED IT IN THOSE WORDS: "THE CALCULATOR
  // GAINS URL PARAMETERS FOR THE RHYTHM ... URL parameters are permanent:
  // shared links will carry them for years (R156). The operator authorises
  // adding them here."
  //
  // THE NAME IS IN THE STYLE OF THE NINE ABOVE: lowercase, French, and a
  // whole word where the word is short - `methode`, `decompte`, `rythme`.
  //
  // THE DEFAULT IS NO RHYTHM, not five Swiss days. The question is optional
  // and an absent answer must behave exactly as the calculator did before
  // this parameter existed: a current figure and no projection. encode
  // compares against this string and omits it, so every link shared before
  // today keeps the shape it has.
  rythme: { field: 'rhythm', fallback: null },
};

/** SPEC 9.4's three-value code for Granularity, and back. */
/**
 * PARAMS A FORM SUBMITS THAT THE ENGINE DOES NOT READ.
 *
 * `missions` is the calculator's yes/no question. It is a real control -
 * it reveals the two mission-count fields, and SPEC 9.3 puts it outside the
 * accordion precisely so nobody misses it - but it carries no value the
 * engine wants: the COUNTS do. A browser submits every named control, so it
 * arrives in the query and decode() correctly reports it as a param it does
 * not know.
 *
 * WITHOUT THIS LIST THE READER IS TOLD SOMETHING FALSE. The notice would
 * say "ces parametres ne sont pas utilises par le calculateur : missions"
 * to somebody who had just answered that question - that sentence is for a
 * tracking parameter a platform appended, and this is not one.
 *
 * ASSERTED EMPTY OF EVERYTHING ELSE (R206). A second entry is a second
 * param a reader can be shown no explanation for, so it has to survive its
 * own argument rather than join an established habit.
 */
export const FORM_ONLY_PARAMS = ['missions'] as const;

/**
 * decode()’s `ignored` with the form’s own controls taken out.
 *
 * ONE FILTER, BOTH SURFACES, AND THE SECOND ONE IS WHY THIS IS A FUNCTION.
 * The result page was written with this filter inline and the island was
 * not, which left the wrong sentence reachable by a path the walkthrough had
 * already driven: the result page’s "Modifier mes chiffres" link carries the
 * query back to the calculator, the island decodes it on mount, and a reader
 * who had just answered the mission question would be told the calculator
 * does not use it. Fixing one surface and leaving the other is the half-
 * applied finding R267 is about.
 */
export function strayParams(ignored: readonly string[]): string[] {
  const formOnly: readonly string[] = FORM_ONLY_PARAMS;

  return ignored.filter((name) => !formOnly.includes(name));
}

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

/**
 * THE TABLES READ BACKWARDS, EXPORTED, so that nothing has to write them out
 * a second time.
 *
 * encode() needed this direction from the start and did it inline. R351 gave
 * it a second caller: the calculator form submits by GET, so every radio’s
 * `value` attribute has to BE the code the URL carries - a control named
 * `decompte` whose value is `halfDay` reaches decode() as unreadable, falls
 * back to whole days, and answers a different question in silence (measured).
 *
 * A SECOND MAP IN THE ISLAND WOULD BE THE DEFECT R206 NAMES: two descriptions
 * of one vocabulary, correct on the day they are written. These derive from
 * the same object decode() reads, so a fourth granularity cannot reach one
 * side without reaching the other.
 */
export function granularityCode(granularity: TeleworkInput['granularity']): GranularityCode {
  const code = (Object.keys(GRANULARITY_CODES) as GranularityCode[]).find(
    (key) => GRANULARITY_CODES[key] === granularity,
  );

  // UNREACHABLE BY CONSTRUCTION - the table is `satisfies Record<_,
  // Granularity>` and its keys cover the union - but TypeScript cannot see
  // that through `find`, and a non-null assertion here would be the one
  // place a fourth granularity could land without a compile error.
  return code ?? 'j';
}

/** The same, for the denominator method. */
export function methodCode(kind: TeleworkInput['denominator']['kind']): MethodCode {
  return kind === 'exact' ? 'exact' : '240';
}
