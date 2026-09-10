// @vitest-environment jsdom
//
// web/tests/unit/pages/result-panel-tiles.test.tsx
//
// FW12 increment 3: the four MetricTiles, and negative headroom.
//
// SPEC 7.2 step 6 is the rule that matters here: "Negative values are
// reported, never clamped. 'Vous etes 6 jours au-dessus' beats '0 jours
// restants'." A clamped zero tells a frontalier who is 48 days over the
// ceiling that they have no room left, which is true and useless - they need
// to know they are already past it, because the two situations have different
// consequences and only one of them is recoverable this year.
//
// SO THE NEGATIVE STATE IS A DIFFERENT SENTENCE, not a differently formatted
// number: MetricTile swaps the label for overLabel, and formatSignedDays
// carries the magnitude with no sign character. "Jours au-dessus de 40 %: 48",
// never "Jours restants avant 40 %: -48".
//
// THE VALUES ARE THE ENGINE'S. Every assertion below compares against a
// calculateTelework result rather than arithmetic done here, because the
// engine is the only thing verified against the tax administration and a test
// that recomputed would be checking the panel against a second opinion.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ResultPanel } from '@/app/(public)/calculateur-teletravail-frontalier/ResultPanel';
import { type TeleworkInput, calculateTelework, ruleSetFor } from '@/lib/calc-engine';
import { METRIC_COPY } from '@/lib/fr/metrics';
import { RESULT_COPY } from '@/lib/fr/result';
import { type ZoneThresholds, formatPercent } from '@/lib/ui/core';

afterEach(cleanup);

const TAX_YEAR = 2026;
const RULES = ruleSetFor(TAX_YEAR);

const BASE: TeleworkInput = {
  taxYear: TAX_YEAR,
  canton: 'GE',
  employmentRate: 100,
  periodFraction: 1,
  denominator: { kind: 'simplified240' },
  granularity: 'halfDay',
  teleworkDays: 0,
  missionDaysFrance: 0,
  missionDaysThirdState: 0,
};

/** Geneva case (c): under both ceilings, with mission exposure. */
const GENEVA_C: TeleworkInput = { ...BASE, teleworkDays: 84, missionDaysFrance: 24 };

/** Geneva case (e): over BOTH ceilings, so two tiles go negative. */
const GENEVA_E: TeleworkInput = { ...BASE, teleworkDays: 144, missionDaysFrance: 5 };

/**
 * THE CASE THE TWO TILES CAN BE CONFUSED IN: over the fiscal ceiling, still
 * under the social one.
 *
 * 110 days of 240 is 45,83 % declarable - past 40 %, short of 49,9 % - so the
 * engine returns remainingToFiscal -14 and remainingToSocial +9,5 and the two
 * headroom tiles disagree. Both-negative and both-positive fixtures pass
 * against a panel that computed one state for the pair and painted both from
 * it; this one does not. It is also the ordinary shape of the bad news this
 * product delivers: the fiscal ceiling is the one people cross first.
 */
const GENEVA_MIXED: TeleworkInput = { ...BASE, teleworkDays: 110 };

/**
 * THE FIXTURE THAT MAKES "the values are the engine's" MEAN ANYTHING, and it
 * was added because a mutation probe passed.
 *
 * Every fixture above uses the simplified 240-day denominator over a whole
 * year, and there swissTaxedDays is exactly 240 minus frenchTaxedDays. So a
 * panel that printed `240 - result.frenchTaxedDays` in the Swiss tile - a
 * recomputation, and wrong the moment the denominator is not 240 - passed the
 * assertion that exists to forbid exactly that. The test was comparing two
 * expressions that happen to agree on the only inputs it tried.
 *
 * 200 exact work days with 90 telework days gives swiss 110 and french 90, so
 * 240 - french is 150 and the mutation now fails. SPEC 7.3's exact method is
 * the engine's other denominator; the form does not offer it yet, and the
 * panel renders a TeleworkResult rather than a form state, so the tile has to
 * be right for both.
 */
const EXACT_METHOD: TeleworkInput = {
  ...BASE,
  denominator: { kind: 'exact', totalWorkDays: 200 },
  teleworkDays: 90,
};

const resultFor = (input: TeleworkInput) => {
  const outcome = calculateTelework(input);

  if (!outcome.ok) throw new Error(`fixture does not compute: ${outcome.error[0]?.code ?? ''}`);

  return outcome.value;
};

const tilesOf = (input: TeleworkInput, thresholds: ZoneThresholds = RULES) => {
  const { container } = render(
    <ResultPanel input={input} result={resultFor(input)} thresholds={thresholds} />,
  );
  const slot = container.querySelector('[data-panel="tiles"]');

  if (slot === null) throw new Error('no tiles slot');

  // Each tile is a label paragraph followed by a figure carrying
  // data-negative, which is MetricTile's own contract.
  return [...slot.querySelectorAll('[data-negative]')].map((figure) => ({
    label: figure.previousElementSibling?.textContent ?? '',
    text: figure.textContent ?? '',
    negative: figure.getAttribute('data-negative') === 'true',
  }));
};

