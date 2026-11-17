// web/tests/unit/content/privacy-cases.test.ts
//
// FW-DELAI-RAPPEL (Queue Ruling 24): « Une adresse e-mail est enregistrée dans
// N cas seulement » IS A COUNT, AND A COUNT IS ASSERTED AGAINST WHAT IT COUNTS.
//
// The sentence said « deux cas seulement » and went FALSE BY COUNT the day a
// third case was stored - every guard green, because each case sentence was
// right about itself and nothing counted them (R175: two true things, and the
// unexamined space between them). The lead is now derived from EMAIL_CASES;
// this test does NOT read that derivation back. It reads the PAGE's own list -
// the sentences that open with an ordinal and « cas, » - and the number word in
// the lead, and requires them to agree. A derivation that drifted, or a fourth
// case written without an entry in EMAIL_CASES, fails here.

import { describe, expect, it } from 'vitest';
import { CONFIDENTIALITE_COPY, DISCLOSED_RECORDS, EMAIL_CASES } from '@/lib/fr/confidentialite';

/** The ordinals a case sentence may open with, in order. */
const ORDINALS = ['Premier', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième'] as const;

/** The count words the lead may use. */
const COUNT_WORDS: Readonly<Record<string, number>> = { un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5 };

const CASE_OPENING = new RegExp(`^(${ORDINALS.join('|')}) cas, `, 'u');

const web: readonly string[] = CONFIDENTIALITE_COPY.web;
const caseSentences = web.filter((sentence) => CASE_OPENING.test(sentence));
const lead = web.find((sentence) => sentence.includes(' cas seulement'));

describe('the page counts its cases correctly', () => {
  it('found a lead and some cases, so nothing below passes vacuously', () => {
    expect(lead, 'no « cas seulement » sentence on the page').toBeDefined();
    expect(caseSentences.length).toBeGreaterThanOrEqual(2);
  });

  it('says as many cases as it lists', () => {
    const word = /dans (\S+) cas seulement/u.exec(lead ?? '')?.[1] ?? '';

    expect(Object.hasOwn(COUNT_WORDS, word), `unknown count word ${JSON.stringify(word)}`).toBe(true);
    expect(COUNT_WORDS[word]).toBe(caseSentences.length);
  });

  it('numbers its cases in order, from the first', () => {
    const opened = caseSentences.map((sentence) => CASE_OPENING.exec(sentence)?.[1]);

    expect(opened).toEqual(ORDINALS.slice(0, caseSentences.length));
  });

  it('lists the cases right after the lead, in EMAIL_CASES order', () => {
    // The page's cases and the derivation's list are the same sentences.
    expect(caseSentences).toEqual(EMAIL_CASES.map((key) => DISCLOSED_RECORDS[key]));
    expect(web.indexOf(caseSentences[0] ?? '')).toBe(web.indexOf(lead ?? '') + 1);
  });

  it('includes the deadline reminder as a case (R919)', () => {
    expect(caseSentences).toContain(DISCLOSED_RECORDS.deadlineReminder);
  });
});
