// web/tests/unit/ui-core/format-date.test.ts
//
// SPEC 6.4: "formatDate -> Swiss dots." SPEC 8: a UTC day-boundary bug here
// is a WRONG RECORD, not a cosmetic slip - the Releve annuel names days.
//
// THE TRAP THAT PASSES EVERY OBVIOUS TEST. Measured on this build for
// new Date('2026-12-18T00:00:00Z'):
//
//   fr-CH, UTC              -> 18.12.2026
//   fr-CH, Europe/Paris     -> 18.12.2026
//   fr-CH, host zone here   -> 18.12.2026   (Africa/Casablanca, +01:00)
//   fr-CH, America/New_York -> 17.12.2026   <- a different day
//
// So an implementation that passes no timeZone at all is right in this
// checkout, right in CI (ubuntu runs UTC) and wrong by one day for any
// viewer west of Greenwich. Nothing in the repo pins a zone: vitest.config.ts
// sets no TZ and neither CI workflow does. The zone is therefore asserted
// two ways below - structurally, by reading resolvedOptions().timeZone, and
// behaviourally, by re-running the formatters in CHILD PROCESSES under
// hostile TZ values.
//
// Two smaller traps, both measured. fr-FR renders 18/12/2026 with U+002F -
// only the -CH tags give dots - so "Swiss dots" is a locale-data accident
// unless the separator is written by us. And dateStyle:'short' gives the
// two-digit year 18.12.26.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DATE_TIME_ZONE,
  DATE_ZONE,
  formatDate,
  formatDateTime,
  normaliseDate,
  normaliseDateTime,
} from '@/lib/ui/core/format/date';

/** U+00E0 LATIN SMALL LETTER A WITH GRAVE, precomposed (NFC). */
const A_GRAVE = '\u00E0';

const codepoints = (text: string): string[] =>
  [...text].map((char) => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);

/** Midwinter, so a westward zone shift lands on the previous day. */
const DECEMBER = new Date('2026-12-18T00:00:00Z');

/** SPEC's own datetime example: 18.06.2027 a 18:03. */
const JUNE_EVENING = new Date('2027-06-18T16:03:00Z');

