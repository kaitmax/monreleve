// @vitest-environment jsdom
//
// web/tests/unit/pages/page-section-order.test.tsx
//
// RULING R137: ADJACENCY IS ASSERTED AS SEQUENCE OR NOT AT ALL.
//
// WHY THE RULING EXISTS, in the operator's words: "Every element in that share
// row was present, correct, and individually tested. What was wrong was the
// ORDER, and order is a property of the page rather than of anything on it."
//
// FW13 shipped the share row ABOVE the link notice that explains it, so the
// calculator read: form, two share buttons, then "your link was incomplete -
// you can correct the fields above; the link you share will be up to date".
// Advice about sharing, arriving after the buttons it is advice about. Every
// test passed in both orders, because each one reaches for its own element by
// selector and none of them looked at the sequence. It was found by cropping
// a baseline and reading it.
//
// IT ALSO CLOSES FW13 RETROACTIVELY, which is the point worth recording. That
// order was fixed BY HAND in FW13 increment 6 with nothing asserting it
// afterwards - correct, but only coincidentally so. This is the assertion that
// was missing when it shipped wrong.
//
// IT COMPOSES WITH THE PANEL TEST RATHER THAN REPEATING IT.
// tests/unit/pages/result-panel-order.test.tsx asserts a NEGATIVE - 'email'
// and 'share' are never panel SLOTS, which forbids the wrong construction -
// and this asserts a POSITIVE, that they sit at these page-level positions. A
// slot that should not exist and an order that should are different failures,
// and neither assertion implies the other.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CalculateurPage from '@/app/(public)/calculateur-teletravail-frontalier/page';
import AlertesPage from '@/app/(public)/alertes/page';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

afterEach(cleanup);

/**
 * The page's own sections, in document order.
 *
 * Each landmark is identified by something structural rather than by a class:
 * an id the product depends on, or a data attribute a test may rely on. A
 * selector list, queried once, IS the sequence - querySelectorAll returns
 * document order, which is the whole mechanism.
 */
const SELECTORS = [
  '[data-notice="params"]',
  '[data-share]',
  '[data-notice="provisional"]',
  '#resultat',
  '[data-alert-scenario]',
  '[data-explanation]',
  '[data-faq]',
] as const;

const NAMES: Readonly<Record<string, string>> = {
  '[data-notice="params"]': 'link notice',
  '[data-share]': 'share row',
  '[data-notice="provisional"]': 'provisional notice',
  '#resultat': 'result',
  '[data-alert-scenario]': 'capture card',
  '[data-explanation]': 'explanation',
  '[data-faq]': 'FAQ',
};

function sequence(container: HTMLElement): string[] {
  return [...container.querySelectorAll(SELECTORS.join(', '))].map((element) => {
    const match = SELECTORS.find((selector) => element.matches(selector));

    return NAMES[String(match)] ?? 'unknown';
  });
}

describe('R137: the calculator page renders its sections in one order', () => {
  it('puts the capture card last, after everything the island renders', () => {
    // SPEC 9.3 item 8. The reader's question is "how many days do I have
    // left", and the answer must never sit behind an email field - SPEC 9.3
    // says the result is NEVER gated. "Below" is not a property of the card;
    // it is a property of the page, which is why it is asserted here.
    const { container } = render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    const order = sequence(container);

    expect(order).toEqual(['share row', 'result', 'capture card', 'explanation', 'FAQ']);
  });

  it('puts the FAQ last, after the prose it elaborates (R137, FW15)', () => {
    // WHY LAST AND NOT HIGHER UP. The FAQ answers questions the explanation
    // raises - what the two thresholds are, what missions do, what happens to
    // sick days - so it reads as elaboration rather than as a second
    // introduction. Placed above the explanation it would answer questions
    // the reader has not been given yet.
    //
    // AND IT IS BELOW THE CAPTURE CARD DELIBERATELY. SPEC 9.3 item 8 puts the
    // card under everything the island renders; moving the FAQ between them
    // would push the card down the page behind three collapsed answers, which
    // is the sort of quiet demotion that only shows up in a conversion
    // number.
    const { container } = render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    const order = sequence(container);

    expect(order.at(-1)).toBe('FAQ');
    expect(order.indexOf('explanation')).toBeLessThan(order.indexOf('FAQ'));
    expect(order.indexOf('capture card')).toBeLessThan(order.indexOf('explanation'));
  });

  it('puts the share row after the notice that explains the link', () => {
    // THE FW13 DEFECT, NOW ASSERTED. Reached by arriving at a mangled URL,
    // which is the only way the notice exists.
    window.history.replaceState(
      null,
      '',
      '/calculateur-teletravail-frontalier?canton=GE&tt=84&taux=abc',
    );

    const { container } = render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    const order = sequence(container);

    expect(order).toEqual([
      'link notice',
      'share row',
      'result',
      'capture card',
      'explanation',
      'FAQ',
    ]);
  });

  it('keeps the order once there is a result and a provisional notice', () => {
    // The heaviest arrangement: every section the page can show at once. An
    // order that only holds in the empty state is not an order.
    window.history.replaceState(null, '', '/calculateur-teletravail-frontalier');

    const { container } = render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    const FORM = CALCULATEUR_COPY.form;

    fireEvent.change(screen.getByLabelText(FORM.canton.label), {
      target: { value: 'GE' },
    });
    fireEvent.change(screen.getByLabelText(FORM.days.label), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(FORM.rate.label), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: FORM.advanced.summary }));
    fireEvent.click(screen.getByRole('radio', { name: FORM.method.exact }));

    const order = sequence(container);

    expect(order).toEqual([
      'share row',
      'provisional notice',
      'result',
      'capture card',
      'explanation',
      'FAQ',
    ]);
  });

  it('finds every section it claims to order', () => {
    // R63. If a selector stopped matching, every assertion above would still
    // pass on the shorter list it produced - the sequence would simply have
    // one fewer name in it, and nothing would say so.
    window.history.replaceState(
      null,
      '',
      '/calculateur-teletravail-frontalier?canton=GE&tt=84&taux=abc',
    );

    const { container } = render(
      <PublicShell>
        <CalculateurPage />
      </PublicShell>,
    );

    for (const selector of SELECTORS) {
      if (selector === '[data-notice="provisional"]') continue;

      expect(container.querySelector(selector), selector).not.toBeNull();
    }
  });
});

describe('R137: the standalone landing', () => {
  it('puts its capture card after the offer, under one h1', () => {
    const { container } = render(
      <PublicShell>
        <AlertesPage />
      </PublicShell>,
    );

    const headings = [...container.querySelectorAll('h1, h2')].map(
      (element) => element.tagName,
    );

    // One h1 for the page, then the card's own h2. A card that emitted a
    // second h1 would give the page two, which the singleton census catches -
    // this says the ORDER is heading-then-card rather than the reverse.
    expect(headings[0]).toBe('H1');
    expect(headings).toContain('H2');

    const h1 = container.querySelector('h1');
    const card = container.querySelector('[data-alert-scenario]');

    expect(h1).not.toBeNull();
    expect(card).not.toBeNull();

    // compareDocumentPosition is the only way to ask "is this after that"
    // without inventing an ordering of my own.
    const position = (h1 as Element).compareDocumentPosition(card as Node);

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
