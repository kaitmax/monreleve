// @vitest-environment jsdom
//
// web/tests/unit/pages/calculateur-accordion.test.tsx
//
// FW11 increment 3: the mission question, and the advanced options behind a
// disclosure.
//
// WHY THE MISSION QUESTION IS NOT IN THE ACCORDION, in SPEC 9.3's own words:
// "Mission days materially change the result, and a user with missions who
// never opens the accordion gets a silently wrong answer." So one visible
// line, two radios, and "Non" costs a user without missions one line of
// reading. It is the single exception to burying things, and the tests below
// assert the exception rather than the convenience.
//
// HOW periodFraction IS OBSERVED WITHOUT A RESULT PANEL. Increment 3 has no
// result to read - that is increment 4 - so a start date cannot be checked by
// looking at a rendered rate. It can be checked by its CONSEQUENCE: under the
// simplified basis the annual total is ceil(basis x rate x fraction), so a
// day count that fits a full year stops fitting a half one, and the engine
// says DAYS_EXCEED_TOTAL. That assertion goes through the engine, the
// conversion and the form together, which is more than a state read would
// prove.
//
// THE THRESHOLD IS NEVER A LITERAL HERE EITHER (R73). The mission helper
// names the fiscal ceiling and the method helper names the simplified basis;
// both arrive formatted from the RuleSet, so these tests compute the expected
// string the same way the copy does rather than typing "40 %".

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import { ruleSetFor } from '@/lib/calc-engine';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { errorMessage } from '@/lib/fr/errors';
import { PROVISIONAL_COPY } from '@/lib/fr/provisional';
import { formatDays, formatPercent } from '@/lib/ui/core';
import { complianceClaims } from '@/tests/support/vocabulary';

afterEach(cleanup);

const FORM = CALCULATEUR_COPY.form;
const TAX_YEAR = 2026;
const RULES = ruleSetFor(TAX_YEAR);

const setUp = () => render(<CalculatorForm taxYear={TAX_YEAR} />);

/** Rendered text with U+00A0 intact - see the note in calculateur-form. */
const renderedText = (): string => document.body.textContent ?? '';

const radio = (name: string): HTMLInputElement =>
  screen.getByRole('radio', { name }) as HTMLInputElement;
const field = (label: string): HTMLInputElement =>
  screen.getByLabelText(label) as HTMLInputElement;
const missing = (label: string) => screen.queryByLabelText(label);

const type = (element: HTMLInputElement, value: string) => {
  fireEvent.change(element, { target: { value } });
};

const chooseCanton = () => {
  fireEvent.change(screen.getByLabelText(FORM.canton.label), { target: { value: 'GE' } });
};

const openAdvanced = () => {
  fireEvent.click(screen.getByRole('button', { name: FORM.advanced.summary }));
};

describe('the mission question, always visible (SPEC 9.3)', () => {
  it('asks before the accordion, not inside it', () => {
    setUp();

    expect(renderedText()).toContain(FORM.missions.question);
  });

  it('offers Non and Oui, with Non chosen', () => {
    setUp();

    expect(radio(FORM.missions.no).checked).toBe(true);
    expect(radio(FORM.missions.yes).checked).toBe(false);
  });

  it('names the fiscal ceiling from the RuleSet, not from a literal', () => {
    setUp();

    const ceiling = formatPercent(RULES.fiscalCeiling * 100, 0);

    expect(renderedText()).toContain(FORM.missions.helper(ceiling));
  });

  it('hides the two mission fields until the answer is Oui', () => {
    setUp();

    expect(missing(FORM.missions.france.label)).toBeNull();
    expect(missing(FORM.missions.thirdState.label)).toBeNull();
  });

  it('reveals them on Oui', () => {
    setUp();
    fireEvent.click(radio(FORM.missions.yes));

    expect(field(FORM.missions.france.label).value).toBe('0');
    expect(field(FORM.missions.thirdState.label).value).toBe('0');
  });

  it('gives both mission fields the same decimal text input (R109)', () => {
    setUp();
    fireEvent.click(radio(FORM.missions.yes));

    for (const label of [FORM.missions.france.label, FORM.missions.thirdState.label]) {
      expect(field(label).getAttribute('type'), label).toBe('text');
      expect(field(label).getAttribute('inputMode'), label).toBe('decimal');
    }
  });

  it('carries ruling R13 in the mission helper (AC2)', () => {
    setUp();
    fireEvent.click(radio(FORM.missions.yes));

    expect(renderedText()).toContain(FORM.missions.fieldHelper);
  });

  it('mentions the guide as text and not as a link, because it does not exist yet', () => {
    // Ruling R85's principle: a link renders only when its target is live.
    // SPEC 9.5's guide is FW17, so naming it is right and linking to it would
    // be a 404 promised in a helper.
    setUp();
    fireEvent.click(radio(FORM.missions.yes));

    expect(screen.queryByRole('link', { name: /guide/i })).toBeNull();
  });
});

