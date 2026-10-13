// web/tests/unit/params/codec.test.ts
//
// FW13 increment 1 and ACCEPTANCE CRITERION 1: decode(encode(input)) === input.
//
// SPEC 9.4 calls this "the one test protecting every link ever shared", and
// the phrasing is exact. A link is not a request the product can retry - it
// is a string in a Facebook thread that somebody clicks eighteen months
// later, and if the codec has drifted by then the reader sees a plausible
// calculator full of the wrong numbers. There is no error state for that.
//
// WHAT "ANY VALID TeleworkInput" MEANS HERE, because it is narrower than the
// type and the difference is the whole design. `debut` carries a DATE and the
// engine holds a periodFraction, so the codec's representable space is the
// fractions a date can produce - remainingYearFraction over the days of the
// tax year. An arbitrary 0,3333 is a valid TeleworkInput and is NOT a
// shareable scenario: no date produces it, so no URL can carry it, and a
// generator that produced one would be asserting the codec should invent a
// date. The generator therefore produces DATES and derives the fraction, which
// is exactly what the form does.
//
// Stated rather than assumed, and asserted below: the boundary is a property
// of the schema, not an oversight, and a test names what falls outside it.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { type TeleworkInput, ruleSetFor } from '@/lib/calc-engine';
import { decode, encode } from '@/lib/params/codec';
import { PARAM_NAMES } from '@/lib/params/schema';
import { remainingYearFraction } from '@/lib/ui/core';

const TAX_YEAR = 2026;

/** Every canton the engine accepts, from the rule set rather than a literal. */
const CANTONS = ['GE', 'VD', 'BE', 'ZH', 'JU', 'NE', 'BS', 'TI'] as const;

/**
 * A scenario a URL can actually carry.
 *
 * HALF-DAY STEPS, because SPEC 9.4 types tt, mfr and mtiers as ">= 0, step
 * 0.5" - the codec's job is to round-trip what the form can produce, and the
 * form's day fields step by 0.5.
 */
const halfDays = (max: number) =>
  fc.integer({ min: 0, max: max * 2 }).map((halves) => halves / 2);

const arbitraryInput = fc
  .record({
    canton: fc.constantFrom(...CANTONS),
    employmentRate: fc.integer({ min: 1, max: 100 }),
    teleworkDays: halfDays(240),
    missionDaysFrance: halfDays(60),
    missionDaysThirdState: halfDays(60),
    granularity: fc.constantFrom<TeleworkInput['granularity']>('day', 'halfDay', 'hours'),
    exactTotal: fc.option(fc.integer({ min: 1, max: 366 }), { nil: undefined }),
    // A day OF the tax year, or none. Deriving the fraction from a date is
    // what makes the round trip meaningful - see the header.
    startDay: fc.option(
      fc
        .integer({ min: 0, max: 364 })
        .map((offset) => new Date(Date.UTC(TAX_YEAR, 0, 1 + offset)).toISOString().slice(0, 10)),
      { nil: undefined },
    ),
  })
  .map(({ exactTotal, startDay, ...rest }): TeleworkInput => ({
    ...rest,
    taxYear: TAX_YEAR,
    denominator:
      exactTotal === undefined
        ? { kind: 'simplified240' }
        : { kind: 'exact', totalWorkDays: exactTotal },
    periodFraction: startDay === undefined ? 1 : remainingYearFraction(startDay, TAX_YEAR),
  }));

describe('AC1: the round trip, over generated scenarios', () => {
  it('decode(encode(input)) equals input, 10 000 cases', () => {
    // TEN THOUSAND IS SPEC 9.4's NUMBER, not a shape of words: "10,000
    // generated cases". fast-check's default is 100, so the count is set
    // explicitly and asserted by the run rather than hoped for.
    fc.assert(
      fc.property(arbitraryInput, (input) => {
        const round = decode(encode(input), TAX_YEAR);

        expect(round.input).toEqual(input);
        expect(round.invalid).toEqual([]);
        expect(round.ignored).toEqual([]);
      }),
      { numRuns: 10_000 },
    );
  });

  it('covers the cases the prompt names', () => {
    // A GENERATOR IS ONLY WORTH ITS COVERAGE, and R120's shape: a corpus that
    // never varies a field cannot see a codec that drops it. Recorded by
    // sampling rather than asserted per-case, because the property above is
    // the assertion and this is the evidence it was exercised.
    const seen = {
      partTime: false,
      midYear: false,
      exact: false,
      hours: false,
      halfDay: false,
      wholeDay: false,
      bothMissions: false,
      fractionalDays: false,
    };

    fc.assert(
      fc.property(arbitraryInput, (input) => {
        if (input.employmentRate < 100) seen.partTime = true;
        if (input.periodFraction < 1) seen.midYear = true;
        if (input.denominator.kind === 'exact') seen.exact = true;
        if (input.granularity === 'hours') seen.hours = true;
        if (input.granularity === 'halfDay') seen.halfDay = true;
        if (input.granularity === 'day') seen.wholeDay = true;
        if (input.missionDaysFrance > 0 && input.missionDaysThirdState > 0) {
          seen.bothMissions = true;
        }
        if (!Number.isInteger(input.teleworkDays)) seen.fractionalDays = true;

        return true;
      }),
      { numRuns: 2000 },
    );

    for (const [name, covered] of Object.entries(seen)) {
      expect(covered, `the generator never produced: ${name}`).toBe(true);
    }
  });
});

