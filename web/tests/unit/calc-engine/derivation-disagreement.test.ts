// web/tests/unit/calc-engine/derivation-disagreement.test.ts
//
// RULING R120: A FIXTURE SET MUST INCLUDE A CASE WHERE EACH DERIVABLE
// QUANTITY'S ALTERNATIVE DERIVATIONS DISAGREE.
//
// THE DEFECT THAT PRODUCED THE RULING. FW12's panel tests asserted that the
// Swiss-taxed tile showed the engine's swissTaxedDays "and not arithmetic done
// here". A mutation replacing it with `240 - result.frenchTaxedDays` PASSED
// every one of them: each fixture used the simplified 240-day denominator over
// a whole year, and there the two expressions are the same number. The
// assertion was comparing two derivations that happen to agree on the only
// inputs it tried.
//
// The operator's statement of it: "Agreement across all fixtures means the
// test cannot see which one the code used." And its precedent: R19's
// employmentRate 100, where a cap that never prorated could not be told from
// one that prorated correctly.
//
// THE CONFORMANCE CORPUS SAYS SO IN ITS OWN WORDS. fixtures/geneva-cases.json
// carries this comment:
//
//   "All six cases are full-time, full-year, Geneva, whole days, on the
//    simplified 240-day basis, so totalWorkDays is 240 and fiscalCeilingDays
//    is 96."
//
// Which is a plain statement that four of the engine's outputs are CONSTANT
// across the entire suite that SPEC 7.5 says nothing ships without. An engine
// that returned the literal 240, the literal 96 and the literal 10 would pass
// all six. That is not a criticism of the fixtures - they exist to reproduce
// the tax administration's published cases exactly, and those cases are
// full-time and full-year - it is a statement about what they can and cannot
// witness.
//
// SO THIS FILE ASSERTS BOTH HALVES:
//
//   1. For each derivable quantity, SOME case in the extended corpus makes the
//      engine's value differ from the plausible wrong derivation.
//   2. For the four quantities the Geneva six cannot witness, that they
//      really cannot - so the reason the extended corpus exists is a tested
//      fact rather than a comment, and cannot quietly stop being true.
//
// It asserts nothing about which value is CORRECT. fixtures.test.ts owns that,
// against the published figures. This file only asks whether the fixtures can
// SEE a difference, which is a property of the inputs rather than of the
// engine.

import { describe, expect, it } from 'vitest';
import { type TeleworkInput, type TeleworkResult, calculateTelework } from '@/lib/calc-engine';

/** The Geneva common input, as fixtures/geneva-cases.json declares it. */
const GENEVA_COMMON = {
  taxYear: 2026,
  canton: 'GE',
  employmentRate: 100,
  periodFraction: 1,
  denominator: { kind: 'simplified240' },
  granularity: 'day',
} as const satisfies Omit<
  TeleworkInput,
  'teleworkDays' | 'missionDaysFrance' | 'missionDaysThirdState'
>;

const days = (
  teleworkDays: number,
  missionDaysFrance = 0,
  missionDaysThirdState = 0,
): TeleworkInput => ({
  ...GENEVA_COMMON,
  teleworkDays,
  missionDaysFrance,
  missionDaysThirdState,
});

/** The six conformance cases, by the ids the fixture file uses. */
const GENEVA: ReadonlyArray<readonly [string, TeleworkInput]> = [
  ['a', days(72)],
  ['b', days(91, 8)],
  ['c', days(84, 24)],
  ['d', days(94, 12)],
  ['e', days(144, 5)],
  ['special', days(0, 30)],
];

/**
 * The cases that exist because a derivation has to be distinguishable.
 *
 * EVERY ONE OF THESE IS REACHABLE THROUGH THE PRODUCT. Part-time and part-year
 * are two controls on the form; the exact method is the third option in the
 * advanced accordion; half-days are the public form's default granularity. A
 * corpus of inputs nobody can enter would witness a difference the product
 * cannot produce.
 */
