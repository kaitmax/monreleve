// web/tests/unit/fr/home-copy.test.ts
//
// FW-HOME-A2's copy (R712), proven to DELIVER rather than proven not to fail
// (R154): each mechanism that substitutes a figure or a state is given a known
// input and its output is read back.
//
// AND THE PHONE SCREENS' WORDS ARE THE APP'S (R716). The home page draws two
// phones whose screens are static markup; their words are copied into
// lib/fr/home.ts because jsx-no-literals forbids them anywhere else, and this
// file reads the Kotlin constants they were copied from and requires each to
// be equal - so a rename in the app fails here instead of leaving the page
// describing a screen that no longer exists.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { RELEVE_SAMPLE } from '@/lib/content/home';
import { HOME_COPY, HOME_SAMPLE } from '@/lib/fr/home';
import { SOURCE_CITATIONS } from '@/lib/fr/sources';
import { formatDays, formatPercent } from '@/lib/ui/core';

const RULES = ruleSetFor(2026);
const FISCAL = formatPercent(RULES.fiscalCeiling * 100, 0);
const SOCIAL = formatPercent(RULES.socialCeiling * 100, 1);
const MISSION_CAP = formatDays(RULES.missionCapDays);

describe('the figures arrive from the RuleSet, formatted (R710, R147, R154)', () => {
  it('the opening lead names both thresholds it is given', () => {
    const lead = HOME_COPY.opening.lead(FISCAL, SOCIAL, PRODUCT_STATE);

    expect(lead).toContain(FISCAL);
    expect(lead).toContain(SOCIAL);
    expect(lead.indexOf(FISCAL)).toBeLessThan(lead.indexOf(SOCIAL));
  });

  it('the thresholds band delivers the ceiling and the mission cap into its sentences', () => {
    const fiscalBody = HOME_COPY.thresholds.fiscalBody(FISCAL, MISSION_CAP);

    expect(fiscalBody).toContain(` ${FISCAL} `);
    expect(fiscalBody).toContain(` ${MISSION_CAP} `);
    expect(HOME_COPY.thresholds.socialBody(SOCIAL)).toContain(` ${SOCIAL} `);
  });

  it('cites the instruments lib/fr/sources names, never a copy of them (R710, R206)', () => {
    expect(HOME_COPY.thresholds.source(SOURCE_CITATIONS.fiscal).endsWith(SOURCE_CITATIONS.fiscal)).toBe(true);
    expect(HOME_COPY.thresholds.source(SOURCE_CITATIONS.social).endsWith(SOURCE_CITATIONS.social)).toBe(true);
  });

  it('the slider labels end on the French colon their value follows', () => {
    // The island renders "<label> <value>", so the colon and its no-break
    // space belong to the label.
    expect(HOME_COPY.counter.teleworkLabel.endsWith('\u00a0:')).toBe(true);
    expect(HOME_COPY.counter.basisLabel.endsWith('\u00a0:')).toBe(true);
  });
});

