// @vitest-environment jsdom
//
// web/tests/unit/pages/calculateur-result.test.tsx
//
// FW11 increment 4: live computation, and the provisional result FW12
// replaces.
//
// THE ONE TEST THAT MATTERS MOST IN THIS FILE is "Geneva case (c) through the
// form". SPEC 9.3 calls it the E2E gate: "reproduce Geneva case (c) through
// the UI and assert the displayed strings read 39,16 %. This one test proves
// the whole chain - engine, formatter, DOM - agrees with the tax
// administration." The fixture is the truncation case: 12 days of mission room
// but only 10 creditable, so 94/240 = 39.1666..., and the AFC publishes
// 39.16. Rounding would print 39,17 and would not match the filing.
//
// RULING R96 GOVERNS HOW IT IS ASSERTED: "formatted regulatory figures are
// asserted against LITERAL STRINGS BY CODEPOINT, never against a formatter
// call." An assertion reading toContain(formatPercent(39.16, 2)) passes
// against a formatter that has silently changed its precision or its
// separator - which is exactly the defect FW10 found in RateDisplay, where
// 39.16 had been rendering as "39,1 %" for three tasks behind a
// formatter-relative assertion. So the expected string is built from explicit
// codepoints below and compared as text.
//
// U+00A0 IS SPELLED OUT rather than typed. An invisible character in a test
// file is a character nobody can review, and the difference between it and an
// ordinary space is the whole assertion. String.fromCharCode says which one
// is meant.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { RATE_COPY } from '@/lib/fr/rates';
import { errorMessage } from '@/lib/fr/errors';
import { warningEntry } from '@/lib/fr/result';

afterEach(cleanup);

beforeAll(() => {
  // jsdom implements no layout, so scrollIntoView does not exist and calling
  // it throws. The component calls it optionally; this makes the assertion
  // about FOCUS meaningful without pretending the scroll happened.
  Element.prototype.scrollIntoView = function scrollIntoView() {
    return undefined;
  };
});

const FORM = CALCULATEUR_COPY.form;
const RESULT = CALCULATEUR_COPY.result;
const TAX_YEAR = 2026;

const NBSP = String.fromCharCode(0x00a0);

/** Geneva case (c), as the AFC publishes it. Ruling R96: a literal. */
const GENEVA_C_DECLARABLE = `39,16${NBSP}%`;

/** The raw rate for the same case. FW12 increment 2 displays it (AC1). */
const GENEVA_C_RAW = `45,0${NBSP}%`;

const setUp = (taxYear: number = TAX_YEAR) =>
  render(<CalculatorForm taxYear={taxYear} />);

const renderedText = (): string => document.body.textContent ?? '';

const field = (label: string): HTMLInputElement =>
  screen.getByLabelText(label) as HTMLInputElement;
const radio = (name: string): HTMLInputElement =>
  screen.getByRole('radio', { name }) as HTMLInputElement;

const type = (element: HTMLInputElement, value: string) => {
  fireEvent.change(element, { target: { value } });
};

/**
 * Geneva case (c), entered the way a person would.
 *
 * Deliberately through the CONTROLS and not by constructing a TeleworkInput:
 * the point of the gate is that the form's own plumbing - the canton select,
 * the mission reveal, the string-to-number boundary - carries the fixture's
 * numbers to the engine unaltered.
 */
const enterGenevaCaseC = () => {
  fireEvent.change(screen.getByLabelText(FORM.canton.label), { target: { value: 'GE' } });
  type(field(FORM.days.label), '84');
  fireEvent.click(radio(FORM.missions.yes));
  type(field(FORM.missions.france.label), '24');
};

