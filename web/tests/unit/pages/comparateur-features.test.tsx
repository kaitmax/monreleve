// @vitest-environment jsdom
// web/tests/unit/pages/comparateur-features.test.tsx
//
// /calculateur-lamal-cmu, ADDENDUM 2's six features, rendered. FW-CALCS-A2,
// R743-R748 and R750-R751.
//
// Each feature is driven through the page's own controls and its result read
// off the rendered panel, against the figure lib/lamal computes for the same
// inputs (R171: the expectation is DERIVED, so a change to the arithmetic
// moves both). The copy is LAMAL_COPY's, never retyped (R126).
//
// R750 is asserted on EVERY control the page renders - the form's, the
// slider in the result and the deadline helper's - because the existing
// "gives no control a name" test reads only the form.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import ComparateurPage from '@/app/(public)/calculateur-lamal-cmu/page';
import { DEADLINE_ID } from '@/app/(public)/calculateur-lamal-cmu/DeadlineHelper';
import type { AnalyticsEvent } from '@/lib/analytics/events';
import { setCollector } from '@/lib/analytics/track';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { convertAt } from '@/lib/lamal/convert';
import { careCapCentimes } from '@/lib/lamal/cost-sharing';
import { optionPeriodEnd } from '@/lib/lamal/deadline';
import { formatChf, formatEur, formatRate } from '@/lib/lamal/format';
import { formatDate } from '@/lib/ui/core';
import { PRORATA_YEAR_DAYS, countAgainst, householdTotals, jointIncomeEur, scenario } from '@/lib/lamal/scenario';
import type { Scenario, ScenarioInput } from '@/lib/lamal/scenario';
import { DEFAULT_YEAR, EXCHANGE_RATE } from '@/lib/lamal/years';
import { FRANC_INPUT_ID } from '@/lib/ui/react/Comparison/ComparisonPanel';

expect.extend(matchers);

const COPY = LAMAL_COPY;
const seen: AnalyticsEvent[] = [];

beforeEach(() => {
  seen.length = 0;
  setCollector((event) => seen.push(event));
});

afterEach(() => {
  setCollector(null);
  cleanup();
});

/** Whitespace as a reader sees it. */
const squash = (text: string | null | undefined): string => (text ?? '').replace(/[\s\u00a0\u202f]+/g, ' ').trim();

const ADULT = { birthYear: 1985, withAccident: false };

function expected(input: Omit<ScenarioInput, 'year' | 'persons'> & { persons?: ScenarioInput['persons'] }): Scenario {
  const result = scenario({ year: DEFAULT_YEAR, persons: [ADULT], ...input });

  if (!result.ok) throw new Error(result.error.code);

  return result.value;
}

const change = (element: Element, value: string): void => {
  fireEvent.change(element, { target: { value } });
};

function birth(year: string): void {
  change(screen.getByLabelText(COPY.form.persons.you), year);
}

function submit(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: COPY.form.submit }));

  return document.querySelector<HTMLElement>('[data-panel]') ?? document.body;
}

describe('R743: the joint tax return', () => {
  it('shows the base under the fields and compares on personal + half of common', () => {
    render(<ComparateurPage />);
    fireEvent.click(screen.getByRole('button', { name: COPY.form.declaration.joint }));

    expect(screen.queryByLabelText(COPY.form.income.label)).toBeNull();

    change(screen.getByLabelText(COPY.form.declaration.personal), '38000');
    change(screen.getByLabelText(COPY.form.declaration.common), '8000');

    const base = jointIncomeEur(38000, 8000);

    expect(document.querySelector('[data-joint-base]')?.textContent).toBe(COPY.form.declaration.here(formatEur(base)));

    birth('1985');

    const panel = submit();

    expect(squash(panel.querySelector('[data-side="france"] dd')?.textContent)).toContain(
      squash(formatEur(expected({ incomeEur: base }).comparison.french.contributionEur)),
    );
  });

  it('counts an empty common field as 0', () => {
    render(<ComparateurPage />);
    fireEvent.click(screen.getByRole('button', { name: COPY.form.declaration.joint }));
    change(screen.getByLabelText(COPY.form.declaration.personal), '42000');

    expect(document.querySelector('[data-joint-base]')?.textContent).toBe(COPY.form.declaration.here(formatEur(42000)));

    birth('1985');

    const panel = submit();

    expect(squash(panel.querySelector('[data-side="france"] dd')?.textContent)).toContain(
      squash(formatEur(expected({ incomeEur: 42000 }).comparison.french.contributionEur)),
    );
  });

  it('refuses a malformed common field on that field', () => {
    render(<ComparateurPage />);
    fireEvent.click(screen.getByRole('button', { name: COPY.form.declaration.joint }));
    change(screen.getByLabelText(COPY.form.declaration.personal), '42000');
    change(screen.getByLabelText(COPY.form.declaration.common), '8 000,50');
    birth('1985');
    submit();

    expect(document.getElementById('revenus-communs-error')?.textContent).toContain(COPY.errors.income);
    expect(document.querySelector('[data-panel]')).toBeNull();
  });
});