/** The thresholds as the panel prints them: no decimal when whole. */
const ceiling = (fraction: number): string => {
  const percent = fraction * 100;

  return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
};

const FISCAL = ceiling(RULES.fiscalCeiling);
const SOCIAL = ceiling(RULES.socialCeiling);

describe('four tiles, in SPEC 9.3 order', () => {
  it('renders exactly four', () => {
    expect(tilesOf(GENEVA_C)).toHaveLength(4);
  });

  it('orders them headroom, headroom, Swiss, France', () => {
    // The two ceilings first because they are what the reader came for; the
    // two day counts after, because they are where the answer lands.
    const labels = tilesOf(GENEVA_C).map((tile) => tile.label);

    expect(labels).toEqual([
      METRIC_COPY.remaining(FISCAL),
      METRIC_COPY.remaining(SOCIAL),
      RESULT_COPY.tiles.swiss,
      RESULT_COPY.tiles.france,
    ]);
  });

  it('names each ceiling from the RuleSet, never from copy (R73)', () => {
    // ASSERTED BY CHANGING THE RULES, not by finding "40 %" in the label.
    //
    // The first version of this test read toContain(FISCAL) against the real
    // RuleSet, and a label hardcoded to "Jours restants avant 40 %" would
    // have passed it - which is precisely the defect R73 exists to prevent.
    // lib/fr/metrics.ts states the failure mode: "a threshold belongs to the
    // rules (SPEC 7.7), never to copy, where it goes stale in silence after a
    // rule change with nothing failing."
    //
    // So the ceilings are moved and the labels have to follow. 35 % and 60 %
    // are not any year's rules and never will be; they are here because
    // nothing in the product can produce them, so no copy string can contain
    // them by luck.
    const invented: ZoneThresholds = { fiscalCeiling: 0.35, socialCeiling: 0.6 };
    const labels = tilesOf(GENEVA_C, invented)
      .map((tile) => tile.label)
      .join(' | ');

    expect(labels).toContain(METRIC_COPY.remaining(formatPercent(35, 0)));
    expect(labels).toContain(METRIC_COPY.remaining(formatPercent(60, 0)));
    expect(labels).not.toContain(FISCAL);
    expect(labels).not.toContain(SOCIAL);
  });

  it('prints the real ceilings as 40 % and 49,9 %', () => {
    // The other half: the invented pair above proves the label FOLLOWS the
    // argument, and this proves the argument the page passes prints the two
    // figures SPEC 7.7 names. Both are needed - the first would pass with a
    // formatter that dropped a decimal, and this one alone would pass with a
    // hardcoded string.
    const labels = tilesOf(GENEVA_C).map((tile) => tile.label).join(' | ');
    const nbsp = String.fromCharCode(0x00a0);

    expect(labels).toContain(`40${nbsp}%`);
    expect(labels).toContain(`49,9${nbsp}%`);
    expect(RULES.fiscalCeiling).toBe(0.4);
    expect(RULES.socialCeiling).toBe(0.499);
  });
});

describe("the values are the engine's", () => {
  it("shows the engine's day counts, not arithmetic done here", () => {
    const result = resultFor(GENEVA_C);
    const tiles = tilesOf(GENEVA_C);

    expect(tiles[2]?.text).toBe(String(result.swissTaxedDays));
    expect(tiles[3]?.text).toBe(String(result.frenchTaxedDays));
  });

  it('reads the two counts under a denominator that is not 240', () => {
    // See EXACT_METHOD's comment: under the simplified denominator the Swiss
    // count and 240 minus the French count are the same number, so the
    // assertion above cannot tell a read from a recomputation. Here they are
    // 110 and 150.
    const result = resultFor(EXACT_METHOD);
    const tiles = tilesOf(EXACT_METHOD);

    expect(result.totalWorkDays).toBe(200);
    expect(tiles[2]?.text).toBe(String(result.swissTaxedDays));
    expect(tiles[3]?.text).toBe(String(result.frenchTaxedDays));
    expect(240 - result.frenchTaxedDays).not.toBe(result.swissTaxedDays);
  });

  it('shows positive headroom with no over-label', () => {
    // Geneva case (c) is 2 days under the fiscal ceiling and 25,5 under the
    // social one - both comfortable, both positive.
    const tiles = tilesOf(GENEVA_C);

    expect(tiles[0]?.negative).toBe(false);
    expect(tiles[1]?.negative).toBe(false);
    expect(tiles[0]?.label).toBe(METRIC_COPY.remaining(FISCAL));
  });
});

