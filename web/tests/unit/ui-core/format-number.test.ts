// web/tests/unit/ui-core/format-number.test.ts
//
// SPEC 6.4: formatPercent(34.6, 1) -> "34,6 %" (U+00A0), formatDays(1234.5) ->
// "1 234,5" (U+202F). "Intl output normalised, codepoints asserted, every
// number through format/." SPEC 20 Never: "trust Intl codepoints
// unnormalised."
//
// THREE TRAPS, each measured on this build rather than assumed.
//
// 1. THE SPEC'S OWN LITERALS ARE ASCII. Extracting the codepoints of
//    SPEC 6.4's "34,6 %" and "1 234,5" gives U+0020 in both - the U+00A0 and
//    U+202F are prose annotations, not the characters in the file. So an
//    expected string pasted from the spec asserts the WRONG codepoint, and
//    the mistake is invisible in every editor and every diff. Every expected
//    string here is therefore built from \u escapes, and a meta-test asserts
//    this file's own source contains no literal U+00A0 or U+202F.
//
// 2. /\s/ MATCHES BOTH. The plausible normaliser .replace(/\s/g, ' ') turns
//    Intl's already-correct U+202F group separator into something else while
//    a visual toBe() still passes. NFKC and trim() destroy both too. So the
//    assertions below are on charCodeAt, never on how the string looks.
//
// 3. THE SEPARATOR IS PER-LOCALE DATA, NOT A PROPERTY OF FRENCH. Measured on
//    Node 22.14 / ICU 76.1 / CLDR 46: fr, fr-FR, fr-CH and fr-BE group with
//    U+202F, but fr-CA groups with U+00A0 and fr-LU with U+002E. The feared
//    inversion is one subtag away, and it means a normaliser that searches
//    for the codepoint it already expects is a no-op both today and after any
//    CLDR change. normaliseNumber is therefore tested against fr-CA and
//    fr-LU formatters directly: it must return U+202F from separators that
//    are not U+202F.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  formatDays,
  formatPercent,
  formatSignedDays,
  normaliseNumber,
} from '@/lib/ui/core/format/number';

/** U+00A0 NO-BREAK SPACE - between figure and percent sign. */
const NBSP = '\u00A0';
/** U+202F NARROW NO-BREAK SPACE - the thousands group separator. */
const NNBSP = '\u202F';
/** U+002C COMMA - the decimal separator. */
const COMMA = ',';

const codepoints = (text: string): string[] =>
  [...text].map((char) => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);

describe('formatPercent', () => {
  it('renders SPEC 6.4 example exactly', () => {
    expect(formatPercent(34.6, 1)).toBe(`34${COMMA}6${NBSP}%`);
  });

  it('separates figure from percent sign with U+00A0, not a plain space', () => {
    // The assertion that a pasted expected string cannot make. U+0020 and
    // U+00A0 are indistinguishable on screen; only the codepoint separates
    // them, and only U+00A0 stops "34,6" and "%" being split across a line.
    const rendered = formatPercent(34.6, 1);
    const spaceIndex = rendered.length - 2;

    expect(rendered.charCodeAt(spaceIndex)).toBe(0x00a0);
    expect(rendered.charCodeAt(spaceIndex)).not.toBe(0x0020);
    expect(rendered.charCodeAt(spaceIndex)).not.toBe(0x202f);
    expect(codepoints(rendered)).toEqual([
      'U+0033',
      'U+0034',
      'U+002C',
      'U+0036',
      'U+00A0',
      'U+0025',
    ]);
  });

  it('uses a comma for the decimal separator', () => {
    expect(formatPercent(34.6, 1).charCodeAt(2)).toBe(0x002c);
  });

  it('keeps a trailing zero at the requested precision', () => {
    // SPEC 9.3 displays "45,0 %". A percentage that drops its decimal reads
    // as a different precision than the one the engine computed.
    expect(formatPercent(45, 1)).toBe(`45${COMMA}0${NBSP}%`);
    expect(formatPercent(40, 1)).toBe(`40${COMMA}0${NBSP}%`);
  });

  it('takes a REQUIRED precision, and renders exactly what it is asked for', () => {
    // Ruling R26 requires two decimals for declarableRate while SPEC 6.4's
    // formatPercent(34.6, 1) -> "34,6 %" is one, on the same input. One
    // function with a precision argument satisfies both; a second exported
    // formatter for the other precision would be two places to change.
    //
    // THE PRECISION USED TO DEFAULT TO 1, and ruling R97 removed the default
    // after that default put a wrong number on a page: RateDisplay called
    // formatPercent(declarableRate) with one argument, so 39.16 - the figure
    // SPEC 7.3 says must match the employer's filing - rendered "39,1 %".
    // The two lines below are the same input at both precisions, which is
    // exactly the ambiguity a default resolved silently and wrongly.
    expect(formatPercent(39.16, 2)).toBe(`39${COMMA}16${NBSP}%`);
    expect(formatPercent(39.16, 1)).toBe(`39${COMMA}1${NBSP}%`);
  });

  it('truncates rather than rounding up, so a rate cannot cross a ceiling', () => {
    // Measured: Intl's default halfExpand renders 39.95 at one decimal as
    // "40,0" - a rate below the fiscal ceiling displayed as one that reaches
    // it. trunc renders "39,9". This matches declarable-rate.ts, which
    // truncates for the same reason, and it means the formatter can never
    // invent a breach.
    expect(formatPercent(39.95, 1)).toBe(`39${COMMA}9${NBSP}%`);
    expect(formatPercent(39.99, 1)).toBe(`39${COMMA}9${NBSP}%`);
    expect(formatPercent(49.89, 1)).toBe(`49${COMMA}8${NBSP}%`);
  });

  it('never multiplies by 100', () => {
    // Intl's style:'percent' would: measured, format(34.6) gives "3 460 %".
    // Using it forces callers to divide by 100 first, and 34.6/100 is
    // 0.34600000000000003 - the exact float error R16 and R26 exist to
    // remove, reintroduced in the last hop.
    expect(formatPercent(34.6, 1)).not.toContain('3 460');
    expect(formatPercent(100, 1)).toBe(`100${COMMA}0${NBSP}%`);
  });

  it('rejects a non-finite value', () => {
    // "NaN %" on a filing document is worse than a crash.
    expect(() => formatPercent(Number.NaN, 1)).toThrow(RangeError);
    expect(() => formatPercent(Number.POSITIVE_INFINITY, 1)).toThrow(RangeError);
  });
});