describe('SPEC 9.3 E2E gate: Geneva case (c) through the form', () => {
  it('displays 39,16 % - the string the AFC publishes', () => {
    setUp();
    enterGenevaCaseC();

    expect(renderedText()).toContain(GENEVA_C_DECLARABLE);
  });

  it('does not round to 39,17 %', () => {
    // The truncation rule, stated as the thing that must NOT appear. 94/240
    // is 39.1666..., so a rounding formatter or a rounding engine would print
    // this instead and the filing would not match.
    setUp();
    enterGenevaCaseC();

    expect(renderedText()).not.toContain(`39,17${NBSP}%`);
  });

  it('shows BOTH rates, which is AC1 (FW12 increment 2)', () => {
    // FW11 ASSERTED THE OPPOSITE, deliberately: "shows the declarable rate
    // only - the second rate is FW12", with a note that a failure there would
    // be FW12 arriving early rather than a defect. This is FW12 arriving, so
    // the assertion inverts rather than being deleted - the pair is the record
    // that the scope changed on purpose.
    //
    // SPEC 9.3's two-rate problem: "Showing only the declarable rate hides
    // real exposure; showing only the raw rate contradicts the payslip."
    // 39,16 % is what goes to the AFC; 45,0 % is the share of days actually
    // spent outside Switzerland. Both by codepoint literal (R96).
    setUp();
    enterGenevaCaseC();

    const text = renderedText();

    expect(text).toContain(GENEVA_C_DECLARABLE);
    expect(text).toContain(GENEVA_C_RAW);
  });

  it('labels which rate is which', () => {
    // Two numbers with no labels is worse than one number. The primary names
    // the authority it is declared to; the secondary describes what it
    // measures.
    setUp();
    enterGenevaCaseC();

    const text = renderedText();

    expect(text).toContain(RATE_COPY.declarableCaption);
    expect(text).toContain(RATE_COPY.rawCaption);
  });

  it('explains why they differ (SPEC 9.3)', () => {
    // "when they differ, an explanatory line states that mission days above
    // the cap fall outside the telework regime and are taxed in France." Two
    // figures 6 points apart with no explanation reads as an error in the
    // tool.
    setUp();
    enterGenevaCaseC();

    expect(renderedText()).toContain(RATE_COPY.divergence);
  });

  it('shows no second rate when the two agree', () => {
    // NON-VACUITY, and the property SPEC 9.3 actually states: the secondary
    // figure appears only when it diverges. 72 telework days and no missions
    // gives 30,00 % on both, and a page that repeated it would invite the
    // reader to look for a difference.
    setUp();
    fireEvent.change(screen.getByLabelText(FORM.canton.label), { target: { value: 'GE' } });
    type(field(FORM.days.label), '72');

    const text = renderedText();

    expect(text).toContain(`30,00${NBSP}%`);
    expect(text).not.toContain(RATE_COPY.rawCaption);
    expect(text).not.toContain(RATE_COPY.divergence);
  });

  it('is not an ordinary space before the percent sign', () => {
    // The half of R96 that a normalising assertion cannot make. French
    // typography requires U+00A0 here, and every DOM-normalising matcher in
    // Testing Library and Playwright would accept either.
    setUp();
    enterGenevaCaseC();

    expect(renderedText()).not.toContain('39,16 %');
  });
});

describe('the result is live, with no button pressed', () => {
  it('appears as the fields are filled', () => {
    // Standing protocol 7 and SPEC 9.3: recompute on every input event, no
    // debounce, because the engine runs in well under a millisecond and a
    // debounce would add nothing but perceived lag. No click anywhere in
    // enterGenevaCaseC.
    setUp();
    enterGenevaCaseC();

    expect(renderedText()).toContain(GENEVA_C_DECLARABLE);
  });

  it('updates again when a number changes', () => {
    setUp();
    enterGenevaCaseC();
    type(field(FORM.days.label), '0');

    expect(renderedText()).not.toContain(GENEVA_C_DECLARABLE);
  });

  it('shows nothing before a canton is chosen', () => {
    setUp();
    type(field(FORM.days.label), '84');

    expect(renderedText()).toContain(RESULT.empty);
  });
});

describe('the Calculer button (FD1)', () => {
  it('exists, because a form with numbers in it looks unfinished without one', () => {
    setUp();

    expect(screen.getByRole('button', { name: RESULT.calculate })).toBeDefined();
  });

  it('moves focus to the result region rather than computing anything', () => {
    setUp();
    enterGenevaCaseC();
    fireEvent.click(screen.getByRole('button', { name: RESULT.calculate }));

    const region = document.getElementById('resultat');

    expect(region).not.toBeNull();
    expect(document.activeElement).toBe(region);
  });

  it('IS a submit since R351, because the form now has somewhere to go', () => {
    // THIS TEST ASSERTED THE OPPOSITE UNTIL R351, and the reasoning it
    // carried was sound for the page it was written on: "does not submit, so
    // a stray Enter cannot reload the page". A submit that reloaded this
    // route would have thrown away everything typed, because the island
    // reads the URL only on mount and there was no server-rendered answer to
    // land on.
    //
    // There is one now. The form posts by GET to the result page, so the
    // reload a no-JS reader gets IS their answer - and the next test is what
    // keeps the old worry from coming true for everybody else.
    setUp();

    expect(screen.getByRole('button', { name: RESULT.calculate }).getAttribute('type')).toBe(
      'submit',
    );
  });

  it('and the island cancels it, so a scripted reader never leaves the page', () => {
    // THE HALF THAT CANNOT BE READ OFF THE MARKUP. A submit button plus an
    // action is a navigation unless something stops it, and "something stops
    // it" is the claim - so the event is dispatched and its cancellation
    // asserted, rather than the handler being inspected for existence.
    setUp();

    const form = document.querySelector('form');

    expect(form).not.toBeNull();

    const submitted = new Event('submit', { bubbles: true, cancelable: true });
    const wentThrough = form?.dispatchEvent(submitted);

    // dispatchEvent returns false exactly when preventDefault was called.
    expect(wentThrough).toBe(false);
    expect(submitted.defaultPrevented).toBe(true);
  });
});