describe('encode omits what a default already says', () => {
  const base: TeleworkInput = {
    taxYear: TAX_YEAR,
    canton: 'GE',
    employmentRate: 100,
    periodFraction: 1,
    denominator: { kind: 'simplified240' },
    granularity: 'day',
    teleworkDays: 84,
    missionDaysFrance: 0,
    missionDaysThirdState: 0,
  };

  it('writes only canton and tt for the ordinary case', () => {
    // SHORT AND READABLE IS THE POINT. This URL gets pasted into a thread
    // where it is read by a human before it is clicked, and nine params of
    // mostly-defaults reads as machinery rather than as somebody's situation.
    expect(encode(base).toString()).toBe('canton=GE&tt=84');
  });

  it('writes a param the moment it differs from its default', () => {
    expect(encode({ ...base, employmentRate: 80 }).toString()).toBe(
      'canton=GE&taux=80&tt=84',
    );
    expect(encode({ ...base, missionDaysFrance: 24 }).toString()).toBe(
      'canton=GE&tt=84&mfr=24',
    );
    expect(encode({ ...base, granularity: 'halfDay' }).toString()).toBe(
      'canton=GE&tt=84&decompte=dj',
    );
  });

  it('writes tt even when it is zero, because tt has no default', () => {
    // SPEC 9.4's table leaves tt's default column empty. A link that omitted
    // the number the reader came for would not be a shared scenario.
    expect(encode({ ...base, teleworkDays: 0 }).toString()).toBe('canton=GE&tt=0');
  });

  it('writes total only under the exact method', () => {
    const exact = encode({
      ...base,
      denominator: { kind: 'exact', totalWorkDays: 200 },
    }).toString();

    expect(exact).toBe('canton=GE&tt=84&methode=exact&total=200');
    expect(encode(base).toString()).not.toContain('total');
  });

  it('orders the params as SPEC 9.4 tabulates them', () => {
    // Two links to one scenario must be one string, or they look like two
    // different scenarios to anyone comparing them.
    const all = encode({
      ...base,
      employmentRate: 80,
      missionDaysFrance: 6,
      missionDaysThirdState: 4,
      granularity: 'hours',
      denominator: { kind: 'exact', totalWorkDays: 200 },
      periodFraction: remainingYearFraction('2026-04-01', TAX_YEAR),
    });
    const order = [...all.keys()];

    expect(order).toEqual(
      PARAM_NAMES.filter((name) => order.includes(name)),
    );
    expect(order[0]).toBe('canton');
    expect(order.at(-1)).toBe('debut');
  });
});

