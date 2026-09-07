// web/tests/unit/ui-core/format-date.test.ts
//
// SPEC 6.4: "formatDate -> Swiss dots." SPEC 8: the Releve annuel names days,
// so a day-boundary bug here is a WRONG RECORD, not a cosmetic slip.
//
// RULING R28 - CALENDAR DAYS ARE STRINGS. "A calendar day is an ISO
// YYYY-MM-DD string end to end - column, API, formatter. A Date object never
// represents a day. Instants are ISO timestamps rendered in Europe/Paris."
//
// That ruling deletes a whole class of defect rather than guarding it. FW6
// had to prove formatDate was time-zone independent by re-running it in child
// processes under hostile TZ values, because a Date is an instant and reading
// an instant's calendar fields requires choosing a zone: measured then,
// new Date('2026-12-18T00:00:00Z') rendered 18.12.2026 under UTC and
// Europe/Paris and 17.12.2026 under America/New_York. A YYYY-MM-DD string has
// no instant, so formatDate now touches no zone and no Intl at all - it is a
// pure string transform, and the bug is unreachable instead of tested for.
//
// The child-process zone test is KEPT below anyway, now covering both
// formatters. For formatDate it is no longer the proof of anything - it is
// the demonstration that there is nothing left to prove.
//
// formatDateTime still uses Intl, because rendering an instant as a Paris
// wall clock is exactly a zone conversion. Its traps are unchanged and
// measured: only the -CH tags give date dots (fr-FR gives 18/12/2026 with
// U+002F), en-US orders month before day so joining ICU's parts in the order
// given yields 12.18.2026, and format() and formatToParts() disagree for the
// same formatter (en-US timeStyle short gives U+0020 from one and U+202F from
// the other). So the fields are read and every separator is written by us.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  DATE_TIME_ZONE,
  formatDate,
  formatDateTime,
  normaliseDate,
  normaliseDateTime,
} from '@/lib/ui/core/format/date';

/** U+00E0 LATIN SMALL LETTER A WITH GRAVE, precomposed (NFC). */
const A_GRAVE = '\u00E0';

/** U+00A0 NO-BREAK SPACE, either side of the a-grave (R29). */
const NBSP = '\u00A0';

const codepoints = (text: string): string[] =>
  [...text].map((char) => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);

/** Midwinter, so a westward zone shift would land on the previous day. */
const DECEMBER_DAY = '2026-12-18';

/** SPEC's own datetime example: 18.06.2027 a 18:03 Paris = 16:03 UTC. */
const JUNE_EVENING = '2027-06-18T16:03:00Z';

/**
 * Never called. It exists so that tsc type-checks these two calls: each
 * @ts-expect-error fails the BUILD if the call ever becomes legal, which is
 * precisely the regression R28 forbids. A runtime test cannot express this.
 */
function rejectsDateObjects(): void {
  // @ts-expect-error R28: a Date object never represents a calendar day.
  formatDate(new Date('2026-12-18T00:00:00Z'));
  // @ts-expect-error R28: an instant is an ISO timestamp string.
  formatDateTime(new Date('2027-06-18T16:03:00Z'));
}

describe('formatDate takes an ISO day string (R28)', () => {
  it('renders Swiss dots', () => {
    expect(formatDate(DECEMBER_DAY)).toBe('18.12.2026');
  });

  it('separates with U+002E and never U+002F', () => {
    expect(codepoints(formatDate(DECEMBER_DAY))).toEqual([
      'U+0031',
      'U+0038',
      'U+002E',
      'U+0031',
      'U+0032',
      'U+002E',
      'U+0032',
      'U+0030',
      'U+0032',
      'U+0036',
    ]);
  });

  it('keeps the two-digit day and month it was given', () => {
    expect(formatDate('2027-01-05')).toBe('05.01.2027');
  });

  it('renders the year in four digits', () => {
    // dateStyle:'short' would give 18.12.26. A two-digit year on a document
    // that names a tax year is an ambiguity nobody can resolve later.
    expect(formatDate(DECEMBER_DAY)).toContain('2026');
    expect(formatDate(DECEMBER_DAY).length).toBe(10);
  });

  it('has no Date overload and no time-zone parameter', () => {
    // If an overload taking a Date were added, or the timeZone parameter came
    // back, this fails - and so does the build, on the two directives in
    // rejectsDateObjects above.
    expectTypeOf<Parameters<typeof formatDate>>().toEqualTypeOf<[isoDay: string]>();
    expect(rejectsDateObjects).toBeTypeOf('function');
  });
});