describe('R744: an affiliation from a date', () => {
  const START = `${DEFAULT_YEAR}-03-01`;

  it('prorates the French side, counts the Swiss months after the start, and says both', () => {
    render(<ComparateurPage />);
    change(screen.getByLabelText(COPY.form.income.label), '42000');
    fireEvent.click(screen.getByRole('button', { name: COPY.form.affiliation.fromDate }));
    change(screen.getByLabelText(COPY.form.affiliation.start), START);
    birth('1985');

    const panel = submit();
    const value = expected({ incomeEur: 42000, startIso: START });
    const period = value.period;

    if (period === null) throw new Error('no period');

    expect(panel.querySelector('h2')?.textContent).toBe(COPY.result.headingFrom(DEFAULT_YEAR, START));
    expect(panel.querySelector('[data-prorata]')?.textContent).toBe(COPY.result.french.prorata(period.days, PRORATA_YEAR_DAYS));
    expect(panel.querySelector('[data-start-month]')?.textContent).toBe(COPY.result.swiss.startMonth);
    expect(squash(panel.querySelector('[data-side="france"] dd')?.textContent)).toBe(
      squash(`${formatEur(value.comparison.french.contributionEur)} ${COPY.result.forDays(period.days)}`),
    );
    expect(squash(panel.querySelector('[data-side="switzerland"] dd')?.textContent)).toContain(
      squash(`${formatEur(value.comparison.swiss.lowestEur)} ${COPY.result.forMonths(period.months)}`),
    );
  });

  it('refuses a date outside the compared year', () => {
    render(<ComparateurPage />);
    change(screen.getByLabelText(COPY.form.income.label), '42000');
    fireEvent.click(screen.getByRole('button', { name: COPY.form.affiliation.fromDate }));
    change(screen.getByLabelText(COPY.form.affiliation.start), `${DEFAULT_YEAR - 1}-12-31`);
    birth('1985');
    submit();

    expect(document.getElementById('debut-affiliation-error')?.textContent).toContain(COPY.errors.start(DEFAULT_YEAR));
    expect(document.querySelector('[data-panel]')).toBeNull();
  });

  it('keeps the whole-year panel exactly as it was by default (R751)', () => {
    render(<ComparateurPage />);
    change(screen.getByLabelText(COPY.form.income.label), '42000');
    birth('1985');

    const panel = submit();

    expect(panel.querySelector('h2')?.textContent).toBe(COPY.result.heading(DEFAULT_YEAR));
    expect(panel.querySelector('[data-prorata]')).toBeNull();
    expect(panel.querySelector('[data-start-month]')).toBeNull();
    expect(panel.querySelector('[data-conversion]')?.textContent).toBe(
      COPY.result.swiss.conversion(formatRate(EXCHANGE_RATE.chfPerEurTenThousandths), formatDate(EXCHANGE_RATE.date)),
    );
    expect(panel.querySelectorAll('h2')).toHaveLength(1);
    expect(panel.querySelectorAll('[data-side]')).toHaveLength(2);
    expect(panel.querySelectorAll('[data-side="france"] dd')).toHaveLength(1);
    expect(panel.querySelectorAll('[data-case-sentence]')).toHaveLength(1);
  });
});

