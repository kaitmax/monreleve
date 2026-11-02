// @vitest-environment jsdom
// web/tests/unit/pages/comparateur.test.tsx
//
// /calculateur-lamal-cmu, rendered. FW-COMPARATEUR, R658 (the prompt's R642)
// and R673 (what the page never says).
//
// BY COUNT AND BY POSITION (R119, R137): the irrevocability banner exactly
// once and before the result; the limits list visible, not behind a click;
// three Swiss figures, never one; the badge only when the spread allows it;
// the PASS label only for an announced year; the floor note only when the
// formula went negative; no control the form could submit by name; and an
// analytics event that carries nothing.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import ComparateurPage from '@/app/(public)/calculateur-lamal-cmu/page';
import type { AnalyticsEvent } from '@/lib/analytics/events';
import { setCollector } from '@/lib/analytics/track';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { compare } from '@/lib/lamal/compare';
import { DEFAULT_YEAR } from '@/lib/lamal/years';
import { ComparisonPanel } from '@/lib/ui/react/Comparison/ComparisonPanel';
import { IrrevocabilityBanner } from '@/lib/ui/react/Comparison/IrrevocabilityBanner';

expect.extend(matchers);

const seen: AnalyticsEvent[] = [];

beforeEach(() => {
  seen.length = 0;
  setCollector((event) => seen.push(event));
});

afterEach(() => {
  setCollector(null);
  cleanup();
});

const COPY = LAMAL_COPY;

function fill(income: string, birthYears: readonly string[]): void {
  fireEvent.change(screen.getByLabelText(COPY.form.income.label), { target: { value: income } });
  birthYears.forEach((year, index) => {
    if (index > 0) fireEvent.click(screen.getByRole('button', { name: COPY.form.persons.add }));
    const label = index === 0 ? COPY.form.persons.you : COPY.form.persons.other(index + 1);

    fireEvent.change(screen.getByLabelText(label), { target: { value: year } });
  });
  fireEvent.click(screen.getByRole('button', { name: COPY.form.submit }));
}

describe('the empty page', () => {
  it('has one h1, the lead, and the banner exactly once', () => {
    const { container } = render(<ComparateurPage />);

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.textContent).toContain(COPY.intro);
    expect(container.querySelectorAll('[data-banner="irrevocable"]')).toHaveLength(1);
    expect(container.querySelector('[data-panel]')).toBeNull();
  });

  it('lists what the comparison leaves out, visibly - every item, outside any disclosure', () => {
    const { container } = render(<ComparateurPage />);
    const limits = container.querySelector('[data-limits]');

    expect(limits?.closest('details')).toBeNull();
    expect(limits?.querySelectorAll('li').length).toBe(COPY.limits('x', 'y').length);
    expect(COPY.limits('x', 'y').length).toBeGreaterThanOrEqual(8);
  });

  it('gives no control a name, so a native submission can carry nothing typed', () => {
    // The nojs e2e proves the consequence in a browser; this proves the cause
    // on every control, including the ones a later edit might add.
    const { container } = render(<ComparateurPage />);
    const form = container.querySelector('form');
    const controls = form?.querySelectorAll('input, select, textarea, button') ?? [];

    expect(controls.length).toBeGreaterThanOrEqual(4);
    for (const control of controls) {
      expect(control.getAttribute('name'), control.outerHTML.slice(0, 80)).toBeNull();
    }
    expect(form?.getAttribute('action')).toBeNull();
    expect(form?.getAttribute('method')).toBeNull();
  });

  it('defaults the year to the newest the data holds, and the frontalier to no accident cover', () => {
    render(<ComparateurPage />);

    // CA1 (ADVISOR RULING 1, 2026-11-03): the year is the designed toggle, so
    // the default is read as the pressed segment of the year group - the
    // positive assertion that replaces the select's .value read. Both years
    // being selectable, and the heading following, is comparateur-rulings.test.tsx.
    expect(
      within(screen.getByRole('group', { name: COPY.form.year.label }))
        .getByRole('button', { name: String(DEFAULT_YEAR) })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect((screen.getByLabelText(COPY.form.persons.accident) as HTMLInputElement).checked).toBe(false);
  });
});

