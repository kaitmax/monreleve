// web/lib/params/codec.ts
//
// SPEC 9.4's codec: two pure functions over the schema.
//
// PURE, AND THAT IS A CONSTRAINT RATHER THAN A STYLE NOTE. No React, no
// window, no Next. The page decodes on the SERVER so a shared link renders its
// result in the first paint, and the island re-encodes in the browser as the
// user edits; the same two functions run in both places and cannot behave
// differently because one of them is holding a DOM.
//
// decode IS TOTAL. It never throws, for any input, ever. SPEC 9.4: "Facebook
// mangles URLs; degrading beats 404." The caller is a page render, and a
// throw there is a 500 for somebody who clicked a link in a thread - so every
// failure is a VALUE: the field falls back to its default and its name goes
// into `invalid`, which the page shows as a dismissible notice.
//
// WHAT ROUND-TRIPS AND WHAT CANNOT. `debut` carries a DATE and the engine
// holds a periodFraction, so the representable fractions are the ones
// remainingYearFraction produces for the days of the tax year. An arbitrary
// 0,3333 is a valid TeleworkInput and is not a shareable scenario - no date
// produces it. encode therefore writes `debut` only when it can find the date
// that produced the fraction, and omits it otherwise rather than inventing
// one. The property test generates dates for exactly this reason.

import { type Canton, type TeleworkInput } from '@/lib/calc-engine';
import { CANTON_NAMES } from '@/lib/fr/cantons';
import { remainingYearFraction } from '@/lib/ui/core';
import {
  GRANULARITY_CODES,
  type GranularityCode,
  METHOD_CODES,
  type MethodCode,
  PARAM_NAMES,
  PARAM_SCHEMA,
  type ParamName,
} from './schema';

/** One day, in milliseconds. UTC throughout, so no zone shifts a boundary. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** SPEC 9.4 types the day fields as ">= 0, step 0.5". */
const HALF = 0.5;

export interface DecodeResult {
  /**
   * The scenario, or null when the link does not carry one.
   *
   * NULL RATHER THAN A PARTIAL INPUT. canton and tt have no defaults, so
   * without them there is nothing to compute and the page shows its ordinary
   * empty state - which is what a bare path does, and what an empty "?" must
   * do too (AC2).
   */
  readonly input: TeleworkInput | null;
  /** Param names the URL carried that this schema does not know. */
  readonly ignored: readonly string[];
  /** Known params whose value could not be read; each fell back. */
  readonly invalid: readonly string[];
}

/**
 * The twenty-six canton codes, as a set.
 *
 * FROM THE DISPLAY LIST, AND THE TYPE IS WHY THAT IS SAFE. The engine
 * exports Canton as a TYPE, which cannot be iterated at runtime, and its
 * validator has no canton error at all - calculateTelework trusts the type,
 * so an unknown code would reach the rule set and compute under whatever
 * regime the default branch gives it. The codec has to check it.
 *
 * lib/fr/cantons.ts declares CANTON_NAMES as Record<Canton, string>, so
 * TypeScript already guarantees its keys are exactly the union - a canton
 * added to the engine is a compile error there until it is named. Reading
 * those keys means there is no second list to drift; writing twenty-six
 * codes out here would be one.
 *
 * It costs the French names in this bundle. The calculator page imports the
 * same module for its select, so on the one route that decodes params they
 * are already there.
 */
const CANTON_CODES: ReadonlySet<Canton> = new Set(
  Object.keys(CANTON_NAMES) as Canton[],
);

/** A type guard, so a checked code narrows instead of needing a cast. */
const isCanton = (value: string): value is Canton => CANTON_CODES.has(value as Canton);
/** A number that is >= 0 and lands on a half-day step. */
function readDays(raw: string): number | null {
  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) return null;

  return Number.isInteger(value / HALF) ? value : null;
}