describe('formatDate', () => {
  it('renders Swiss dots', () => {
    expect(formatDate(DECEMBER)).toBe('18.12.2026');
  });

  it('separates with U+002E and never U+002F', () => {
    // fr-FR would give 18/12/2026. The dots are written by us, so this holds
    // whatever CLDR does with either tag.
    expect(codepoints(formatDate(DECEMBER))).toEqual([
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

  it('pads the day and the month to two digits', () => {
    expect(formatDate(new Date('2027-01-05T00:00:00Z'))).toBe('05.01.2027');
  });

  it('renders the year in four digits', () => {
    // dateStyle:'short' gives 18.12.26. A two-digit year on a document that
    // names a tax year is an ambiguity nobody can resolve later.
    expect(formatDate(DECEMBER)).toContain('2026');
    expect(formatDate(DECEMBER).length).toBe(10);
  });

  it('pins its time zone rather than inheriting the host', () => {
    // The structural half of the assertion: a formatter with no timeZone
    // resolves to the host zone, and this is what makes that impossible to
    // ship unnoticed.
    expect(DATE_ZONE).toBe('UTC');
    expect(
      new Intl.DateTimeFormat('fr-CH', { timeZone: DATE_ZONE }).resolvedOptions().timeZone,
    ).toBe('UTC');
  });

  it('honours an explicit zone, which is how we know the zone is real', () => {
    // If the zone argument did nothing, the default could be wrong and every
    // other test here would still pass.
    expect(formatDate(DECEMBER, 'America/New_York')).toBe('17.12.2026');
    expect(formatDate(DECEMBER, 'Pacific/Kiritimati')).toBe('18.12.2026');
  });

  it('rejects an invalid date', () => {
    expect(() => formatDate(new Date('nonsense'))).toThrow(RangeError);
  });
});

describe('formatDateTime', () => {
  it('renders the SPEC example', () => {
    expect(formatDateTime(JUNE_EVENING)).toBe(`18.06.2027 ${A_GRAVE} 18:03`);
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

  it('separates the a-grave with plain spaces and the time with a colon', () => {
    const rendered = formatDateTime(JUNE_EVENING);
    const index = rendered.indexOf(A_GRAVE);

    expect(rendered.charCodeAt(index - 1)).toBe(0x0020);
    expect(rendered.charCodeAt(index + 1)).toBe(0x0020);
    expect(rendered).toContain(':');
    expect(rendered.charCodeAt(rendered.length - 3)).toBe(0x003a);
  });

  it('renders 24-hour time with no meridiem', () => {
    expect(formatDateTime(new Date('2027-06-18T16:03:00Z'))).toContain('18:03');
    expect(formatDateTime(new Date('2027-06-18T02:07:00Z'))).toBe(`18.06.2027 ${A_GRAVE} 04:07`);
    expect(formatDateTime(JUNE_EVENING)).not.toMatch(/PM|AM/i);
  });

  it('pins Europe/Paris - the wall clock of the audience', () => {
    // A cross-border worker living in France reads a timestamp in their own
    // wall clock. This is the one place a zone other than UTC is right, and
    // it is pinned rather than inherited.
    expect(DATE_TIME_ZONE).toBe('Europe/Paris');
    expect(formatDateTime(JUNE_EVENING, 'UTC')).toBe(`18.06.2027 ${A_GRAVE} 16:03`);
  });

  it('rejects an invalid date', () => {
    expect(() => formatDateTime(new Date('nonsense'))).toThrow(RangeError);
  });
});

describe('the output does not depend on the ambient time zone', () => {
  // The behavioural half. Nothing in the repo sets TZ, so the host zone is
  // whatever the machine says - Africa/Casablanca here, UTC in CI, and any
  // of them on a contributor's laptop. These run the real formatters in child
  // processes under hostile zones and require identical bytes.
  const script = [
    "const m = await import('./lib/ui/core/format/date.ts');",
    "const d = new Date('2026-12-18T00:00:00Z');",
    "const e = new Date('2027-06-18T16:03:00Z');",
    'process.stdout.write(m.formatDate(d) + "|" + m.formatDateTime(e));',
  ].join('\n');

  const underZone = (timeZone: string): string =>
    execFileSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', '--input-type=module', '-e', script],
      { cwd: process.cwd(), env: { ...process.env, TZ: timeZone }, encoding: 'utf8' },
    );

  const EXPECTED = `18.12.2026|18.06.2027 ${A_GRAVE} 18:03`;

  for (const timeZone of ['UTC', 'America/New_York', 'Pacific/Kiritimati', 'Asia/Kolkata']) {
    it(`renders identically under TZ=${timeZone}`, () => {
      expect(underZone(timeZone)).toBe(EXPECTED);
    });
  }
});

describe('assembly does not depend on what ICU hands us', () => {
  it('turns fr-FR slash parts into dots', () => {
    // Measured: fr-FR gives 18/12/2026. normaliseDate reads the day, month
    // and year FIELDS and writes the separators itself, so the literal parts
    // ICU supplies are discarded rather than trusted.
    const parts = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(DECEMBER);

    expect(parts.some((part) => part.type === 'literal' && part.value === '/')).toBe(true);
    expect(normaliseDate(parts)).toBe('18.12.2026');
  });

  it('turns en-US month-first parts into day-first dots', () => {
    // The strongest version: en-US orders month before day, so an assembler
    // that concatenated parts in the order given would produce 12.18.2026.
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(DECEMBER);

    expect(normaliseDate(parts)).toBe('18.12.2026');
  });

  it('assembles month-first en-US time parts day-first, in 24-hour time', () => {
    // en-US orders month before day, so an assembler that joined parts in the
    // order given would produce 12.18.2026 - not wrong-looking, just wrong.
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Europe/Paris',
    }).formatToParts(JUNE_EVENING);

    expect(parts.findIndex((p) => p.type === 'month')).toBeLessThan(
      parts.findIndex((p) => p.type === 'day'),
    );
    expect(normaliseDateTime(parts)).toBe(`18.06.2027 ${A_GRAVE} 18:03`);
  });

  it('refuses parts from a 12-hour formatter rather than rendering 06:03', () => {
    // en-US with hour:'2-digit' and no hourCycle defaults to a 12-HOUR clock:
    // the hour field reads 06 for 18:00 and the meaning lives in a separate
    // localised dayPeriod part. Recovering 18 would mean parsing "PM" in
    // whatever form the locale supplies, and getting that wrong renders a
    // timestamp twelve hours out while looking perfectly well-formed. So this
    // is rejected, loudly, instead of silently halved.
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    }).formatToParts(JUNE_EVENING);

    expect(parts.some((p) => p.type === 'dayPeriod')).toBe(true);
    expect(parts.find((p) => p.type === 'hour')?.value).toBe('06');
    expect(() => normaliseDateTime(parts)).toThrow(RangeError);
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

describe('missing fields are refused rather than rendered as undefined', () => {
  it('throws when the parts carry no day, month or year', () => {
    // A time-only formatter. Without the guard the assembly would splice
    // `undefined` into the string and render "undefined.undefined.undefined",
    // which looks like a bug report rather than a date - but only after it
    // shipped.
    const timeOnly = new Intl.DateTimeFormat('fr-CH', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).formatToParts(JUNE_EVENING);

    expect(timeOnly.some((part) => part.type === 'day')).toBe(false);
    expect(() => normaliseDate(timeOnly)).toThrow(RangeError);
    expect(() => normaliseDateTime(timeOnly)).toThrow(RangeError);
  });
});