describe('formatDays', () => {
  it('renders SPEC 6.4 example exactly', () => {
    expect(formatDays(1234.5)).toBe(`1${NNBSP}234${COMMA}5`);
  });

  it('groups thousands with U+202F, not U+00A0 and not a plain space', () => {
    // The two no-break spaces are a pixel apart on screen and a world apart
    // in a filing. This is the one FW1 parked as owed.
    const rendered = formatDays(1234.5);

    expect(rendered.charCodeAt(1)).toBe(0x202f);
    expect(rendered.charCodeAt(1)).not.toBe(0x00a0);
    expect(rendered.charCodeAt(1)).not.toBe(0x0020);
    expect(codepoints(rendered)).toEqual([
      'U+0031',
      'U+202F',
      'U+0032',
      'U+0033',
      'U+0034',
      'U+002C',
      'U+0035',
    ]);
  });

  it('groups at a thousand exactly', () => {
    // useGrouping:'min2' and any locale with minimumGroupingDigits=2 emit
    // "1000" with no separator at all, so a test that only checks the
    // separator is CORRECT would pass while the separator is ABSENT.
    expect(formatDays(1000)).toBe(`1${NNBSP}000`);
    expect(formatDays(1000).length).toBe(5);
  });

  it('omits the decimal for a whole number of days', () => {
    // Days arrive as whole days and half-days. "240,0" implies a precision
    // the input does not have.
    expect(formatDays(240)).toBe('240');
    expect(formatDays(0)).toBe('0');
  });

  it('keeps the half day', () => {
    expect(formatDays(96.5)).toBe(`96${COMMA}5`);
    expect(formatDays(0.5)).toBe(`0${COMMA}5`);
  });

  it('rejects a non-finite value', () => {
    expect(() => formatDays(Number.NaN)).toThrow(RangeError);
  });
});

describe('formatSignedDays', () => {
  it('returns the absolute value and the sign separately', () => {
    // remainingToFiscal and remainingToSocial may be negative (SPEC 7.4).
    // The sign is returned as a flag rather than rendered into the string so
    // the UI can carry it as a word - "dépassé de" - or as a glyph of its
    // choosing, and so no minus sign enters the text where it could be
    // U+002D or U+2212 depending on who produced it.
    expect(formatSignedDays(12.5)).toEqual({ text: `12${COMMA}5`, negative: false });
    expect(formatSignedDays(-12.5)).toEqual({ text: `12${COMMA}5`, negative: true });
  });

  it('carries no sign character in the text', () => {
    expect(formatSignedDays(-1234.5).text).toBe(`1${NNBSP}234${COMMA}5`);
    expect(formatSignedDays(-1).text).not.toContain('-');
    expect(formatSignedDays(-1).text).not.toContain('\u2212');
  });

  it('treats zero as not negative', () => {
    expect(formatSignedDays(0)).toEqual({ text: '0', negative: false });
    // Negative zero is still zero days remaining, not a deficit.
    expect(formatSignedDays(-0)).toEqual({ text: '0', negative: false });
  });
});