describe('answering Non again clears what was entered', () => {
  it('resets both mission counts to zero', () => {
    // THE ASSERTION THAT MATTERS MOST IN THIS BLOCK. Hiding a field without
    // clearing it leaves the value in the calculation, so a user who answers
    // Oui, types 12, thinks better of it and answers Non would get a result
    // computed from 12 mission days they can no longer see. That is the
    // "silently wrong answer" SPEC 9.3 makes the question visible to avoid,
    // reintroduced by the reveal mechanism itself.
    setUp();
    fireEvent.click(radio(FORM.missions.yes));
    type(field(FORM.missions.france.label), '12');
    type(field(FORM.missions.thirdState.label), '3');

    fireEvent.click(radio(FORM.missions.no));
    fireEvent.click(radio(FORM.missions.yes));

    expect(field(FORM.missions.france.label).value).toBe('0');
    expect(field(FORM.missions.thirdState.label).value).toBe('0');
  });

  it('and the cleared days are really out of the calculation', () => {
    // The visible half of the same fact, asserted through the engine: 200
    // telework days plus 60 mission days passes the 240-day basis, and 200
    // alone does not. If Non only hid the fields, this error would persist.
    setUp();
    chooseCanton();
    fireEvent.click(radio(FORM.missions.yes));
    type(field(FORM.days.label), '200');
    type(field(FORM.missions.france.label), '60');

    expect(renderedText()).toContain(errorMessage({ code: 'DAYS_EXCEED_TOTAL' }));

    fireEvent.click(radio(FORM.missions.no));

    expect(renderedText()).not.toContain(errorMessage({ code: 'DAYS_EXCEED_TOTAL' }));
  });

  it('reports a negative mission count against its own field', () => {
    setUp();
    chooseCanton();
    fireEvent.click(radio(FORM.missions.yes));
    type(field(FORM.missions.france.label), '-2');

    expect(renderedText()).toContain(
      errorMessage({ code: 'NEGATIVE_DAYS', field: 'missionDaysFrance' }),
    );
    expect(field(FORM.missions.france.label).getAttribute('aria-invalid')).toBe('true');
  });
});

describe('the advanced disclosure', () => {
  it('starts collapsed, and says so', () => {
    setUp();

    const button = screen.getByRole('button', { name: FORM.advanced.summary });

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(missing(FORM.method.label)).toBeNull();
    expect(missing(FORM.decompte.label)).toBeNull();
    expect(missing(FORM.start.label)).toBeNull();
  });

  it('opens on click and reveals all three controls', () => {
    setUp();
    openAdvanced();

    const button = screen.getByRole('button', { name: FORM.advanced.summary });

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('radio', { name: FORM.method.simplified })).toBeDefined();
    expect(screen.getByRole('radio', { name: FORM.decompte.day })).toBeDefined();
    expect(field(FORM.start.label)).toBeDefined();
  });

  it('closes again', () => {
    setUp();
    openAdvanced();
    openAdvanced();

    expect(
      screen.getByRole('button', { name: FORM.advanced.summary }).getAttribute('aria-expanded'),
    ).toBe('false');
  });
});