const EXTENDED: ReadonlyArray<readonly [string, TeleworkInput]> = [
  ['part-time 80', { ...days(40), employmentRate: 80 }],
  ['part-year 7/12', { ...days(40), periodFraction: 7 / 12 }],
  [
    'part-time 45 over 7/12 - the floating-point case (R10)',
    { ...days(40), employmentRate: 45, periodFraction: 7 / 12 },
  ],
  [
    'exact 200 days',
    { ...days(90), denominator: { kind: 'exact', totalWorkDays: 200 } },
  ],
  [
    'exact 200 at part time',
    {
      ...days(60),
      employmentRate: 80,
      denominator: { kind: 'exact', totalWorkDays: 200 },
    },
  ],
  ['half-days', { ...days(83.5), granularity: 'halfDay' }],
  ['past the fiscal ceiling only', days(110)],
  ['missions in both places', days(40, 6, 4)],
];

const CORPUS = [...GENEVA, ...EXTENDED];

const resultFor = (input: TeleworkInput): TeleworkResult => {
  const outcome = calculateTelework(input);

  if (!outcome.ok) {
    throw new Error(`fixture does not compute: ${outcome.error.map((e) => e.code).join(',')}`);
  }

  return outcome.value;
};

/**
 * A quantity, and the plausible wrong way to get it.
 *
 * `naive` IS NOT A STRAW MAN. Each one is the expression a reasonable
 * implementation reaches for: the simplified basis is 240 so write 240; the
 * fiscal ceiling is 40 % of it so write 96; the mission cap is ten days so
 * write 10; the days not taxed in Switzerland are the rest of the year so
 * write 240 minus them. Every one is correct for a full-time full-year
 * contract on the simplified basis, which is every case in the conformance
 * suite.
 */
interface Derivable {
  readonly name: string;
  readonly actual: (result: TeleworkResult, input: TeleworkInput) => number;
  readonly naive: (result: TeleworkResult, input: TeleworkInput) => number;
  /** True when the Geneva six are expected to be blind to the difference. */
  readonly genevaIsBlind: boolean;
}

const SIMPLIFIED_BASIS = 240;
const FISCAL_CEILING_DAYS_AT_FULL_TIME = 96;
const MISSION_CAP_DAYS = 10;

const DERIVABLE: readonly Derivable[] = [
  {
    name: 'totalWorkDays vs the 240 literal',
    actual: (result) => result.totalWorkDays,
    naive: () => SIMPLIFIED_BASIS,
    genevaIsBlind: true,
  },
  {
    name: 'fiscalCeilingDays vs the 96 literal',
    actual: (result) => result.fiscalCeilingDays,
    naive: () => FISCAL_CEILING_DAYS_AT_FULL_TIME,
    genevaIsBlind: true,
  },
  {
    name: 'missionCap vs the 10-day literal (R19)',
    actual: (result) => result.missionCap,
    naive: () => MISSION_CAP_DAYS,
    genevaIsBlind: true,
  },
  {
    name: 'swissTaxedDays vs 240 minus the French days',
    actual: (result) => result.swissTaxedDays,
    naive: (result) => SIMPLIFIED_BASIS - result.frenchTaxedDays,
    genevaIsBlind: true,
  },
  {
    name: 'declarableRate vs rawRate',
    // The two-rate problem SPEC 9.3 names: they differ exactly when mission
    // days fall outside the regime. Geneva (c) and (d) are the published
    // cases where they do, so the conformance suite DOES witness this one.
    actual: (result) => result.declarableRate,
    naive: (result) => result.rawRate,
    genevaIsBlind: false,
  },
  {
    name: 'creditedMissionDays vs every French mission day',
    actual: (result) => result.creditedMissionDays,
    naive: (_result, input) => input.missionDaysFrance,
    genevaIsBlind: false,
  },
  {
    name: 'remainingToFiscal vs remainingToSocial',
    // Not a wrong derivation but a wrong ASSUMPTION: that the two headrooms
    // move together, so one negative state can be computed and both tiles
    // painted from it. FW12's panel had a fixture set where they always
    // agreed in sign until GENEVA_MIXED was added.
    actual: (result) => Math.sign(result.remainingToFiscal),
    naive: (result) => Math.sign(result.remainingToSocial),
    genevaIsBlind: false,
  },
];