describe('formatDate refuses anything that is not a calendar day', () => {
  for (const bad of [
    '18.12.2026',
    '2026-12-18T00:00:00Z',
    '2026-12-8',
    '26-12-18',
    '2026/12/18',
    '',
    'nonsense',
  ]) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      expect(() => formatDate(bad)).toThrow(RangeError);
    });
  }

  it('rejects a well-formed but impossible day', () => {
    // THE ONE THAT NEEDS MORE THAN A REGEX. Measured: new Date() does not
    // reject these, it ROLLS THEM OVER - '2026-02-30T00:00:00.000Z' parses to
    // 2026-03-02, and '2026-02-29' (2026 is not a leap year) parses to
    // 2026-03-01. So a NaN check alone would pass 30 February through and
    // print "30.02.2026" on a filing. The fields are round-tripped instead.
    expect(() => formatDate('2026-02-30')).toThrow(RangeError);
    expect(() => formatDate('2026-02-29')).toThrow(RangeError);
    expect(() => formatDate('2026-13-01')).toThrow(RangeError);
    expect(() => formatDate('2026-00-10')).toThrow(RangeError);
    expect(() => formatDate('2026-12-32')).toThrow(RangeError);
    expect(() => formatDate('2026-12-00')).toThrow(RangeError);
  });

  it('accepts a real leap day', () => {
    // The other side of the same check: 2028 IS a leap year, and rejecting a
    // real 29 February would be just as wrong.
    expect(formatDate('2028-02-29')).toBe('29.02.2028');
  });
});

describe('formatDateTime renders an instant in a pinned zone', () => {
  it('renders the SPEC example', () => {
    expect(formatDateTime(JUNE_EVENING)).toBe(`18.06.2027${NBSP}${A_GRAVE}${NBSP}18:03`);
  });

  it('uses a precomposed a-grave, not a combining sequence', () => {
    // NFC 'a-grave' is U+00E0 and one code unit; NFD is U+0061 U+0300 and
    // two. They render identically and are not equal, so a copy-paste from a
    // decomposing source produces a string that looks right and compares
    // false against everything.
    const rendered = formatDateTime(JUNE_EVENING);
    const index = rendered.indexOf(A_GRAVE);

    expect(index).toBeGreaterThan(0);
    expect(rendered.charCodeAt(index)).toBe(0x00e0);
    expect(rendered).not.toContain('a\u0300');
    expect(rendered.normalize('NFC')).toBe(rendered);
  });

it('binds the timestamp into one unbreakable token with U+00A0 (R29)', () => {
    // R29. A no-break space on BOTH sides of the a-grave, so a narrow column
    // can never break "18.06.2027" away from "18:03" and leave a reader
    // holding half a timestamp. U+0020 and U+00A0 are indistinguishable on
    // screen, so only the codepoint separates a correct render from a wrong
    // one - asserted here for the whole string at once.
    const rendered = formatDateTime(JUNE_EVENING);
    const index = rendered.indexOf(A_GRAVE);

    expect(rendered.charCodeAt(index - 1)).toBe(0x00a0);
    expect(rendered.charCodeAt(index + 1)).toBe(0x00a0);
    expect(rendered.charCodeAt(index - 1)).not.toBe(0x0020);
    expect(rendered.charCodeAt(index + 1)).not.toBe(0x0020);
    expect(codepoints(rendered)).toEqual([
      'U+0031', 'U+0038', 'U+002E', 'U+0030', 'U+0036', 'U+002E',
      'U+0032', 'U+0030', 'U+0032', 'U+0037',
      'U+00A0', 'U+00E0', 'U+00A0',
      'U+0031', 'U+0038', 'U+003A', 'U+0030', 'U+0033',
    ]);
  });

  it('separates the time with a colon', () => {
    const rendered = formatDateTime(JUNE_EVENING);

    expect(rendered).toContain(':');
    expect(rendered.charCodeAt(rendered.length - 3)).toBe(0x003a);
  });

  it('renders 24-hour time with no meridiem', () => {
    expect(formatDateTime(JUNE_EVENING)).toContain('18:03');
    expect(formatDateTime('2027-06-18T02:07:00Z')).toBe(`18.06.2027${NBSP}${A_GRAVE}${NBSP}04:07`);
    expect(formatDateTime(JUNE_EVENING)).not.toMatch(/PM|AM/i);
  });

  it('pins Europe/Paris - the wall clock of the audience', () => {
    // A cross-border worker living in France reads a timestamp in their own
    // wall clock. This is the one place a zone other than UTC is right, and
    // it is pinned rather than inherited from the host.
    expect(DATE_TIME_ZONE).toBe('Europe/Paris');
    expect(
      new Intl.DateTimeFormat('fr-CH', { timeZone: DATE_TIME_ZONE }).resolvedOptions().timeZone,
    ).toBe('Europe/Paris');
  });

  it('honours an explicit zone, which is how we know the zone is real', () => {
    // If the zone argument did nothing, the default could be wrong and every
    // other test here would still pass.
    expect(formatDateTime(JUNE_EVENING, 'UTC')).toBe(`18.06.2027${NBSP}${A_GRAVE}${NBSP}16:03`);
    expect(formatDateTime(JUNE_EVENING, 'Asia/Kolkata')).toBe(`18.06.2027${NBSP}${A_GRAVE}${NBSP}21:33`);
  });

  it('rejects a timestamp it cannot read', () => {
    expect(() => formatDateTime('nonsense')).toThrow(RangeError);
    expect(() => formatDateTime('')).toThrow(RangeError);
  });
});