describe('R745: the insurers, one dot each', () => {
  it.each([
    ['below every total', '12225', 'all', 'france'],
    ['between', '60000', 'some', 'depends'],
    ['above every total', '1000000', 'none', 'switzerland'],
  ])('draws every insurer and counts them in one sentence, %s', (_case, income, caseName, cheaper) => {
    render(<ComparateurPage />);
    change(screen.getByLabelText(COPY.form.income.label), income);
    birth('1985');

    const panel = submit();
    const value = expected({ incomeEur: Number(income) }).comparison;
    const totals = householdTotals(value, 12).map((total) => total.eur);
    const { above, below, count } = countAgainst(totals, value.french.contributionEur);
    const sentence = COPY.result.chart.sentence(above, below, count);

    // The counting sentence and the case sentence never disagree: all above
    // is "below the lowest", none above is "above the highest".
    expect(value.cheaper).toBe(cheaper);
    expect(panel.querySelector('[data-count-sentence]')?.getAttribute('data-count-sentence')).toBe(caseName);
    if (caseName === 'all') expect(above).toBe(count);
    if (caseName === 'none') expect(below).toBe(count);
    if (caseName === 'some') expect(above > 0 && above < count).toBe(true);

    expect(count).toBe(value.year.premiums.insurers.length);
    expect(panel.querySelectorAll('[data-dot]')).toHaveLength(count);
    expect(panel.querySelector('[data-count-sentence]')?.textContent).toBe(sentence);
    expect(panel.querySelector('[data-chart] h3')?.textContent).toBe(COPY.result.chart.heading(count));

    // FW-CALC-REDESIGN (R1408): TWO pictures carry the one text alternative -
    // the range bar under the panels and the dot chart in its accordion - so a
    // reader who never opens the chart hears exactly what the chart says.
    const pictures = screen.getAllByRole('img');
    const label = COPY.result.chart.label(
      count,
      formatEur(totals[0] ?? 0),
      formatEur(totals[totals.length - 1] ?? 0),
      formatEur(value.french.contributionEur),
      sentence,
    );

    expect(pictures).toHaveLength(2);
    expect(pictures.map((picture) => picture.closest('[data-range], [data-chart]')?.hasAttribute('data-range'))).toEqual([
      true,
      false,
    ]);
    for (const picture of pictures) expect(picture.getAttribute('aria-label')).toBe(label);
  });
});

describe('R746 (S1): a year with a lot of care', () => {
  it('shows the household’s annual cap in CHF and EUR, apart from both sides', () => {
    render(<ComparateurPage />);
    change(screen.getByLabelText(COPY.form.income.label), '42000');
    birth('1985');

    const panel = submit();
    const value = expected({ incomeEur: 42000 }).comparison;
    const cap = careCapCentimes(value.year, value.persons);
    const card = panel.querySelector('[data-care]');

    expect(card?.querySelector('h3')?.textContent).toBe(COPY.result.care.heading);
    expect(card?.textContent).toContain(formatChf(cap));
    expect(card?.textContent).toContain(COPY.result.care.inEuros(formatEur(convertAt(cap, value.rate))));
    expect(card?.textContent).toContain(COPY.result.care.apart);
    expect(card?.closest('[data-side]')).toBeNull();
    // Never added to either side: the sides read compare()'s figures.
    expect(squash(panel.querySelector('[data-side="france"] dd')?.textContent)).toContain(
      squash(formatEur(value.french.contributionEur)),
    );
  });
});

describe('R747: if the franc moves', () => {
  it('moves every euro figure, says it is a hypothesis, tracks nothing, and comes back exactly at 0', () => {
    render(<ComparateurPage />);
    change(screen.getByLabelText(COPY.form.income.label), '42000');
    birth('1985');

    const panel = submit();
    const before = panel.textContent;
    const slider = document.getElementById(FRANC_INPUT_ID);

    if (slider === null) throw new Error('no slider');

    change(slider, '10');

    const moved = expected({ incomeEur: 42000, francShiftPercent: 10 }).comparison;

    expect(moved.rate.chfPerEurTenThousandths).toBe(Math.round(EXCHANGE_RATE.chfPerEurTenThousandths / 1.1));
    expect(panel.querySelector('[data-conversion]')?.textContent).toBe(
      COPY.result.swiss.hypothesis(
        formatRate(moved.rate.chfPerEurTenThousandths),
        formatRate(EXCHANGE_RATE.chfPerEurTenThousandths),
        formatDate(EXCHANGE_RATE.date),
      ),
    );
    expect(squash(panel.querySelector('[data-side="switzerland"] dd')?.textContent)).toContain(
      squash(formatEur(moved.swiss.lowestEur)),
    );
    expect(panel.textContent).toContain(COPY.result.franc.label(COPY.result.franc.stronger(10)));
    expect(seen).toEqual([{ name: 'comparator_calculated' }]);

    change(slider, '0');

    expect(panel.textContent).toBe(before);
  });
});