describe('normalisation does not depend on what ICU happens to hand us', () => {
  // This is the test that makes "Intl output normalised" mean something. A
  // normaliser written as .replace(/ /g, NNBSP) searches for the separator it
  // already expects, so it is a no-op on this build and silently wrong on any
  // build where fr moves - and every codepoint assertion above would still
  // pass, because CLDR agrees with the spec today.

  it('turns U+00A0 grouping into U+202F - the fr-CA case', () => {
    // Measured on this build: fr-CA groups with U+00A0.
    const parts = new Intl.NumberFormat('fr-CA', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).formatToParts(1234.5);

    expect(parts.find((part) => part.type === 'group')?.value.charCodeAt(0)).toBe(0x00a0);
    expect(normaliseNumber(parts)).toBe(`1${NNBSP}234${COMMA}5`);
  });

  it('turns U+002E grouping into U+202F - the fr-LU case', () => {
    // Measured on this build: fr-LU groups with a full stop, which is the
    // worst case, because it is a legal DECIMAL separator elsewhere.
    const parts = new Intl.NumberFormat('fr-LU', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).formatToParts(1234.5);

    expect(parts.find((part) => part.type === 'group')?.value).toBe('.');
    expect(normaliseNumber(parts)).toBe(`1${NNBSP}234${COMMA}5`);
  });

  it('turns a full-stop decimal into a comma - the de-CH case', () => {
    const parts = new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).formatToParts(1234.5);

    expect(normaliseNumber(parts)).toBe(`1${NNBSP}234${COMMA}5`);
  });
});

describe('the test file itself', () => {
  it('contains no literal U+00A0 or U+202F in its own source', () => {
        // The meta-test. Every expected string above is built from \u escapes
    // precisely so that a literal no-break space cannot be pasted in from the
    // spec or from a terminal and silently become the expectation. If this
    // fails, an assertion somewhere above is asserting a character nobody can
    // see.
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');

    expect(source).not.toContain('\u00A0');
    expect(source).not.toContain('\u202F');
  });
});

describe('a minus sign is normalised too', () => {
  it('turns U+2212 MINUS SIGN into U+002D HYPHEN-MINUS', () => {
    // Measured on this build: the French and Swiss tags all emit U+002D, but
    // sv-SE, lt-LT, fi-FI and nb-NO emit U+2212 MINUS SIGN. Two characters
    // that look alike, sort differently and break a string comparison
    // silently - so normaliseNumber pins one rather than passing through
    // whatever the locale supplies. (I first wrote this test against de-CH,
    // assuming the Swiss tag would be the odd one out; it is not. The
    // assertion on the raw part below is what caught that.)
    //
    // formatSignedDays never emits a sign at all, but normaliseNumber is the
    // shared seam and has to be total.
    const parts = new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).formatToParts(-1234.5);

    const sign = parts.find((part) => part.type === 'minusSign')?.value ?? '';
    expect(sign.charCodeAt(0)).toBe(0x2212);
    expect(normaliseNumber(parts)).toBe(`-1${NNBSP}234${COMMA}5`);
    expect(normaliseNumber(parts).charCodeAt(0)).toBe(0x002d);
  });
});

describe('the precision is required at type level (R97)', () => {
  // A @ts-expect-error assertion only asserts anything while the file
  // containing it is still compiled. Delete number.types.ts and every claim it
  // makes disappears in perfect silence - tsc has nothing to complain about,
  // and no test fails. So the file's EXISTENCE and its directive count are
  // pinned here, which is the same guard tests/unit/fr/errors.test.ts puts on
  // errors.types.ts.
  const proof = join(process.cwd(), 'lib', 'ui', 'core', 'format', 'number.types.ts');

  it('the type proof file exists', () => {
    expect(existsSync(proof), 'lib/ui/core/format/number.types.ts is missing').toBe(true);
  });

  it('still carries both @ts-expect-error assertions', () => {
    // Counted as DIRECTIVES - anchored to the start of a line - not as
    // mentions. An earlier guard elsewhere in this repo counted the substring
    // and reported five where there were two, because the file's own header
    // prose named it three times.
    const source = readFileSync(proof, 'utf8');
    const directives = source
      .split('\n')
      .filter((line) => line.trimStart().startsWith('// @ts-expect-error'));

    expect(directives).toHaveLength(2);
  });

  it('proves the requirement rather than suppressing it', () => {
    // The directives must sit above CALLS to formatPercent, not above
    // anything else that happens to error - otherwise the file would compile
    // green while asserting nothing about this function.
    const source = readFileSync(proof, 'utf8');

    expect(source).toContain('formatPercent(39.16);');

    // 12, not 40: number.types.ts lives under lib/ui/core, where R73's guard
    // forbids a bare threshold. The arity is what is being asserted, so the
    // value is free - and the first draft used 40, which that guard caught.
    expect(source).toContain('formatPercent(12);');
    expect(source).toContain("import { formatPercent } from './number';");
  });
});