describe('negative headroom - Geneva case (e), over BOTH ceilings', () => {
  it('marks exactly the two headroom tiles negative', () => {
    const tiles = tilesOf(GENEVA_E);

    expect(tiles.map((tile) => tile.negative)).toEqual([true, true, false, false]);
  });

  it('swaps in the over-label, naming the ceiling that was passed', () => {
    const tiles = tilesOf(GENEVA_E);

    expect(tiles[0]?.label).toBe(METRIC_COPY.over(FISCAL));
    expect(tiles[1]?.label).toBe(METRIC_COPY.over(SOCIAL));
  });

  it('never says "restants" about a ceiling already passed', () => {
    // The clamped-zero failure, stated as an absence. "0 jours restants" and
    // "48 jours au-dessus" are answers to different questions.
    const labels = tilesOf(GENEVA_E).slice(0, 2).map((tile) => tile.label).join(' ');

    expect(labels).not.toContain('restants');
  });

  it('carries the magnitude with NO minus sign', () => {
    // formatSignedDays returns { text, negative } precisely so the sign is a
    // rendering decision rather than a character in the number. The label
    // already says "au-dessus"; a minus would say it twice, and "-48" beside
    // "au-dessus" reads as 48 fewer days over.
    const tiles = tilesOf(GENEVA_E);

    expect(tiles[0]?.text).toBe('48');
    expect(tiles[1]?.text).toBe('24,5');
    for (const tile of tiles) {
      expect(tile.text, tile.label).not.toContain('-');
      expect(tile.text, tile.label).not.toContain(String.fromCharCode(0x2212));
    }
  });

  it('agrees with the engine on the magnitudes', () => {
    // Non-vacuity for the literals above: they are the engine's numbers, and
    // -48 / -24,5 is what it returns for this fixture.
    const result = resultFor(GENEVA_E);

    expect(result.remainingToFiscal).toBe(-48);
    expect(result.remainingToSocial).toBe(-24.5);
  });
});

describe('one ceiling passed, the other not - the tiles are independent', () => {
  it('marks the fiscal tile only', () => {
    const tiles = tilesOf(GENEVA_MIXED);

    expect(tiles.map((tile) => tile.negative)).toEqual([true, false, false, false]);
  });

  it('gives the two headroom tiles different sentences', () => {
    // The reason this fixture exists. Side by side, one tile has to say the
    // 40 % ceiling is behind the reader and the other that there is room
    // before 49,9 %, and R73 is what makes that legible - a shared "Jours
    // au-dessus du seuil" on both would have been true of one of them.
    const tiles = tilesOf(GENEVA_MIXED);

    expect(tiles[0]?.label).toBe(METRIC_COPY.over(FISCAL));
    expect(tiles[1]?.label).toBe(METRIC_COPY.remaining(SOCIAL));
    expect(tiles[0]?.label).not.toBe(tiles[1]?.label);
  });

  it('agrees with the engine, which is where -14 and 9,5 come from', () => {
    const result = resultFor(GENEVA_MIXED);

    expect(result.remainingToFiscal).toBe(-14);
    expect(result.remainingToSocial).toBe(9.5);
    expect(tilesOf(GENEVA_MIXED)[0]?.text).toBe('14');
    expect(tilesOf(GENEVA_MIXED)[1]?.text).toBe('9,5');
  });
});

describe('the colour never carries the meaning alone (SPEC 16)', () => {
  it('moves the label and the flag together in every fixture', () => {
    // DESIGN-SYSTEM.md and SPEC section 16: a state is never colour alone.
    // data-negative is what turns the figure red, and the label swap is what
    // says so in words, so the two are one statement and this asserts they
    // cannot come apart. Stated as a biconditional over every fixture
    // rather than per case, because the failure it guards - a red "Jours
    // restants" - is invisible to any assertion that looks at one of the two.
    const CEILINGS = [FISCAL, SOCIAL] as const;

    for (const input of [BASE, GENEVA_C, GENEVA_MIXED, GENEVA_E]) {
      const tiles = tilesOf(input);

      CEILINGS.forEach((threshold, index) => {
        const tile = tiles[index];
        const where = `${input.teleworkDays} days, ${threshold}`;

        expect(tile, where).toBeDefined();
        expect(tile?.label, where).toBe(
          tile?.negative ? METRIC_COPY.over(threshold) : METRIC_COPY.remaining(threshold),
        );
      });

      cleanup();
    }
  });
});

describe('the two day-count tiles never go negative', () => {
  it('keeps their ordinary label in every fixture', () => {
    // swissTaxedDays and frenchTaxedDays are counts of days, so there is no
    // "over" state for them to be in. Their overLabel is the same string as
    // their label on purpose - and this is what says that choice is safe
    // rather than hiding a case nobody thought about.
    for (const input of [GENEVA_C, GENEVA_E, BASE]) {
      const tiles = tilesOf(input);

      expect(tiles[2]?.negative, `swiss for ${input.teleworkDays} days`).toBe(false);
      expect(tiles[3]?.negative, `france for ${input.teleworkDays} days`).toBe(false);
      cleanup();
    }
  });
});
