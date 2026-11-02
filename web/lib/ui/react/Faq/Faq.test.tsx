// @vitest-environment jsdom
// web/lib/ui/react/Faq/Faq.test.tsx
//
// FW-HOME-A2 (R717) added three optional things to the FAQ - an entry open on
// arrival, an Avant / Apres pair drawn as two cards, a split layout - and each
// is absent by default, so the calculator's FAQ renders as it always has.
// Both halves are asserted: the default unchanged, and each option delivered.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { FaqEntry } from '@/lib/fr/faq';
import { Faq } from './Faq';

afterEach(cleanup);

/** Synthetic entries: this file tests a component, not the product's copy. */
const PLAIN: FaqEntry = { id: 'a', question: 'Q-A', answer: 'ANSWER-A' };
const PAIRED: FaqEntry = {
  id: 'b',
  question: 'Q-B',
  answer: 'BEFORE-BODY AFTER-BODY',
  open: true,
  pair: {
    before: { label: 'BEFORE', body: 'BEFORE-BODY' },
    after: { label: 'AFTER', body: 'AFTER-BODY' },
  },
};

describe('the default FAQ is unchanged', () => {
  it('renders every entry closed, the answer as a paragraph, straight under the section', () => {
    const { container } = render(<Faq heading="H" entries={[PLAIN, { ...PLAIN, id: 'c' }]} />);
    const section = container.querySelector('[data-faq]');

    expect(section?.querySelectorAll(':scope > details')).toHaveLength(2);
    expect(section?.querySelectorAll('details[open]')).toHaveLength(0);
    expect(section?.querySelector('details p')?.textContent).toBe('ANSWER-A');
  });
});

describe('the options FW-HOME-A2 added (R717)', () => {
  it('opens an entry marked open, and only that one', () => {
    const { container } = render(<Faq heading="H" entries={[PAIRED, PLAIN]} />);
    const details = [...container.querySelectorAll('details')];

    expect(details[0]?.hasAttribute('open')).toBe(true);
    expect(details[1]?.hasAttribute('open')).toBe(false);
  });

  it('draws a pair as two labelled cards, in place of the answer paragraph', () => {
    const { container } = render(<Faq heading="H" entries={[PAIRED]} />);
    const text = container.querySelector('details')?.textContent ?? '';

    expect(text).toContain('BEFORE');
    expect(text).toContain('AFTER-BODY');
    // The plain-text answer is not drawn a second time beside the cards.
    expect(text).not.toContain('BEFORE-BODY AFTER-BODY');
  });

  it('puts the heading beside the questions in the split layout, the questions together', () => {
    const { container } = render(<Faq heading="H" entries={[PAIRED, PLAIN]} layout="split" />);
    const section = container.querySelector('[data-faq]');

    expect(section?.querySelector(':scope > h2')?.textContent).toBe('H');
    expect(section?.querySelectorAll(':scope > div > details')).toHaveLength(2);
  });
});

// FW-COMPARATEUR-SURFACE: an answer may end on ONE link, absent by default.
// Both directions, because an option that is never rendered satisfies the
// "absent by default" half perfectly (R196's shape).
describe('the link FW-COMPARATEUR-SURFACE added', () => {
  const LINKED: FaqEntry = { ...PLAIN, id: 'd', link: { text: 'LINK-TEXT', href: '/somewhere' } };

  it('ends the answer paragraph on the link, after the plain-text answer', () => {
    const { container } = render(<Faq heading="H" entries={[LINKED]} />);
    const paragraph = container.querySelector('details p');
    const anchor = paragraph?.querySelector('a');

    expect(anchor?.getAttribute('href')).toBe('/somewhere');
    expect(anchor?.textContent).toBe('LINK-TEXT');
    expect(paragraph?.textContent).toBe('ANSWER-A LINK-TEXT');
  });

  it('renders no anchor for an entry without one', () => {
    const { container } = render(<Faq heading="H" entries={[PLAIN, PAIRED]} />);

    expect(container.querySelectorAll('details a')).toHaveLength(0);
  });
});