describe('a comparison', () => {
  it('renders both sides, three Swiss figures, the banner BEFORE the result, and tracks nothing typed', () => {
    const { container } = render(<ComparateurPage />);

    fill('60000', ['1985', '2016']);

    const panel = container.querySelector('[data-panel="comparison"]');

    expect(panel).not.toBeNull();
    expect(panel?.querySelectorAll('[data-side]')).toHaveLength(2);
    expect(panel?.querySelectorAll('[data-side="switzerland"] dt')).toHaveLength(3);

    const banner = container.querySelector('[data-banner="irrevocable"]');

    expect(container.querySelectorAll('[data-banner="irrevocable"]')).toHaveLength(1);
    // DOCUMENT_POSITION_FOLLOWING: the panel comes after the banner.
    expect(banner?.compareDocumentPosition(panel as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    expect(seen).toEqual([{ name: 'comparator_calculated' }]);
  });

  it('never says "recommandé" and never names an insurer', () => {
    const { container } = render(<ComparateurPage />);

    fill('60000', ['1985']);

    const text = container.textContent ?? '';

    expect(text.toLowerCase()).not.toContain('recommand');
    // The OFSP numbers identify insurers in the data; none reaches the page.
    expect(container.querySelector('[data-panel]')?.textContent).not.toMatch(/\b1562\b|\b376\b/);
  });

  it('refuses a malformed income with the field error and no result', () => {
    const { container } = render(<ComparateurPage />);

    fill('42 000,50', ['1985']);

    // By textContent: the message carries U+202F, which getByText normalises away.
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(COPY.errors.income);
    expect(container.querySelector('[data-panel]')).toBeNull();
    expect(seen).toEqual([]);
  });

  it('refuses a year of birth after the premium year, on that person', () => {
    render(<ComparateurPage />);

    fill('40000', [String(DEFAULT_YEAR + 1)]);

    expect(screen.getByText(COPY.errors.birthYear(DEFAULT_YEAR))).toBeTruthy();
  });
});

describe('the panel, state by state', () => {
  const comparison = (year: number, incomeEur: number) => {
    const result = compare({ year, incomeEur, persons: [{ birthYear: 1985, withAccident: false }] });

    if (!result.ok) throw new Error(result.error.code);

    return result.value;
  };

  const panelText = (year: number, income: number): HTMLElement => {
    const { container } = render(<ComparisonPanel state={{ kind: 'comparison', value: comparison(year, income) }} />);

    return container;
  };

  // R674 (the operator, 28.10.2026): NO BADGE - one factual sentence chosen by
  // the case. R225: each sentence is asserted on the RENDERED RESULT of the
  // page, for an input that is in its case, and the other two are asserted
  // absent - a test that always required a sentence would pass on the wrong
  // case.
  const SENTENCES = [COPY.result.below, COPY.result.above, COPY.result.depends] as const;

  const resultFor = (income: string): HTMLElement => {
    const { container } = render(<ComparateurPage />);

    fill(income, ['1985']);

    const panel = container.querySelector<HTMLElement>('[data-panel="comparison"]');

    if (panel === null) throw new Error('no result rendered');

    return panel;
  };

  it.each([
    // (12 225 - 12 225) x 8 % = 0 EUR, below the lowest Swiss total.
    ['below the LOWEST Swiss total', '12225', COPY.result.below],
    // (1 000 000 - 12 225) x 8 % = 79 022 EUR, above the highest.
    ['above the HIGHEST Swiss total', '1000000', COPY.result.above],
    // (60 000 - 12 225) x 8 % = 3 822 EUR, between the two.
    ['between the two', '60000', COPY.result.depends],
  ])('states the case in one sentence when the French contribution is %s', (_case, income, sentence) => {
    const panel = resultFor(income);
    const text = panel.textContent ?? '';

    expect(panel.querySelector('[data-case-sentence]')?.textContent).toBe(sentence);
    for (const other of SENTENCES.filter((candidate) => candidate !== sentence)) {
      expect(text).not.toContain(other);
    }
  });

  it('carries no badge, and not the badge wording, in any case', () => {
    // Only the BADGE wording is forbidden: the operator kept the between-case
    // sentence unchanged, and it says "l’un ou l’autre est moins cher".

    for (const income of ['12225', '1000000', '60000']) {
      const panel = resultFor(income);

      expect(panel.querySelector('[data-badge]')).toBeNull();
      expect((panel.textContent ?? '').toLowerCase()).not.toContain('selon ces hypoth');
      cleanup();
    }
  });

  it('labels the 2027 PASS as announced, and the 2026 one not', () => {
    expect(panelText(2027, 60000).querySelector('[data-pass="announced"]')?.textContent).toBe(
      COPY.result.french.passAnnounced(2027),
    );
    cleanup();
    expect(panelText(2026, 60000).querySelector('[data-pass]')).toBeNull();
  });

  it('says the 0 is the site reading only when the formula went negative (PARK-28)', () => {
    expect(panelText(2027, 12224).querySelector('[data-floored]')).not.toBeNull();
    cleanup();
    expect(panelText(2027, 12225).querySelector('[data-floored]')).toBeNull();
  });

  it('refuses a year it does not hold, by name, with no figure', () => {
    const { container } = render(<ComparisonPanel state={{ kind: 'refusal', year: DEFAULT_YEAR + 1 }} />);

    expect(within(container).getByRole('heading').textContent).toBe(COPY.refusal.heading(DEFAULT_YEAR + 1));
    expect(container.querySelector('[data-side]')).toBeNull();
  });
});

describe('jest-axe (SPEC 16), every state', () => {
  it('the empty page', async () => {
    const { container } = render(<ComparateurPage />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('a filled page with a result', async () => {
    const { container } = render(<ComparateurPage />);

    fill('60000', ['1985', '2016']);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('a field error', async () => {
    const { container } = render(<ComparateurPage />);

    fill('abc', ['85']);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('the refusal, and the banner alone', async () => {
    const { container } = render(
      <>
        <IrrevocabilityBanner />
        <ComparisonPanel state={{ kind: 'refusal', year: DEFAULT_YEAR + 1 }} />
      </>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