describe('methode de calcul', () => {
  it('defaults to the simplified basis', () => {
    setUp();
    openAdvanced();

    expect(radio(FORM.method.simplified).checked).toBe(true);
    expect(radio(FORM.method.exact).checked).toBe(false);
  });

  it('carries SPEC 9.3 verbatim, with the basis from the RuleSet', () => {
    setUp();
    openAdvanced();

    const basis = formatDays(RULES.simplifiedBasisDays);

    expect(renderedText()).toContain(FORM.method.helper(basis));
  });

  it('shows the total field only for the exact method', () => {
    setUp();
    openAdvanced();

    expect(missing(FORM.method.totalLabel)).toBeNull();

    fireEvent.click(radio(FORM.method.exact));

    expect(field(FORM.method.totalLabel)).toBeDefined();

    fireEvent.click(radio(FORM.method.simplified));

    expect(missing(FORM.method.totalLabel)).toBeNull();
  });

  it('reports a non-positive total against the total field', () => {
    setUp();
    chooseCanton();
    openAdvanced();
    fireEvent.click(radio(FORM.method.exact));
    type(field(FORM.method.totalLabel), '0');

    expect(renderedText()).toContain(errorMessage({ code: 'TOTAL_WORK_DAYS_NOT_POSITIVE' }));
    expect(field(FORM.method.totalLabel).getAttribute('aria-invalid')).toBe('true');
  });
});

describe('decompte', () => {
  it('defaults to half-days, which is what step 0.5 requires', () => {
    setUp();
    openAdvanced();

    expect(radio(FORM.decompte.halfDay).checked).toBe(true);
  });

  it('makes a half day an error once whole days are chosen', () => {
    // The interpretation from increment 2, seen from the other side: the
    // public default is halfDay, and 'day' is still reachable here - where
    // choosing it correctly rejects 0,5.
    setUp();
    chooseCanton();
    type(field(FORM.days.label), '0.5');
    openAdvanced();
    fireEvent.click(radio(FORM.decompte.day));

    expect(renderedText()).toContain(
      errorMessage({ code: 'GRANULARITY_MISMATCH', field: 'teleworkDays' }),
    );
  });

  it('accepts any count under hours, which are pre-converted', () => {
    setUp();
    chooseCanton();
    type(field(FORM.days.label), '0.25');
    openAdvanced();
    fireEvent.click(radio(FORM.decompte.hours));

    expect(renderedText()).not.toContain(
      errorMessage({ code: 'GRANULARITY_MISMATCH', field: 'teleworkDays' }),
    );
  });
});

describe("debut d'activite becomes periodFraction", () => {
  it('is a date input, so the value is an ISO day (R28)', () => {
    setUp();
    openAdvanced();

    expect(field(FORM.start.label).getAttribute('type')).toBe('date');
  });

  it('shortens the annual basis, which the engine then enforces', () => {
    // 130 telework days fit a full year on the 240-day basis and do not fit
    // from 1 July: ceil(240 x 184/365) is 121. The error appearing is the
    // proof that the date reached the engine as a fraction.
    setUp();
    chooseCanton();
    type(field(FORM.days.label), '130');

    expect(renderedText()).not.toContain(errorMessage({ code: 'DAYS_EXCEED_TOTAL' }));

    openAdvanced();
    type(field(FORM.start.label), '2026-07-01');

    expect(renderedText()).toContain(errorMessage({ code: 'DAYS_EXCEED_TOTAL' }));
  });

  it('is the whole year again when cleared', () => {
    setUp();
    chooseCanton();
    type(field(FORM.days.label), '130');
    openAdvanced();
    type(field(FORM.start.label), '2026-07-01');
    type(field(FORM.start.label), '');

    expect(renderedText()).not.toContain(errorMessage({ code: 'DAYS_EXCEED_TOTAL' }));
  });

  it('reports a date in a later year through the engine, on the date field', () => {
    // remainingYearFraction returns 0 for a year not yet begun, which is
    // outside SPEC 7.4's range, so the engine supplies the message. The form
    // holds no second opinion about what a valid period is.
    setUp();
    chooseCanton();
    openAdvanced();
    type(field(FORM.start.label), '2027-03-01');

    expect(renderedText()).toContain(errorMessage({ code: 'PERIOD_OUT_OF_RANGE' }));
    expect(field(FORM.start.label).getAttribute('aria-invalid')).toBe('true');
  });

  it('does not fall over on a half-typed date', () => {
    // A date input can hand over an empty string mid-edit, and an ISO parse
    // of '' throws a RangeError by design (R28). Reaching the engine with
    // that exception would take the whole island down, so the boundary
    // treats an unparseable value as no date at all.
    setUp();
    chooseCanton();
    openAdvanced();

    expect(() => type(field(FORM.start.label), '2026-0')).not.toThrow();
    expect(renderedText()).not.toContain(errorMessage({ code: 'PERIOD_OUT_OF_RANGE' }));
  });
});

