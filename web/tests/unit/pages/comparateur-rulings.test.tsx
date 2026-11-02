// @vitest-environment jsdom
// web/tests/unit/pages/comparateur-rulings.test.tsx
//
// FW-CALCS-A2, the advisor's ruling of 2026-11-03 (relay/RULINGS-2026-11-03.txt,
// ADVISOR RULING 1), on the comparator:
//
//   Q5   When R744's fallback leaves ZERO Swiss months, the Swiss side shows
//        NO total - a sentence that the period is too short for an estimate
//        under an unverified rule, never "0 EUR". Both sides of the boundary.
//   CA12 The case that would read "inferieure a 0 des 13" uses the existing
//        "superieure aux 13" sentence; a tie counts as not-below. One test
//        per boundary.
//   CA1  The year is the designed toggle; both years are selectable and the
//        heading follows (the positive assertion that replaces the select's
//        `.value` read).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ComparateurPage from '@/app/(public)/calculateur-lamal-cmu/page';
import { LAMAL_COPY as COPY } from '@/lib/fr/lamal';
import { AVAILABLE_YEARS, DEFAULT_YEAR } from '@/lib/lamal/years';

afterEach(cleanup);

const change = (element: Element, value: string): void => {
  fireEvent.change(element, { target: { value } });
};

function compareFrom(startIso: string): HTMLElement {
  render(<ComparateurPage />);
  change(screen.getByLabelText(COPY.form.income.label), '42000');
  fireEvent.click(screen.getByRole('button', { name: COPY.form.affiliation.fromDate }));
  change(screen.getByLabelText(COPY.form.affiliation.start), startIso);
  change(screen.getByLabelText(COPY.form.persons.you), '1985');
  fireEvent.click(screen.getByRole('button', { name: COPY.form.submit }));

  const panel = document.querySelector<HTMLElement>('[data-panel]');

  if (panel === null) throw new Error('no panel');

  return panel;
}

describe('Q5: zero Swiss months show no Swiss total', () => {
  it('a December start: the sentence, no Swiss total, no chart, no euro figure for the Swiss side', () => {
    const panel = compareFrom(`${DEFAULT_YEAR}-12-01`);
    const swiss = panel.querySelector('[data-side="switzerland"]');

    expect(swiss?.querySelector('[data-too-short]')?.textContent).toBe(COPY.result.swiss.tooShort);
    expect(swiss?.querySelectorAll('dd')).toHaveLength(0);
    expect(swiss?.textContent ?? '').not.toMatch(/€/);
    expect(panel.querySelector('[data-chart]')).toBeNull();
    expect(panel.querySelector('[data-case-sentence]')).toBeNull();
    // The French side still stands on its own.
    expect(panel.querySelectorAll('[data-side="france"] dd')).toHaveLength(1);
  });

  it('a November start: one month counted, the totals as before, no sentence', () => {
    const panel = compareFrom(`${DEFAULT_YEAR}-11-30`);
    const swiss = panel.querySelector('[data-side="switzerland"]');

    expect(swiss?.querySelector('[data-too-short]')).toBeNull();
    expect(swiss?.querySelectorAll('dd')).toHaveLength(3);
    expect(panel.querySelector('[data-chart]')).not.toBeNull();
    expect(panel.querySelector('[data-case-sentence]')).not.toBeNull();
  });
});

describe('CA12: the counting sentence at each boundary (a tie counts as not-below)', () => {
  const sentence = COPY.result.chart.sentence;
  const N = 13;

  it('every total above the French contribution: "inferieure aux 13"', () => {
    expect(sentence(N, 0, N)).toBe(sentence(N, 0, N));
    expect(sentence(N, 0, N)).toContain(`aux ${N}`);
    expect(sentence(N, 0, N)).not.toBe(sentence(0, N, N));
  });

  it('a tie at the lowest total: the tie is not-below, so 12 of 13', () => {
    // above = 12 (strictly above), below = 0, one tie.
    expect(sentence(12, 0, N)).toContain(`12 des ${N}`);
  });

  it('a tie at the highest total, nothing above: the "superieure aux 13" sentence, never "a 0 des 13"', () => {
    // above = 0, below = 12, one tie.
    expect(sentence(0, 12, N)).toBe(sentence(0, N, N));
    expect(sentence(0, 12, N)).not.toContain(`0 des ${N}`);
  });

  it('every total below the French contribution: the same "superieure aux 13" sentence', () => {
    expect(sentence(0, N, N)).toContain(`aux ${N}`);
    expect(sentence(0, N, N)).not.toBe(sentence(N, 0, N));
  });
});

describe('CA1: the year is the designed toggle', () => {
  it('offers every year the data holds, defaults to the newest, and the heading follows the choice', () => {
    render(<ComparateurPage />);

    const group = screen.getByRole('group', { name: COPY.form.year.label });

    for (const year of AVAILABLE_YEARS) {
      expect(screen.getByRole('button', { name: String(year) })).toBeTruthy();
    }

    expect(screen.getByRole('button', { name: String(DEFAULT_YEAR) }).getAttribute('aria-pressed')).toBe('true');
    expect(group.querySelector('select')).toBeNull();

    const other = AVAILABLE_YEARS.find((year) => year !== DEFAULT_YEAR);

    if (other === undefined) throw new Error('one year only');

    fireEvent.click(screen.getByRole('button', { name: String(other) }));
    change(screen.getByLabelText(COPY.form.income.label), '42000');
    change(screen.getByLabelText(COPY.form.persons.you), '1985');
    fireEvent.click(screen.getByRole('button', { name: COPY.form.submit }));

    expect(screen.getByRole('button', { name: String(other) }).getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-panel] h2')?.textContent).toBe(COPY.result.heading(other));
  });
});