describe('the region announces itself', () => {
  it('is polite, so a rate changing on every keystroke does not interrupt', () => {
    setUp();

    const region = document.getElementById('resultat');

    expect(region?.getAttribute('aria-live')).toBe('polite');
  });

  it('is focusable, which is what makes the button able to move focus there', () => {
    setUp();

    expect(document.getElementById('resultat')?.getAttribute('tabindex')).toBe('-1');
  });
});

describe('while the input is invalid', () => {
  it('replaces the number with a note instead of leaving it standing', () => {
    // THE POINT OF THIS BLOCK. A rate left on screen next to a field the user
    // has just broken reads as the answer to the numbers now in the form. It
    // is not - it is the answer to the previous ones. So the region says so.
    setUp();
    enterGenevaCaseC();

    expect(renderedText()).toContain(GENEVA_C_DECLARABLE);

    type(field(FORM.rate.label), '0');

    expect(renderedText()).not.toContain(GENEVA_C_DECLARABLE);
    expect(renderedText()).toContain(RESULT.stale);
  });

  it('still shows the field error, so the user knows what to fix', () => {
    setUp();
    enterGenevaCaseC();
    type(field(FORM.rate.label), '0');

    expect(renderedText()).toContain(errorMessage({ code: 'RATE_OUT_OF_RANGE' }));
  });

  it('brings the rate back when the input is repaired', () => {
    setUp();
    enterGenevaCaseC();
    type(field(FORM.rate.label), '0');
    type(field(FORM.rate.label), '100');

    expect(renderedText()).toContain(GENEVA_C_DECLARABLE);
    expect(renderedText()).not.toContain(RESULT.stale);
  });
});

describe('ruling R55: the rule-set fallback banner', () => {
  // WHERE THIS BANNER LIVES CHANGED IN FW12 INCREMENT 4, and these two tests
  // moved with it rather than being deleted.
  //
  // It used to be a block of the island's own, above the result card, because
  // its sentence names two years and the panel's warning copy was static
  // strings. warningEntry now takes the warning, so RULE_SET_FALLBACK is an
  // ordinary member of the panel's warning list - first in it, because it
  // qualifies every figure below.
  //
  // What these two keep asserting is the part the panel's own test cannot:
  // that the banner appears THROUGH THE FORM, from a taxYear prop, with the
  // engine emitting the warning rather than a test substituting one.
  const FALLBACK = warningEntry({
    code: 'RULE_SET_FALLBACK',
    requestedYear: 2099,
    appliedYear: 2026,
  });

  it('is silent for a year that has its own rules', () => {
    // R55: "expected to be silent while 2026 is the only rule set." Asserted
    // so that the banner appearing one day is a visible change rather than a
    // surprise.
    setUp();
    enterGenevaCaseC();

    expect(renderedText()).not.toContain(FALLBACK.heading);
  });

  it('says which year was asked for and which was applied', () => {
    // R11: ruleSetFor falls back to the latest known set for an unknown year,
    // and "the substitution must reach the user rather than being implied by
    // a taxYear a caller has to think to compare". A calculation quietly
    // performed under last year's rules is the kind of wrong that looks
    // right.
    setUp(2099);
    enterGenevaCaseC();

    expect(renderedText()).toContain(FALLBACK.heading);
    expect(renderedText()).toContain(FALLBACK.body);
    expect(renderedText()).toContain('2099');
  });

  it('appears inside the panel’s warning list, not beside it', () => {
    // The move itself, asserted. Two banners for one warning - the island's
    // and the panel's - is the failure mode of this kind of change, and it
    // renders as a page that says the same thing twice in two visual
    // languages.
    setUp(2099);
    enterGenevaCaseC();

    const banners = document.querySelectorAll('[data-warning="RULE_SET_FALLBACK"]');
    const occurrences = renderedText().split(FALLBACK.heading).length - 1;

    expect(banners).toHaveLength(1);
    expect(occurrences).toBe(1);
  });
});