describe('the output does not depend on the ambient time zone', () => {
  // Nothing in the repo sets TZ, so the host zone is whatever the machine
  // says - Africa/Casablanca here, UTC in CI, anything on a contributor's
  // laptop. These run the real formatters in child processes under hostile
  // zones and require identical bytes.
  //
  // For formatDate this is now belt with no braces: an ISO day string has no
  // instant to place in a zone, so there is no mechanism by which TZ could
  // reach it. Kept because the assertion costs nothing and a future change
  // that reintroduced a Date would be caught here as well as by the type.
  const script = [
    "const m = await import('./lib/ui/core/format/date.ts');",
    "process.stdout.write(m.formatDate('2026-12-18') + '|' + m.formatDateTime('2027-06-18T16:03:00Z'));",
  ].join('\n');

  const underZone = (timeZone: string): string =>
    execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--no-warnings=ExperimentalWarning',
        '--input-type=module',
        '-e',
        script,
      ],
      { cwd: process.cwd(), env: { ...process.env, TZ: timeZone }, encoding: 'utf8' },
    );

  const EXPECTED = `18.12.2026|18.06.2027${NBSP}${A_GRAVE}${NBSP}18:03`;

  for (const timeZone of ['UTC', 'America/New_York', 'Pacific/Kiritimati', 'Asia/Kolkata']) {
    it(`renders identically under TZ=${timeZone}`, () => {
      expect(underZone(timeZone)).toBe(EXPECTED);
    });
  }
});

describe('assembly does not depend on what ICU hands us', () => {
  const asParts = (locale: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, options).formatToParts(new Date(JUNE_EVENING));

  const DATE_ONLY: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  };

  it('turns fr-FR slash parts into dots', () => {
    // Measured: fr-FR gives 18/06/2027. normaliseDate reads the day, month
    // and year FIELDS and writes the separators itself, so the literal parts
    // ICU supplies are discarded rather than trusted.
    const parts = asParts('fr-FR', DATE_ONLY);

    expect(parts.some((part) => part.type === 'literal' && part.value === '/')).toBe(true);
    expect(normaliseDate(parts)).toBe('18.06.2027');
  });

  it('turns en-US month-first parts into day-first dots', () => {
    // The strongest version: en-US orders month before day, so an assembler
    // that concatenated parts in the order given would produce 06.18.2027.
    const parts = asParts('en-US', DATE_ONLY);

    expect(parts.findIndex((p) => p.type === 'month')).toBeLessThan(
      parts.findIndex((p) => p.type === 'day'),
    );
    expect(normaliseDate(parts)).toBe('18.06.2027');
  });

  it('assembles month-first en-US time parts day-first, in 24-hour time', () => {
    const parts = asParts('en-US', {
      ...DATE_ONLY,
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    expect(normaliseDateTime(parts)).toBe(`18.06.2027${NBSP}${A_GRAVE}${NBSP}18:03`);
  });

  it('refuses parts from a 12-hour formatter rather than rendering 06:03', () => {
    // en-US with hour:'2-digit' and no hourCycle defaults to a 12-HOUR clock:
    // the hour field reads 06 for 18:00 and the meaning lives in a separate
    // localised dayPeriod part. Recovering 18 would mean parsing "PM" in
    // whatever form the locale supplies, and getting that wrong renders a
    // timestamp twelve hours out while looking perfectly well-formed.
    const parts = asParts('en-US', {
      ...DATE_ONLY,
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
    });

    expect(parts.some((p) => p.type === 'dayPeriod')).toBe(true);
    expect(parts.find((p) => p.type === 'hour')?.value).toBe('06');
    expect(() => normaliseDateTime(parts)).toThrow(RangeError);
  });
});

describe('missing fields are refused rather than rendered as undefined', () => {
  it('throws when the parts carry no day, month or year', () => {
    const timeOnly = new Intl.DateTimeFormat('fr-CH', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).formatToParts(new Date(JUNE_EVENING));

    expect(timeOnly.some((part) => part.type === 'day')).toBe(false);
    expect(() => normaliseDate(timeOnly)).toThrow(RangeError);
    expect(() => normaliseDateTime(timeOnly)).toThrow(RangeError);
  });
});

describe('the test file itself', () => {
  it('contains no literal U+00A0, U+202F or decomposed a-grave', () => {
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');

    expect(source).not.toContain('\u00A0');
    expect(source).not.toContain('\u202F');
    expect(source).not.toContain('a\u0300');
  });
});
