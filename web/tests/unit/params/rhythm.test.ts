// web/tests/unit/params/rhythm.test.ts
//
// R343: THE RHYTHM AS A URL PARAMETER, AND THE PARAMETER IS PERMANENT.
//
// "URL parameters are permanent: shared links will carry them for years
// (R156). The operator authorises adding them here. Choose names in the SAME
// STYLE as the calculator's existing parameters, document them in the
// calculator's URL contract as FROZEN from the first deploy, and add a test
// that fails if any of them is renamed."
//
// IT REPEATS RATHER THAN PACKING, AND THAT WAS A CORRECTION. The first design
// was one positional string, `rythme=sdsds`, five characters with three states
// per weekday. It was shorter and more expressive and no HTML form can
// produce it: a checkbox submits its own name and value or nothing, and five
// of them cannot agree on one string without JavaScript to assemble it. R346
// requires the rhythm to work with scripting OFF, so the format that only
// works when hydrated is the wrong format.

import { describe, expect, it } from 'vitest';
import type { Rhythm } from '@/lib/forecast/imagined';
import {
  RHYTHM_CODES,
  RHYTHM_DAY_CODES,
  parseRhythmDays,
  renderRhythmDays,
} from '@/lib/params/rhythm';

describe('R343: the rhythm parameter reads what it writes', () => {
  it('writes the codes of the telework days, in weekday order', () => {
    expect(renderRhythmDays({ TUESDAY: 'HOME', THURSDAY: 'HOME' })).toEqual(['ma', 'je']);
  });

  it('writes weekday order even when the rhythm was built out of order', () => {
    // ORDER IS PART OF THE CONTRACT: two links to the same rhythm have to be
    // the same string, or a reader comparing two shared URLs sees a
    // difference that is not one.
    expect(renderRhythmDays({ FRIDAY: 'HOME', MONDAY: 'HOME', WEDNESDAY: 'HOME' })).toEqual([
      'lu',
      'me',
      've',
    ]);
  });

  it('writes nothing for an empty rhythm, so encode omits the parameter', () => {
    expect(renderRhythmDays({})).toEqual([]);
  });

  it('does NOT write the Swiss days, because the URL cannot carry them', () => {
    // Stated as a test rather than only in a comment: the web question is
    // binary per day, and a Swiss day cannot move a rate under either
    // denominator (the shared fixture's
    // `les-jours-suisses-ne-bougent-pas-le-taux` is the authority).
    expect(renderRhythmDays({ MONDAY: 'CH', TUESDAY: 'HOME' })).toEqual(['ma']);
  });

  it('reads back every rhythm it can write (round trip, exhaustive)', () => {
    // EXHAUSTIVE BECAUSE IT CAN BE. Five weekdays, each checked or not, is 32
    // rhythms - this is not a sample of the domain the URL can express, it is
    // the domain.
    const days = Object.keys(RHYTHM_DAY_CODES) as ReadonlyArray<keyof typeof RHYTHM_DAY_CODES>;
    let checked = 0;

    for (let mask = 0; mask < 2 ** days.length; mask += 1) {
      const rhythm: Rhythm = Object.fromEntries(
        days.filter((_, index) => (mask & (1 << index)) !== 0).map((day) => [day, 'HOME']),
      );
      const written = renderRhythmDays(rhythm);

      expect(parseRhythmDays(written), written.join(',')).toEqual(rhythm);
      checked += 1;
    }

    expect(checked).toBe(32);
  });

  it('maps each code to the weekday that code means', () => {
    // R133's positive half: the round trip above passes for any consistent
    // pair of functions, including a pair that agreed lundi was vendredi.
    expect(parseRhythmDays(['lu'])).toEqual({ MONDAY: 'HOME' });
    expect(parseRhythmDays(['ma'])).toEqual({ TUESDAY: 'HOME' });
    expect(parseRhythmDays(['me'])).toEqual({ WEDNESDAY: 'HOME' });
    expect(parseRhythmDays(['je'])).toEqual({ THURSDAY: 'HOME' });
    expect(parseRhythmDays(['ve'])).toEqual({ FRIDAY: 'HOME' });
  });

  it('reads no values as no rhythm, which is a complete answer', () => {
    // Different from a refusal: it is what a form submits when nobody checked
    // anything, and the prompt is explicit - "with none checked, the
    // calculator shows today's position only, as now."
    expect(parseRhythmDays([])).toEqual({});
  });

  it('tolerates a repeated day rather than calling the link broken', () => {
    expect(parseRhythmDays(['ma', 'ma'])).toEqual({ TUESDAY: 'HOME' });
  });

  it('freezes the five codes, so a rename breaks this line first', () => {
    // THE RENAME TEST R343 ASKS FOR, at the value level. schema.test.ts
    // freezes the parameter NAME; this freezes what its values mean. Editing
    // either breaks every link that has ever carried a rhythm, silently for
    // the reader - they see a calculator full of defaults and assume they
    // mis-copied it.
    expect({ ...RHYTHM_DAY_CODES }).toEqual({
      MONDAY: 'lu',
      TUESDAY: 'ma',
      WEDNESDAY: 'me',
      THURSDAY: 'je',
      FRIDAY: 've',
    });
    expect([...RHYTHM_CODES]).toEqual(['lu', 'ma', 'me', 'je', 've']);
  });
});

describe('R343: a rhythm that cannot be read falls back, never throws', () => {
  // SPEC 9.4: "invalid values fall back to default and surface a dismissible
  // notice, never a blank page (Facebook mangles URLs; degrading beats 404)."
  const REFUSED: ReadonlyArray<readonly [readonly string[], string]> = [
    [['lundi'], 'the whole word'],
    [['LU'], 'the right code in the wrong case'],
    [['sa'], 'a weekend day'],
    [['di'], 'the other weekend day'],
    [[''], 'an empty value'],
    [['ma', 'xx'], 'one good code and one bad'],
    [['<img>'], 'markup'],
    [['1'], 'a digit'],
  ];

  for (const [raw, why] of REFUSED) {
    it(`refuses ${why}`, () => {
      expect(parseRhythmDays(raw)).toBeNull();
    });
  }

  it('refuses a ten-kilobyte value', () => {
    expect(parseRhythmDays(['l'.repeat(10_000)])).toBeNull();
  });

  it('refuses rather than silently dropping the bad one', () => {
    // THE DIFFERENCE THAT MATTERS. Skipping `xx` would hand the reader a
    // projection missing a day they checked, with nothing on the page saying
    // so - which is the quiet wrong answer SPEC 9.4's notice exists for.
    expect(parseRhythmDays(['ma', 'xx'])).not.toEqual({ TUESDAY: 'HOME' });
  });
});