describe('R748: your deadline', () => {
  it('fills the steps from the event and its date, with "environ" and the warning', () => {
    render(<ComparateurPage />);

    const warning = document.querySelector('[data-deadline-warning]');

    expect(warning?.textContent).toBe(COPY.deadline.warning);

    change(screen.getByLabelText(COPY.deadline.event), '2');
    change(screen.getByLabelText(COPY.deadline.date), '2026-11-30');

    const end = optionPeriodEnd('2026-11-30');

    expect(end).toBeDefined();
    expect(document.querySelector('[data-deadline-end]')?.getAttribute('data-deadline-end')).toBe(end);
    expect(document.querySelector('[data-deadline-end]')?.textContent).toBe(
      COPY.deadline.until(COPY.deadline.longDate(end ?? '')),
    );
    expect(document.querySelector('[data-deadline-helper] ol')?.textContent).toContain(COPY.deadline.startRest(2));
    expect(document.querySelector('[data-deadline-warning]')?.textContent).toBe(COPY.deadline.warning);
  });

  it('lists the banner’s four events, and offers the same four', () => {
    render(<ComparateurPage />);

    const options = [...(document.getElementById(DEADLINE_ID.event)?.querySelectorAll('option') ?? [])];

    expect(options.map((option) => option.textContent)).toEqual([...COPY.deadline.choices]);
    expect(document.querySelectorAll('[data-deadline] ul li')).toHaveLength(COPY.deadline.events.length);
  });
});

describe('R750: zero storage, on every control the page renders', () => {
  it('gives no control a name - in the form, in the result, in the deadline helper', () => {
    const { container } = render(<ComparateurPage />);

    fireEvent.click(screen.getByRole('button', { name: COPY.form.declaration.joint }));
    change(screen.getByLabelText(COPY.form.declaration.personal), '42000');
    fireEvent.click(screen.getByRole('button', { name: COPY.form.affiliation.fromDate }));
    change(screen.getByLabelText(COPY.form.affiliation.start), `${DEFAULT_YEAR}-03-01`);
    birth('1985');
    submit();

    const outside = [...container.querySelectorAll('input, select, textarea, button')].filter(
      (control) => control.closest('form') === null,
    );

    // The slider and the helper's two fields, at least.
    expect(outside.length).toBeGreaterThanOrEqual(3);
    for (const control of container.querySelectorAll('input, select, textarea, button')) {
      expect(control.getAttribute('name'), control.outerHTML.slice(0, 80)).toBeNull();
    }
    expect(container.querySelectorAll('form')).toHaveLength(1);
  });
});

describe('jest-axe (SPEC 16), the new states', () => {
  it('a joint return from a date, with the slider moved and the helper filled', async () => {
    const { container } = render(<ComparateurPage />);

    fireEvent.click(screen.getByRole('button', { name: COPY.form.declaration.joint }));
    change(screen.getByLabelText(COPY.form.declaration.personal), '38000');
    change(screen.getByLabelText(COPY.form.declaration.common), '8000');
    fireEvent.click(screen.getByRole('button', { name: COPY.form.affiliation.fromDate }));
    change(screen.getByLabelText(COPY.form.affiliation.start), `${DEFAULT_YEAR}-03-01`);
    birth('1985');
    submit();

    const slider = document.getElementById(FRANC_INPUT_ID);

    if (slider !== null) change(slider, '-5');
    change(screen.getByLabelText(COPY.deadline.date), '2026-11-30');

    expect(await axe(container)).toHaveNoViolations();
  });
});
