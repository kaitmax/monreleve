// @vitest-environment jsdom
// web/tests/unit/pages/faq.test.tsx
//
// The inline FAQ: SPEC 14's three questions, and the property that makes it
// safe to generate FAQPage structured data from the same source.
//
// THE CLOAKING PROPERTY IS THE ONE WORTH ASSERTING. Increment 3 emits a
// FAQPage whose questions and answers come from lib/fr/faq.ts; a structured
// claim a reader cannot see is cloaking, and search engines treat it as such.
// A COLLAPSED accordion is the obvious way to fail that test without noticing
// - the answer looks present in the source and is absent from the DOM. So
// these assertions read the rendered output with nothing opened, which is the
// state a crawler and a scripting-off reader both meet.
//
// <details> IS WHY THAT HOLDS, and it is the reason the FAQ does not reuse
// the calculator's advanced-options disclosure. That one is a React button
// inside the island, and it does not render its panel at all while closed -
// correct there, where the panel is form fields nobody has asked for, and
// wrong here, where the panel is the answer the page exists to give. A native
// <details> keeps its content in the DOM, needs no JavaScript, and is
// keyboard-operable without any of ours.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FAQ_COPY } from '@/lib/fr/faq';
import { Faq } from '@/lib/ui/react/Faq/Faq';

afterEach(cleanup);

/**
 * Fixtures that DISAGREE with the real rules (R120), and with each other.
 * "40 %" substituted into a string that already said 40 % proves nothing; a
 * value no RuleSet could produce proves the argument reached the sentence.
 */
const FIXTURES = { fiscal: 'AAA', social: 'BBB', basisDays: 'CCC' };

const entries = FAQ_COPY.entries(FIXTURES);

describe('the FAQ copy', () => {
  it('asks SPEC 14’s three questions and no others', () => {
    // The ids, not the prose: the prose is TODO-COPY and will be rewritten by
    // a reviewer, and a test that pinned it would fail on that edit for no
    // reason. What must not drift is WHICH three questions the page answers.
    expect(entries.map((entry) => entry.id)).toEqual([
      'deux-seuils',
      'missions',
      'conges-maladie',
    ]);
  });

  it('takes every threshold as an argument rather than writing one down (R73)', () => {
    const all = entries.map((entry) => `${entry.question} ${entry.answer}`).join(' ');

    // Present because they were passed in...
    expect(all).toContain(FIXTURES.fiscal);
    expect(all).toContain(FIXTURES.social);
    expect(all).toContain(FIXTURES.basisDays);

    // ...and absent as literals, which is the half that catches the mistake.
    // A hardcoded ceiling would survive every other test in this file.
    expect(all).not.toMatch(/\d+(,\d+)?\s*%/);
    expect(all).not.toContain('240');
  });

  it('puts the two thresholds in the question that is about telling them apart', () => {
    const [first] = entries;

    expect(first?.question).toContain(FIXTURES.fiscal);
    expect(first?.question).toContain(FIXTURES.social);
  });
});

describe('the FAQ component', () => {
  // READ OUT OF THE DOM RATHER THAN THROUGH getByText, AND THE REASON IS R96.
  // Testing Library's default normalizer collapses whitespace, and U+00A0 is
  // whitespace to that regex: the DOM holds U+00A0 before the colon and the
  // normaliser turns it into U+0020, while the expected string still carries
  // the no-break space - so the query fails on copy that is correct.
  //
  // Comparing textContent asserts the exact codepoints, which for copy whose
  // whole subject is invisible characters is the assertion worth having. The
  // first version of this comment SPELT the no-break space rather than naming
  // it, and eslint's no-irregular-whitespace caught it: a literal U+00A0 in a
  // comment explaining literal U+00A0s.
  const questions = (container: HTMLElement): (string | null)[] =>
    [...container.querySelectorAll('summary')].map((node) => node.textContent);

  const answers = (container: HTMLElement): (string | null)[] =>
    [...container.querySelectorAll('details > p')].map((node) => node.textContent);

  it('renders every question as a summary', () => {
    const { container } = render(<Faq heading={FAQ_COPY.heading} entries={entries} />);

    expect(questions(container)).toEqual(entries.map((entry) => entry.question));
  });

  it('keeps every answer in the DOM while the accordion is closed', () => {
    // THE CLOAKING ASSERTION. Nothing is opened before this reads the output.
    const { container } = render(<Faq heading={FAQ_COPY.heading} entries={entries} />);

    expect(container.querySelectorAll('details[open]').length).toBe(0);
    expect(answers(container)).toEqual(entries.map((entry) => entry.answer));
  });

  it('pairs each answer with its own question rather than merely rendering both', () => {
    // Presence is not correspondence. Three questions and three answers in
    // one list would satisfy every assertion above while answering the wrong
    // question - and the FAQPage generated from the same source would then
    // publish that mismatch as structured data.
    const { container } = render(<Faq heading={FAQ_COPY.heading} entries={entries} />);
    const blocks = [...container.querySelectorAll('details')];

    expect(blocks.length).toBe(entries.length);

    blocks.forEach((block, index) => {
      const entry = entries[index];

      expect(block.querySelector('summary')?.textContent).toBe(entry?.question);
      expect(block.textContent).toContain(entry?.answer);
    });
  });

  it('heads the section with a real heading, so the page outline includes it', () => {
    render(<Faq heading={FAQ_COPY.heading} entries={entries} />);

    expect(screen.getByRole('heading', { name: FAQ_COPY.heading })).toBeDefined();
  });
});
