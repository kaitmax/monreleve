// web/lib/ui/core/format/number.ts
//
// SPEC 6.4: formatPercent(34.6) -> "34,6 %" (U+00A0), formatDays(1234.5) ->
// "1 234,5" (U+202F), "Intl output normalised, codepoints asserted, every
// number through format/." SPEC 20 Never: "trust Intl codepoints
// unnormalised."
//
// THE DESIGN IN ONE SENTENCE: Intl is used for the arithmetic of digit
// grouping and rounding, and for nothing else - every separator in the output
// is written by this file.
//
// That is not defensiveness, it is the only thing that makes the codepoint
// guarantee hold. Three measurements on this build (Node 22.14, ICU 76.1,
// CLDR 46) say why.
//
//   The separator is per-locale DATA, not a property of French. fr, fr-FR,
//   fr-CH and fr-BE group with U+202F; fr-CA groups with U+00A0 and fr-LU
//   with U+002E. So "French uses a narrow no-break space" is true of a
//   subtag, not of a language, and it can change with a CLDR release.
//
//   The obvious normaliser is a no-op. .replace(' ', NNBSP) searches for the
//   character it already expects, so on this build it finds nothing to do and
//   the codepoint assertions pass anyway - and it would keep passing after fr
//   moved. Worse, /\s/ matches BOTH no-break spaces, so the tidy-looking
//   .replace(/\s/g, ...) rewrites a separator that was already correct.
//
//   format() and formatToParts() can disagree for the SAME formatter.
//   Measured: en-US timeStyle 'short' yields U+0020 from format() and U+202F
//   from formatToParts(). So a normaliser that locates a separator with one
//   API and substitutes in the other can silently do nothing.
//
// Hence normaliseNumber below: the parts are read, the separators are
// REPLACED rather than searched for, and the two APIs are never mixed.
//
// WHAT IS DELIBERATELY NOT USED. Intl's style:'percent' multiplies by 100 -
// measured, format(34.6) gives "3 460 %" - so using it forces every caller
// to divide by 100 first, and 34.6/100 is 0.34600000000000003. That is the
// exact float error rulings R16 and R26 exist to remove, reintroduced in the
// last hop before the user sees the number. The percent sign is appended
// here instead.

/** U+202F NARROW NO-BREAK SPACE. The thousands group separator (SPEC 6.4). */
const GROUP_SEPARATOR = '\u202F';

/** U+002C COMMA. The decimal separator. */
const DECIMAL_SEPARATOR = ',';

/** U+00A0 NO-BREAK SPACE. Between figure and percent sign (SPEC 6.4). */
const PERCENT_SPACE = '\u00A0';

/** U+002D HYPHEN-MINUS, so a sign can never arrive as U+2212 instead. */
const MINUS = '-';

/**
 * The locale is used for DIGIT SHAPE and GROUPING POSITION only. Every
 * separator it would contribute is overwritten by normaliseNumber, so moving
 * this string cannot change the output's codepoints - which is the point.
 */
const LOCALE = 'fr-FR';

/**
 * Truncate, never round up.
 *
 * Measured: Intl's default (halfExpand) renders 39.95 at one decimal as
 * "40,0" - a rate BELOW the fiscal ceiling displayed as one that reaches it.
 * trunc renders "39,9". declarable-rate.ts truncates for the same reason, so
 * this keeps the formatter consistent with the engine and means no rate can
 * be shown crossing a threshold it did not cross.
 */
const ROUNDING = 'trunc' as const;

/**
 * Assemble a formatted number from its parts, substituting every separator.
 *
 * Exported for one reason: it is the seam where ICU-independence can actually
 * be tested. The suite feeds it parts from fr-CA (which groups with U+00A0)
 * and fr-LU (which groups with U+002E) and requires U+202F back. A normaliser
 * that searched for the separator it expected would pass every other test in
 * the file and fail those two.
 */
export function normaliseNumber(parts: readonly Intl.NumberFormatPart[]): string {
  return parts
    .map((part) => {
      switch (part.type) {
        case 'group':
          return GROUP_SEPARATOR;
        case 'decimal':
          return DECIMAL_SEPARATOR;
        case 'minusSign':
          return MINUS;
        default:
          return part.value;
      }
    })
    .join('');
}

function requireFinite(value: number, formatter: string): void {
  if (!Number.isFinite(value)) {
    // "NaN %" on a filing document is worse than a crash: it looks like a
    // number the reader is meant to act on.
    throw new RangeError(`${formatter} needs a finite number, received ${value}`);
  }
}

function digits(value: number, minimumFractionDigits: number, maximumFractionDigits: number): string {
  const formatter = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits,
    roundingMode: ROUNDING,
    // 'always', not the default. A locale with minimumGroupingDigits of 2 -
    // or useGrouping 'min2' - renders 1000 with NO separator at all, so a
    // test asserting the separator is the right character would pass while
    // the separator was absent. This makes its presence structural.
    useGrouping: 'always',
  });

  return normaliseNumber(formatter.formatToParts(value));
}

/**
 * A percentage, in French, with the mandated U+00A0 before the sign.
 *
 * PRECISION IS REQUIRED - RULING R97, and the default it replaces cost this
 * product a wrong number on a page. `decimals` used to default to 1, which is
 * SPEC 6.4's own example (formatPercent(34.6) -> "34,6 %"). RateDisplay then
 * called it with one argument for BOTH rates, so the declarable rate - the
 * figure SPEC 7.3 says "must match the employer's filing" - rendered 39.16 as
 * "39,1 %". The formatter is pinned to trunc, so the digit was not rounded
 * away, it was cut off.
 *
 * A default is a decision nobody makes at the call site. Every caller now
 * states the precision it means, and forgetting is a COMPILE ERROR rather than
 * a plausible-looking number:
 *
 *   declarable rate   2   SPEC 7.3, the filed figure
 *   raw rate          1   R26's second domain, a share of days
 *   threshold labels  0 or 1, depending on whether the value is whole
 *
 * number.types.ts asserts the requirement at type level (ruling R65), so
 * widening it back to a default fails the build rather than passing silently.
 */
export function formatPercent(value: number, decimals: number): string {
  requireFinite(value, 'formatPercent');

  return `${digits(value, decimals, decimals)}${PERCENT_SPACE}%`;
}

/**
 * A count of days, grouped with U+202F.
 *
 * Zero to one decimal: days arrive as whole days and half-days, so "240,0"
 * would imply a precision the input does not have, and "96,5" must keep its
 * half.
 */
export function formatDays(value: number): string {
  requireFinite(value, 'formatDays');

  return digits(value, 0, 1);
}

/** A day count whose sign the caller renders itself. */
export interface SignedDays {
  /** The magnitude, already formatted. Carries no sign character. */
  readonly text: string;
  readonly negative: boolean;
}

/**
 * remainingToFiscal and remainingToSocial may be negative (SPEC 7.4), and a
 * negative headroom is not "minus four days" - it is four days over, which
 * French says with a word ("dépassé de") rather than a glyph.
 *
 * So the sign comes back as a flag and never enters the text: the UI chooses
 * the wording, and no minus sign can arrive as U+2212 from one code path and
 * U+002D from another. Negative zero reports positive, because zero days
 * remaining is not a deficit.
 */
export function formatSignedDays(value: number): SignedDays {
  requireFinite(value, 'formatSignedDays');

  return { text: formatDays(Math.abs(value)), negative: value < 0 };
}