/** Every case where the two derivations differ, by name. */
function disagreements(
  quantity: Derivable,
  corpus: ReadonlyArray<readonly [string, TeleworkInput]>,
): string[] {
  return corpus
    .filter(([, input]) => {
      const result = resultFor(input);

      return quantity.actual(result, input) !== quantity.naive(result, input);
    })
    .map(([id]) => id);
}

describe('the corpus can see every derivable quantity (R120)', () => {
  it.each(DERIVABLE)('$name has a case that distinguishes it', (quantity) => {
    const found = disagreements(quantity, CORPUS);

    expect(
      found,
      `NO FIXTURE DISTINGUISHES ${quantity.name}. Every case in the corpus ` +
        'gives the same answer both ways, so no assertion over these inputs ' +
        'can tell which derivation the code used. R120: add a case where they ' +
        'disagree.',
    ).not.toHaveLength(0);
  });

  it('names which case does the work, so removing it is visible', () => {
    // A COUNT WOULD NOT BE ENOUGH. If the corpus shrank to the one case that
    // distinguishes a quantity and that case were then deleted, the test
    // above would fail - correctly - but nobody would know which input had
    // been carrying the property. This prints the map.
    const map = DERIVABLE.map(
      (quantity) => `${quantity.name}: ${disagreements(quantity, CORPUS).join(', ')}`,
    );

    expect(map).toHaveLength(DERIVABLE.length);
    for (const line of map) {
      expect(line, line).not.toMatch(/: $/u);
    }
  });
});

describe('what the conformance suite alone cannot witness', () => {
  // THE SECOND HALF OF R120, and the reason this file is not just a checklist.
  // fixtures/geneva-cases.json states that all six cases are full-time,
  // full-year, simplified-basis and whole-day, "so totalWorkDays is 240 and
  // fiscalCeilingDays is 96". That sentence is a claim about what the suite
  // SPEC 7.5 gates on can see, and it is asserted here rather than trusted.
  //
  // This is not a defect in the fixtures. They reproduce the published cases
  // exactly, and the published cases are full-time and full-year. It is the
  // reason the extended corpus exists, and it belongs in the test rather than
  // in a comment nobody re-reads.

  const BLIND = DERIVABLE.filter((quantity) => quantity.genevaIsBlind);
  const SIGHTED = DERIVABLE.filter((quantity) => !quantity.genevaIsBlind);

  it('is four quantities, not none and not all seven', () => {
    expect(BLIND).toHaveLength(4);
    expect(SIGHTED).toHaveLength(3);
  });

  it.each(BLIND)('$name: no Geneva case distinguishes it', (quantity) => {
    expect(
      disagreements(quantity, GENEVA),
      `${quantity.name} IS now distinguishable by a Geneva case. That is good ` +
        'news, not a failure - but the corpus comment and this list say ' +
        'otherwise, so update both rather than deleting the extended case.',
    ).toHaveLength(0);
  });

  it.each(SIGHTED)('$name: a Geneva case does distinguish it', (quantity) => {
    // Non-vacuity for the block above: if `disagreements` were broken it
    // would return an empty array for everything and every assertion up
    // there would pass.
    expect(disagreements(quantity, GENEVA)).not.toHaveLength(0);
  });

  it('and the extended corpus is what covers the four', () => {
    for (const quantity of BLIND) {
      const found = disagreements(
        quantity,
        EXTENDED,
      );

      expect(found, quantity.name).not.toHaveLength(0);
    }
  });

  it('every extended case is reachable through the form', () => {
    // Stated as an assertion because a corpus is only worth what its inputs
    // are: part-time and part-year are controls, the exact method is the
    // advanced accordion's third option, half-days are the public default.
    // A case nobody can enter witnesses a difference the product cannot
    // produce.
    for (const [id, input] of EXTENDED) {
      expect(input.employmentRate, id).toBeGreaterThanOrEqual(1);
      expect(input.employmentRate, id).toBeLessThanOrEqual(100);
      expect(input.periodFraction, id).toBeGreaterThan(0);
      expect(input.periodFraction, id).toBeLessThanOrEqual(1);
      expect(calculateTelework(input).ok, id).toBe(true);
    }
  });
});