describe('the sample is one sample (R714, R206)', () => {
  it('the excerpt names the holder and the year the sample data carries', () => {
    expect(HOME_COPY.excerpt.subtitle(RELEVE_SAMPLE.year)).toBe(
      `Année ${String(RELEVE_SAMPLE.year)}, ${HOME_SAMPLE.holder}`,
    );
    expect(HOME_COPY.excerpt.code).toBe(HOME_SAMPLE.code);
  });

  it('the phone greets the same person the excerpt names', () => {
    const firstName = HOME_SAMPLE.holder.split(' ')[0];

    expect(HOME_COPY.phone.greeting.endsWith(` ${String(firstName)}`)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// THE APP'S OWN WORDS (R716)
// ---------------------------------------------------------------------------

const KOTLIN_FR = join(
  process.cwd(),
  '..',
  'android',
  'shared',
  'src',
  'commonMain',
  'kotlin',
  'ch',
  'monreleve',
  'app',
  'fr',
);

/**
 * One Kotlin `const val`, resolved: a string literal, or a reference to
 * another object's constant (NavCopy.PARAMETRES = ParametresCopy.TITLE).
 */
function kotlinConst(object: string, name: string): string {
  const source = readFileSync(join(KOTLIN_FR, `${object}.kt`), 'utf8');
  const literal = new RegExp(`const val ${name}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(source);

  if (literal?.[1] !== undefined) return literal[1];

  const reference = new RegExp(`const val ${name}\\s*=\\s*(\\w+)\\.(\\w+)`).exec(source);

  if (reference?.[1] !== undefined && reference[2] !== undefined) {
    return kotlinConst(reference[1], reference[2]);
  }

  throw new Error(`${object}.${name} is not a const val string in ${KOTLIN_FR}`);
}

/**
 * The comparison, MODULO THE SPACE BEFORE A FRENCH MARK.
 *
 * lib/fr sets U+00A0 before ? : ; ! and % (R91), and a guard refuses an
 * ordinary space there. AujourdhuiCopy.QUESTION carries an ordinary U+0020
 * before its "?", so byte equality would force this file to copy a defect
 * into the web's copy. Only that one character class is normalised; every
 * letter, accent and apostrophe must be identical. Recorded in the report as
 * NOTICED, NOT TOUCHED - Android is out of scope.
 */
const sameWords = (web: string, android: string): boolean =>
  web.replace(/\u00a0/g, ' ') === android.replace(/[\u00a0\u202f]/g, ' ');

describe('the phone screens say what the app says (R716)', () => {
  const PAIRS: ReadonlyArray<readonly [string, string, string]> = [
    ['question', HOME_COPY.phone.question, kotlinConst('AujourdhuiCopy', 'QUESTION')],
    ['En Suisse', HOME_COPY.phone.swiss, kotlinConst('AujourdhuiCopy', 'SUISSE')],
    ['Domicile', HOME_COPY.phone.home, kotlinConst('AujourdhuiCopy', 'DOMICILE')],
    ['Mission', HOME_COPY.phone.mission, kotlinConst('AujourdhuiCopy', 'MISSION')],
    ['absence', HOME_COPY.phone.absence, kotlinConst('AujourdhuiCopy', 'ABSENCE')],
    ['Enregistré', HOME_COPY.phone.recorded, kotlinConst('AujourdhuiCopy', 'SYNCED')],
    ['Modifier', HOME_COPY.phone.edit, kotlinConst('AujourdhuiCopy', 'MODIFIER')],
    ['tab 1', HOME_COPY.phone.tabs[0], kotlinConst('NavCopy', 'AUJOURDHUI')],
    ['tab 2', HOME_COPY.phone.tabs[1], kotlinConst('NavCopy', 'CALENDRIER')],
    ['tab 3', HOME_COPY.phone.tabs[2], kotlinConst('NavCopy', 'RELEVE')],
    ['tab 4', HOME_COPY.phone.tabs[3], kotlinConst('NavCopy', 'PARAMETRES')],
  ];

  for (const [what, web, android] of PAIRS) {
    it(`${what}: the page's word is the app's`, () => {
      expect(sameWords(web, android), `web «${web}» vs Android «${android}»`).toBe(true);
    });
  }

  it('the greeting is Fr.greeting of the sample holder', () => {
    const bonjour = kotlinConst('Fr', 'BONJOUR');
    const firstName = HOME_SAMPLE.holder.split(' ')[0];

    expect(HOME_COPY.phone.greeting).toBe(`${bonjour} ${String(firstName)}`);
  });

  it('shows four tabs, the bottom-nav count DESIGN-SYSTEM.md fixes', () => {
    expect(HOME_COPY.phone.tabs).toHaveLength(4);
  });

  // POSITIVE CONTROL: the comparison can say no. A comparator that returned
  // true for everything would pass every pair above.
  it('tells two different words apart, and an accent from its absence', () => {
    expect(sameWords('abc', 'abd')).toBe(false);
    expect(sameWords('\u00e9', 'e')).toBe(false);
    expect(sameWords('a\u00a0?', 'a ?')).toBe(true);
  });

  // AND THE READER CAN FAIL: a constant that is not there throws, rather than
  // comparing against undefined.
  it('refuses a constant the Kotlin file does not declare', () => {
    expect(() => kotlinConst('AujourdhuiCopy', 'NO_SUCH_CONSTANT')).toThrow(/not a const val/);
  });
});