/** A whole percentage between 1 and 100. */
function readRate(raw: string): number | null {
  const value = Number(raw);

  if (!Number.isInteger(value) || value < 1 || value > 100) return null;

  return value;
}

/** A positive integer count of working days. */
function readTotal(raw: string): number | null {
  const value = Number(raw);

  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * The ISO day that produced a periodFraction, or null.
 *
 * EXPORTED because the island needs it too: seeding the date field from a
 * decoded scenario is the same question encode asks, and two implementations
 * of an inverse are two chances to disagree about which day a fraction means.
 *
 * ARITHMETIC RATHER THAN A SEARCH, and the first version was a search: it
 * walked up to 366 days building a Date and calling remainingYearFraction
 * for each. Correct, and it made the 10 000-case property test time out at
 * five seconds - roughly three and a half million Date constructions. This
 * also runs on every URL update in the browser, so the cost was not only a
 * test problem.
 *
 * remainingYearFraction is (daysBetween(start, 31 Dec) + 1) / daysInYear, so
 * the inverse is exact: remaining = fraction * daysInYear, and the start day
 * is 31 December minus (remaining - 1) days.
 *
 * AND IT IS VERIFIED RATHER THAN TRUSTED. A fraction that no date produces -
 * an arbitrary 0,3333 - inverts to a non-integer day count, and floating
 * point makes "is this an integer" the wrong question to ask directly. So
 * the candidate is rounded, converted back, and compared: if it does not
 * reproduce the fraction exactly, there is no date for it and encode omits
 * `debut` rather than inventing one.
 */
export function isoDayForFraction(fraction: number, taxYear: number): string | null {
  if (fraction === 1) return null;

  const firstOfYear = Date.UTC(taxYear, 0, 1);
  const lastOfYear = Date.UTC(taxYear, 11, 31);
  const daysInYear = Math.round((lastOfYear - firstOfYear) / MS_PER_DAY) + 1;
  const remaining = Math.round(fraction * daysInYear);

  if (remaining < 1 || remaining > daysInYear) return null;

  const candidate = new Date(lastOfYear - (remaining - 1) * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);

  return remainingYearFraction(candidate, taxYear) === fraction ? candidate : null;
}
/** The string a param would carry for this input, or null to omit it. */
function render(name: ParamName, input: TeleworkInput): string | null {
  switch (name) {
    case 'canton':
      return input.canton;

    case 'taux':
      return String(input.employmentRate);

    case 'tt':
      return String(input.teleworkDays);

    case 'mfr':
      return String(input.missionDaysFrance);

    case 'mtiers':
      return String(input.missionDaysThirdState);

    case 'methode':
      return input.denominator.kind === 'exact' ? 'exact' : '240';

    case 'total':
      return input.denominator.kind === 'exact'
        ? String(input.denominator.totalWorkDays)
        : null;

    case 'decompte': {
      const code = (Object.keys(GRANULARITY_CODES) as GranularityCode[]).find(
        (key) => GRANULARITY_CODES[key] === input.granularity,
      );

      return code ?? null;
    }

    case 'debut':
      return isoDayForFraction(input.periodFraction, input.taxYear);

    default: {
      // Exhaustiveness: a tenth param is a compile error here rather than a
      // value silently missing from every URL.
      const unhandled: never = name;

      return unhandled;
    }
  }
}

/**
 * A scenario as a query string.
 *
 * DEFAULTS ARE OMITTED, which is what keeps a shared URL short enough to read
 * before clicking: the ordinary case is `?canton=GE&tt=84`, not nine params of
 * mostly-nothing. The comparison is against the schema's `fallback` STRING
 * rather than a parsed value, so "omit the default" and "write the value"
 * cannot disagree about what the default renders as.
 */
export function encode(input: TeleworkInput): URLSearchParams {
  const params = new URLSearchParams();

  for (const name of PARAM_NAMES) {
    const value = render(name, input);

    if (value === null) continue;
    if (value === PARAM_SCHEMA[name].fallback) continue;

    params.set(name, value);
  }

  return params;
}

/**
 * A query string as a scenario, plus what could not be used.
 *
 * TOTAL. Every branch produces a value; nothing here can throw for any input,
 * which is the property AC2's hostile cases exercise and the reason a mangled
 * URL degrades instead of 500ing.
 */
export function decode(params: URLSearchParams, taxYear: number): DecodeResult {
  const known = new Set<string>(PARAM_NAMES);
  const ignored: string[] = [];
  const invalid: string[] = [];

  for (const name of params.keys()) {
    if (!known.has(name) && !ignored.includes(name)) ignored.push(name);
  }

  const read = (name: ParamName): string | null => params.get(name);

  const canton = read('canton');
  const tt = read('tt');

  if (canton !== null && !isCanton(canton)) invalid.push('canton');

  const teleworkDays = tt === null ? null : readDays(tt);

  if (tt !== null && teleworkDays === null) invalid.push('tt');

  const rateRaw = read('taux');
  const rate = rateRaw === null ? 100 : (readRate(rateRaw) ?? 100);

  if (rateRaw !== null && readRate(rateRaw) === null) invalid.push('taux');

  const franceRaw = read('mfr');
  const france = franceRaw === null ? 0 : (readDays(franceRaw) ?? 0);

  if (franceRaw !== null && readDays(franceRaw) === null) invalid.push('mfr');

  const thirdRaw = read('mtiers');
  const third = thirdRaw === null ? 0 : (readDays(thirdRaw) ?? 0);

  if (thirdRaw !== null && readDays(thirdRaw) === null) invalid.push('mtiers');

  const methodRaw = read('methode');
  const methodCode =
    methodRaw !== null && methodRaw in METHOD_CODES ? (methodRaw as MethodCode) : '240';

  if (methodRaw !== null && !(methodRaw in METHOD_CODES)) invalid.push('methode');

  const totalRaw = read('total');
  const total = totalRaw === null ? null : readTotal(totalRaw);

  if (totalRaw !== null && total === null) invalid.push('total');

  const grainRaw = read('decompte');
  const grainCode =
    grainRaw !== null && grainRaw in GRANULARITY_CODES ? (grainRaw as GranularityCode) : 'j';

  if (grainRaw !== null && !(grainRaw in GRANULARITY_CODES)) invalid.push('decompte');

  const startRaw = read('debut');
  let periodFraction = 1;

  if (startRaw !== null) {
    try {
      const fraction = remainingYearFraction(startRaw, taxYear);

      // A date outside the tax year returns 0 or 1 rather than throwing, and 0
      // is not a period the engine accepts. Treated as unusable rather than
      // passed on to fail validation with a message about something else.
      if (fraction > 0 && fraction <= 1) periodFraction = fraction;
      else invalid.push('debut');
    } catch {
      // remainingYearFraction throws on anything that is not a real ISO day
      // (R28). That is a mangled URL, which is this codec's ordinary case.
      invalid.push('debut');
    }
  }

  // THE EXACT METHOD NEEDS ITS TOTAL. Without a usable one the method falls
  // back to the simplified basis rather than to an exact calculation over a
  // denominator nobody supplied.
  const useExact = methodCode === 'exact' && total !== null;

  if (methodCode === 'exact' && total === null && !invalid.includes('total')) {
    invalid.push('total');
  }

  if (canton === null || !isCanton(canton) || teleworkDays === null) {
    return { input: null, ignored, invalid };
  }

  return {
    input: {
      taxYear,
      canton,
      employmentRate: rate,
      periodFraction,
      denominator: useExact
        ? { kind: 'exact', totalWorkDays: total }
        : { kind: 'simplified240' },
      granularity: GRANULARITY_CODES[grainCode],
      teleworkDays,
      missionDaysFrance: france,
      missionDaysThirdState: third,
    },
    ignored,
    invalid,
  };
}