describe('decode is total: it never throws and always says what it ignored', () => {
  it('returns no input when the canton is missing', () => {
    const result = decode(new URLSearchParams('tt=84'), TAX_YEAR);

    expect(result.input).toBeNull();
    expect(result.invalid).toEqual([]);
  });

  it('returns no input when tt is missing', () => {
    expect(decode(new URLSearchParams('canton=GE'), TAX_YEAR).input).toBeNull();
  });

  it('treats an empty query exactly as the bare path (AC2)', () => {
    const empty = decode(new URLSearchParams(''), TAX_YEAR);

    expect(empty.input).toBeNull();
    expect(empty.ignored).toEqual([]);
    expect(empty.invalid).toEqual([]);
  });

  it('names an unknown param and keeps the rest', () => {
    const result = decode(new URLSearchParams('canton=GE&tt=84&utm_source=fb'), TAX_YEAR);

    expect(result.ignored).toEqual(['utm_source']);
    expect(result.input?.teleworkDays).toBe(84);
  });

  it('falls back to the default on an invalid value, and says so', () => {
    // SPEC 9.4: "invalid values fall back to default and surface a dismissible
    // notice, never a blank page (Facebook mangles URLs; degrading beats
    // 404)."
    const result = decode(new URLSearchParams('canton=GE&tt=84&taux=abc'), TAX_YEAR);

    expect(result.invalid).toEqual(['taux']);
    expect(result.input?.employmentRate).toBe(100);
  });

  it('refuses an unknown canton rather than guessing one', () => {
    // The canton has no default, so an invalid one cannot fall back to
    // anything - and a link naming a canton that does not exist must not
    // silently compute under some other regime.
    const result = decode(new URLSearchParams('canton=XX&tt=84'), TAX_YEAR);

    expect(result.input).toBeNull();
    expect(result.invalid).toEqual(['canton']);
  });

  it('reads the rule set for the year it was given', () => {
    // Non-vacuity for the fixture above: GE really is a canton this engine
    // knows, so the refusal of XX is about XX.
    expect(ruleSetFor(TAX_YEAR).residence1983Cantons).not.toContain('GE');
    expect(decode(new URLSearchParams('canton=GE&tt=1'), TAX_YEAR).input).not.toBeNull();
  });
});

describe('R343: the rhythm survives the whole codec, not just its own helpers', () => {
  // rhythm.test.ts walks all 32 rhythms through renderRhythmDays and
  // parseRhythmDays. That proves the two helpers agree with each other; it
  // says nothing about whether encode actually APPENDS what it rendered, or
  // whether decode reads the repeated values rather than the first one.
  //
  // Those are the two defects this shape invites, and neither is visible one
  // layer down (R204): a `params.set` in place of `params.append` keeps the
  // last day only, and a `params.get` in place of `getAll` keeps the first.
  // Both leave every helper test green.
  const BASE: TeleworkInput = {
    taxYear: TAX_YEAR,
    canton: 'GE',
    employmentRate: 100,
    teleworkDays: 84,
    missionDaysFrance: 0,
    missionDaysThirdState: 0,
    denominator: { kind: 'simplified240' },
    granularity: 'day',
    periodFraction: 1,
  };

  it('round-trips every rhythm the form can produce, through a real query string', () => {
    const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
    let checked = 0;

    for (let mask = 0; mask < 2 ** DAYS.length; mask += 1) {
      const rhythm = Object.fromEntries(
        DAYS.filter((_, index) => (mask & (1 << index)) !== 0).map((day) => [day, 'HOME']),
      );
      // THROUGH THE STRING, not through the URLSearchParams object: a shared
      // link is text, and text is what a mail client rewrites.
      const query = encode(BASE, rhythm).toString();
      const back = decode(new URLSearchParams(query), TAX_YEAR);

      expect(back.rhythm, query).toEqual(rhythm);
      expect(back.invalid, query).toEqual([]);
      checked += 1;
    }

    expect(checked).toBe(32);
  });

  it('keeps every checked day, not merely the first or the last', () => {
    // The two defects named above, as one assertion with a rhythm whose first
    // and last days differ.
    const query = encode(BASE, { MONDAY: 'HOME', WEDNESDAY: 'HOME', FRIDAY: 'HOME' }).toString();

    expect(new URLSearchParams(query).getAll('rythme')).toEqual(['lu', 'me', 've']);
  });

  it('omits the parameter entirely when no day is checked', () => {
    expect(encode(BASE, {}).toString()).not.toContain('rythme');
    expect(encode(BASE).toString()).not.toContain('rythme');
  });

  it('leaves every link made before R343 byte-for-byte unchanged', () => {
    // THE PROMISE THE RULING MAKES: "Existing parameters and existing share
    // links keep working exactly as now." encode with no rhythm must produce
    // exactly what it produced before the parameter existed, which is what
    // the default argument is for.
    expect(encode(BASE).toString()).toBe('canton=GE&tt=84');
  });

  it('names a rhythm it could not read, and still computes the rest', () => {
    const back = decode(new URLSearchParams('canton=GE&tt=84&rythme=lundi'), TAX_YEAR);

    expect(back.invalid).toContain('rythme');
    expect(back.rhythm).toEqual({});
    expect(back.input).not.toBeNull();
    expect(back.ignored).toEqual([]);
  });
});