describe('an error whose field is hidden still reaches the user', () => {
  it('survives the accordion closing over it', () => {
    // THE HOLE THIS CLOSES, and it is the first thing that happens if errors
    // are routed by code alone. A start date in a later year is reported by
    // the engine against the date field - which lives inside the disclosure.
    // Collapse it and the message has nowhere to render, so it vanishes while
    // the form stays un-calculable and says nothing about why.
    //
    // The form-level list is where those go. That list is not decoration: it
    // is the reason a validation error cannot be lost by hiding its control.
    setUp();
    chooseCanton();
    openAdvanced();
    type(field(FORM.start.label), '2027-03-01');

    expect(renderedText()).toContain(errorMessage({ code: 'PERIOD_OUT_OF_RANGE' }));

    openAdvanced();

    expect(screen.queryByLabelText(FORM.start.label)).toBeNull();
    expect(renderedText()).toContain(FORM.otherErrorsLabel);
    expect(renderedText()).toContain(errorMessage({ code: 'PERIOD_OUT_OF_RANGE' }));
  });

  it('shows nothing of the kind when there is no error', () => {
    // Non-vacuity for the block above: the label must be ABSENT normally, or
    // the assertion that it appears would prove nothing.
    setUp();
    chooseCanton();

    expect(renderedText()).not.toContain(FORM.otherErrorsLabel);
  });
});

describe('a derived error is not reported as a second mistake', () => {
  // FOUND IN A BASELINE, not by a test. Increment 5's error-state screenshot
  // showed the rate field correctly marked with "Le taux d'activité doit être
  // compris entre 1 et 100" AND, in the form-level list below it, "Le nombre
  // de jours travaillés dans la période doit être supérieur à zéro". Two
  // messages, one mistake.
  //
  // WHY THE ENGINE SENDS BOTH, correctly: validate.ts resolves the
  // denominator from the rate it was given, so a rate of 0 makes
  // ceil(basis x 0 x period) = 0 and TOTAL_WORK_DAYS_NOT_POSITIVE is true.
  // The engine is reporting what it found; deciding which of two true
  // statements a person should read is the form's job.
  //
  // AND UNDER THE SIMPLIFIED BASIS IT IS ALWAYS DERIVED. With a rate of at
  // least 1 and a period above 0 the total is ceil of a positive number, so it
  // is at least 1 - the error cannot arise on its own. Under the exact method
  // it can and does, because the user supplies the number.

  it('hides the derived total error when the rate is what is wrong', () => {
    setUp();
    chooseCanton();
    type(field(FORM.rate.label), '0');

    expect(renderedText()).toContain(errorMessage({ code: 'RATE_OUT_OF_RANGE' }));
    expect(renderedText()).not.toContain(
      errorMessage({ code: 'TOTAL_WORK_DAYS_NOT_POSITIVE' }),
    );
    expect(renderedText()).not.toContain(FORM.otherErrorsLabel);
  });

  it('hides it when the start date is what is wrong', () => {
    // The other derived route: a period of 0 makes the total 0 too.
    setUp();
    chooseCanton();
    openAdvanced();
    type(field(FORM.start.label), '2027-03-01');

    expect(renderedText()).toContain(errorMessage({ code: 'PERIOD_OUT_OF_RANGE' }));
    expect(renderedText()).not.toContain(
      errorMessage({ code: 'TOTAL_WORK_DAYS_NOT_POSITIVE' }),
    );
  });

  it('still shows it under the exact method, where the user typed it', () => {
    // Non-vacuity, and the reason the suppression is scoped rather than
    // blanket: here the number IS the user's, nothing else explains it, and
    // suppressing it would leave a form that refuses to calculate in silence.
    setUp();
    chooseCanton();
    openAdvanced();
    fireEvent.click(radio(FORM.method.exact));
    type(field(FORM.method.totalLabel), '0');

    expect(renderedText()).toContain(errorMessage({ code: 'TOTAL_WORK_DAYS_NOT_POSITIVE' }));
    expect(field(FORM.method.totalLabel).getAttribute('aria-invalid')).toBe('true');
  });
});

