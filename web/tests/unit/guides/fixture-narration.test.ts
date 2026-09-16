// web/tests/unit/guides/fixture-narration.test.ts
//
// RULING R163: PROSE THAT NARRATES A FIXTURE IS TIED TO THE FIXTURE.
//
// THE DEFECT, recorded as PARK-10 by FW18b's read-through. Two guides narrate
// the Genève worked example like this:
//
//     Jours de mission crédités : {missionCap}, soit le plafond
//     Jours comptés contre le plafond fiscal : 94 sur une base de {basisDays}
//     Taux déclarable : 39,16 %
//     Jours imposables en France : 14, soit les jours de mission non crédités
//
// `{missionCap}` is live, from RuleSet. **94, 39,16 and 14 are computed by
// hand from it** - 84 + 10, 94 ÷ 240, 24 − 10. Move the cap to 12 and the
// expression updates while the three derivatives do not, and the passage
// reads "seuls 12 sont crédités, et les 14 autres deviennent imposables":
// a sentence contradicting itself in the same breath.
//
// R147 CANNOT SEE IT. That scan forbids a typed FIGURE - 40 %, 240 jours, 10
// jours - and a derivative matches none of its patterns. A derivative is not
// a figure, but it IS a value from a fixture, and that is checkable.
//
// WHY A TEST AND NOT INTERPOLATION. R163 permits either. The MDX scope could
// carry these values and the prose could write them as expressions - but the
// fixtures directory sits OUTSIDE web/, so lib/guides would have to read
// `../fixtures` at module load. That is R139's failure shape exactly: a path
// that exists on this machine and in a full clone, and may not exist wherever
// only web/ is deployed. The test ties the guide to the same file the engine
// is gated on, with no runtime dependency and no build risk.
//
// THE NUMBERS COME FROM THE FIXTURE, NEVER FROM THE PROSE. Reading the MDX to
// decide what to expect would assert that the article agrees with itself.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';

const FIXTURE = join(process.cwd(), '..', 'fixtures', 'geneva-cases.json');
const GUIDES = join(process.cwd(), 'content', 'guides');

interface GenevaCase {
  readonly id: string;
  readonly input: {
    readonly teleworkDays: number;
    readonly missionDaysFrance: number;
  };
  readonly expected: {
    readonly declarableRate: number;
    readonly frenchTaxedDays: number;
  };
}

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
  readonly taxYear: number;
  readonly cases: readonly GenevaCase[];
};

/** The case both guides narrate: the one where the mission cap binds. */
const NARRATED = fixture.cases.find((one) => one.id === 'c');

const RULES = ruleSetFor(fixture.taxYear);

/** French decimals, as the prose writes them. */
const fr = (value: number): string => value.toFixed(2).replace('.', ',');

const read = (file: string): string => readFileSync(join(GUIDES, file), 'utf8');

describe('the fixture this narration depends on', () => {
  it('is on disk and carries the case both guides tell', () => {
    // NON-VACUITY FIRST. Every assertion below reads from `NARRATED`, so a
    // renamed id would make them all pass against undefined-shaped nothing.
    expect(NARRATED, 'case "c" is missing from geneva-cases.json').toBeDefined();
    expect(NARRATED?.input.teleworkDays).toBe(84);
    expect(NARRATED?.input.missionDaysFrance).toBe(24);
    expect(NARRATED?.expected.declarableRate).toBe(39.16);
    expect(NARRATED?.expected.frenchTaxedDays).toBe(14);
  });

  it('is the same year the guides are written against', () => {
    expect(fixture.taxYear).toBe(2026);
  });
});

/**
 * Every number the two passages state, derived from the fixture and RuleSet.
 *
 * `counted` is the one R147 could never have caught: it is neither a RuleSet
 * figure nor a fixture field, but the sum of one of each.
 */
function narratedValues() {
  const telework = NARRATED?.input.teleworkDays ?? 0;
  const declared = NARRATED?.input.missionDaysFrance ?? 0;
  const credited = Math.min(declared, RULES.missionCapDays);

  return {
    telework: String(telework),
    declared: String(declared),
    credited: String(credited),
    counted: String(telework + credited),
    rate: fr(NARRATED?.expected.declarableRate ?? 0),
    frenchTaxed: String(NARRATED?.expected.frenchTaxedDays ?? 0),
  };
}

describe('jours-de-mission-hors-suisse narrates the fixture (R163)', () => {
  const passage = (): string => {
    const body = read('jours-de-mission-hors-suisse.mdx');
    const start = body.indexOf('Un frontalier à temps plein déclare');
    const end = body.indexOf('##', start);

    expect(start, 'the worked-example passage moved or was rewritten').toBeGreaterThan(-1);

    return body.slice(start, end === -1 ? undefined : end);
  };

  it('states the inputs the fixture carries', () => {
    const text = passage();
    const value = narratedValues();

    expect(text, 'telework days').toContain(value.telework);
    expect(text, 'mission days declared').toContain(value.declared);
  });

  it('states the outputs the fixture carries, and the sum nothing else checks', () => {
    const text = passage();
    const value = narratedValues();

    expect(text, 'days counted against the ceiling').toContain(value.counted);
    expect(text, 'the declarable rate').toContain(value.rate);
    expect(text, 'days taxable in France').toContain(value.frenchTaxed);
  });
});

describe('geneve narrates the fixture (R163)', () => {
  const passage = (): string => {
    const body = read('geneve.mdx');
    const start = body.indexOf('Le cas à');
    const end = body.indexOf('##', start);

    expect(start, 'the commentary passage moved or was rewritten').toBeGreaterThan(-1);

    return body.slice(start, end === -1 ? undefined : end);
  };

  it('states the rate, the declared missions and the days that change side', () => {
    const text = passage();
    const value = narratedValues();

    expect(text, 'the declarable rate').toContain(value.rate);
    expect(text, 'mission days declared').toContain(value.declared);
    expect(text, 'days taxable in France').toContain(value.frenchTaxed);
  });
});

describe('the narration is not free to disagree with the engine', () => {
  it('derives the same rate the fixture publishes, from the inputs it publishes', () => {
    // THE ARITHMETIC ITSELF, so that a fixture edited to be internally
    // inconsistent fails here rather than silently rewriting what the guides
    // are required to say. 84 + 10 credited = 94, over the simplified basis,
    // truncated to two decimals - which is the AFC's published 39,16.
    const telework = NARRATED?.input.teleworkDays ?? 0;
    const credited = Math.min(NARRATED?.input.missionDaysFrance ?? 0, RULES.missionCapDays);
    const counted = telework + credited;
    const truncated = Math.floor((counted / RULES.simplifiedBasisDays) * 10_000) / 100;

    expect(truncated).toBe(NARRATED?.expected.declarableRate);

    // And the days that change side are the missions the cap refused.
    expect((NARRATED?.input.missionDaysFrance ?? 0) - credited).toBe(
      NARRATED?.expected.frenchTaxedDays,
    );
  });
});