describe('ruling R110: the provisional notice, through the form', () => {
  // The trigger logic has its own tests in tests/unit/content/provisional.
  // These assert the other half: that the form actually reaches those states
  // and renders the copy, and that the reference case does NOT.

  it('is absent on Geneva case (c), the reference calculation', () => {
    // 24 mission days in France and none in a third state. The imputation
    // order cannot matter with one place to impute from, so the product's own
    // verified fixture must show no caveat.
    setUp();
    chooseCanton();
    type(field(FORM.days.label), '84');
    fireEvent.click(radio(FORM.missions.yes));
    type(field(FORM.missions.france.label), '24');

    expect(renderedText()).not.toContain(PROVISIONAL_COPY.lead);
  });

  it('appears with P1 named once missions exist in both places', () => {
    setUp();
    chooseCanton();
    fireEvent.click(radio(FORM.missions.yes));
    type(field(FORM.missions.france.label), '6');
    type(field(FORM.missions.thirdState.label), '4');

    expect(renderedText()).toContain(PROVISIONAL_COPY.lead);
    expect(renderedText()).toContain(PROVISIONAL_COPY.items.P1.interpretation);
    expect(renderedText()).toContain(PROVISIONAL_COPY.items.P1.body);
  });

  it('appears with P3 named for the exact method at part time', () => {
    setUp();
    chooseCanton();
    type(field(FORM.rate.label), '80');
    openAdvanced();
    fireEvent.click(radio(FORM.method.exact));

    expect(renderedText()).toContain(PROVISIONAL_COPY.items.P3.interpretation);
    expect(renderedText()).toContain(PROVISIONAL_COPY.items.P3.body);
  });

  it('says review is pending, which is the point of naming it', () => {
    setUp();
    chooseCanton();
    fireEvent.click(radio(FORM.missions.yes));
    type(field(FORM.missions.france.label), '6');
    type(field(FORM.missions.thirdState.label), '4');

    expect(renderedText()).toContain(PROVISIONAL_COPY.pending);
  });

  it('goes away again when the input stops touching it', () => {
    setUp();
    chooseCanton();
    fireEvent.click(radio(FORM.missions.yes));
    type(field(FORM.missions.france.label), '6');
    type(field(FORM.missions.thirdState.label), '4');

    expect(renderedText()).toContain(PROVISIONAL_COPY.lead);

    type(field(FORM.missions.thirdState.label), '0');

    expect(renderedText()).not.toContain(PROVISIONAL_COPY.lead);
  });

  it('claims nothing about compliance (SPEC 20)', () => {
    // The copy most likely to reach for a forbidden word - it is about a
    // reading of a rule - so the vocabulary guard is pointed at it directly.
    expect(complianceClaims(PROVISIONAL_COPY.lead)).toEqual([]);
    expect(complianceClaims(PROVISIONAL_COPY.pending)).toEqual([]);
    for (const item of Object.values(PROVISIONAL_COPY.items)) {
      expect(complianceClaims(item.interpretation), item.interpretation).toEqual([]);
      expect(complianceClaims(item.body), item.interpretation).toEqual([]);
    }
  });
});
