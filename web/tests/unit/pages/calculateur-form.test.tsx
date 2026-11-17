// @vitest-environment jsdom
//
// web/tests/unit/pages/calculateur-form.test.tsx
//
// FW11 increment 2: the three visible fields.
//
// SPEC 9.3 sets the shape and the reason for it: "The engine needs seven
// inputs; asking a stranger seven questions is how a calculator gets
// abandoned." Three fields visible, the rest disclosed with sane defaults -
// and under the simplified 240-day basis paid leave and sick days are not
// asked AT ALL, because the 240 already absorbs them.
//
// WHAT IS ASSERTED THROUGH BEHAVIOUR RATHER THAN STRUCTURE. The default
// granularity is the clearest case. The prompt sets step 0.5 on the visible
// day field and the engine rejects a half-day value declared under 'day' with
// GRANULARITY_MISMATCH, so the two cannot both be true - the public form's
// default has to be 'halfDay'. Rather than reach into state and read the
// field, these tests type a half day and expect no error, then a quarter day
// and expect one. That holds whatever the implementation looks like.
//
// VALIDATION RUNS THROUGH calculateTelework, not through validateInput, which
// the engine does not export. Exporting it would be a change to the engine's
// public API and SPEC 20 makes that an ask-first item, so the island builds a
// TeleworkInput and reads the error branch of the Result. One consequence is
// visible here and recorded as an interpretation: a TeleworkInput cannot be
// built without a canton, so no field is validated until one is chosen.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import type { Canton } from '@/lib/calc-engine';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { CANTONS_BY_NAME, CANTON_NAMES } from '@/lib/fr/cantons';
import { errorMessage } from '@/lib/fr/errors';

// PLAIN DOM ASSERTIONS, NOT jest-dom. @testing-library/jest-dom is a
// devDependency here but no setup file has ever registered it, so
// toBeInTheDocument and friends are not in scope - tsc says so before any
// test runs. Adding a global setup file to import them would change the
// config for all 74 test files to save a few characters in one, so this
// follows the convention every other test in the repo already uses.
//
// RULING R109 MADE THESE TEXT INPUTS, so value - the string the control
// holds - is the only reader, and it is also the right one: R109 requires the
// field to SHOW WHAT WAS TYPED, comma and all. valueAsNumber returns NaN on a
// text input, which would have made every one of these assertions vacuous
// rather than red, so they are converted rather than left to rot.

afterEach(cleanup);

const FORM = CALCULATEUR_COPY.form;
const TAX_YEAR = 2026;

const setUp = () => render(<CalculatorForm taxYear={TAX_YEAR} />);

const cantonSelect = (): HTMLSelectElement =>
  screen.getByLabelText(FORM.canton.label) as HTMLSelectElement;
const rateInput = (): HTMLInputElement =>
  screen.getByLabelText(FORM.rate.label) as HTMLInputElement;
const daysInput = (): HTMLInputElement =>
  screen.getByLabelText(FORM.days.label) as HTMLInputElement;

/** Choose Geneva. Any canton would do; validation does not read it. */
const chooseCanton = (code: Canton = 'GE') => {
  fireEvent.change(cantonSelect(), { target: { value: code } });
};

const type = (field: HTMLInputElement, value: string) => {
  fireEvent.change(field, { target: { value } });
};

/**
 * The rendered text with its codepoints intact.
 *
 * NOT getByText, AND THIS COST TWO RED TESTS TO REMEMBER. Ruling R66: Testing
 * Library normalises U+00A0 to an ordinary space ON THE DOM SIDE ONLY, so a
 * matcher carrying a no-break space matches nothing. Two of lib/fr's error
 * messages end in "<U+00A0>:" - NEGATIVE_DAYS and GRANULARITY_MISMATCH - and
 * their assertions failed against a form that was rendering them perfectly,
 * printing two strings that looked identical.
 *
 * The two messages with no no-break space passed. That is the trap: converting
 * only the failures would leave four assertions that work by accident and
 * break the day somebody puts a colon in that copy. textContent preserves
 * U+00A0 on both sides, so every message assertion below reads through here.
 */
const renderedText = (): string => document.body.textContent ?? '';

describe('field 1: the canton', () => {
  it('offers all 26 cantons, named in French, ordered by name', () => {
    // ONE PASS OVER THE OPTIONS, and the first version of this was 26
    // separate getByRole({ name }) calls. That takes 5.7 SECONDS: a name
    // query computes the accessible name of every candidate element, so 26
    // lookups across 27 options is quadratic. It passed the ordinary run at
    // just under the 5 s timeout and FAILED under the worker cap, where the
    // clean-tree run then blamed a missing path (ruling R94) for what was
    // actually a slow test.
    //
    // Reading the options once is both faster and a stronger claim: this
    // asserts the exact list AND its order, where the loop asserted only
    // that each name existed somewhere.
    const { container } = setUp();
    const options = [...container.querySelectorAll('option')];

    // The placeholder leads, and is not one of the 26.
    expect(options[0]?.value).toBe('');

    const offered = options.slice(1).map((option) => [option.value, option.textContent]);

    expect(offered).toHaveLength(26);
    expect(offered).toEqual(CANTONS_BY_NAME.map(([code, name]) => [code, name]));
  });

  it('sorts by the French name, not by the code or the codepoint', () => {
    // The property the collator buys, asserted where it can actually break.
    // By CODE the first three are AG, AI, AR - Argovie, Appenzell, Appenzell -
    // which reads as shuffled. By CODEPOINT every accented name lands after
    // Zurich, so Bale would follow Zoug. Neither mistake is visible in the
    // list assertion above, which compares against the same sorted constant.
    const names = CANTONS_BY_NAME.map(([, name]) => name);
    const bale = names.indexOf(CANTON_NAMES.BL);

    expect(names.indexOf(CANTON_NAMES.AG)).toBeLessThan(bale);
    expect(bale).toBeLessThan(names.indexOf(CANTON_NAMES.BE));
    expect(bale).toBeLessThan(names.indexOf(CANTON_NAMES.ZG));
  });

  it('starts on the placeholder, because no canton is a sane default', () => {
    setUp();

    expect(cantonSelect().value).toBe('');
    expect(screen.queryByRole('option', { name: FORM.canton.placeholder })).not.toBeNull();
  });

  it('holds the canton once chosen', () => {
    setUp();
    chooseCanton('VD');

    expect(cantonSelect().value).toBe('VD');
  });

  it('is wired to its helper by FieldGroup', () => {
    setUp();

    // Followed through the id rather than looked up by text. This proves the
    // two things that matter together - the helper exists AND the control
    // points at it - where a text query proves only the first and would pass
    // against a helper no screen reader ever reaches.
    const described = cantonSelect().getAttribute('aria-describedby');

    expect(described).toBeTruthy();

    const helper = document.getElementById(described ?? '');

    expect(helper?.textContent).toBe(FORM.canton.helper);
  });
});

describe('field 2: the employment rate', () => {
  it('defaults to 100, a full-time contract', () => {
    setUp();

    expect(rateInput().value).toBe('100');
  });

  it('is a text input in decimal mode, not a number input (R109)', () => {
    // R109: type="number" DISCARDS the comma a French user types - the value
    // arrives as the empty string and the digits appear to vanish as they are
    // entered. inputMode="decimal" keeps the numeric keypad on a phone
    // without handing the browser the right to reject the separator.
    setUp();

    expect(rateInput().getAttribute('type')).toBe('text');
    expect(rateInput().getAttribute('inputMode')).toBe('decimal');
  });

  it('does not carry step, min or max, which a text input ignores', () => {
    // Asserted as an ABSENCE on purpose. Those three attributes are inert on
    // a text input, so leaving them would read as a bound the browser was
    // enforcing when nothing is. The bounds live in the stepper's clamp and
    // in the engine's RATE_OUT_OF_RANGE, both of which are tested.
    setUp();

    for (const attribute of ['step', 'min', 'max']) {
      expect(rateInput().hasAttribute(attribute), attribute).toBe(false);
    }
  });

  it('takes a typed value', () => {
    setUp();
    type(rateInput(), '80');

    expect(rateInput().value).toBe('80');
  });
});

describe('field 3: telework days already taken', () => {
  it('defaults to 0', () => {
    setUp();

    expect(daysInput().value).toBe('0');
  });

  it('is also a text input in decimal mode (R109)', () => {
    setUp();

    expect(daysInput().getAttribute('type')).toBe('text');
    expect(daysInput().getAttribute('inputMode')).toBe('decimal');
  });

  it('does not ask for leave or sick days at all (SPEC 9.3)', () => {
    setUp();

    // The 240-day basis absorbs them. Asserted as an absence because it is a
    // deliberate omission that a well-meaning later change would undo.
    for (const forbidden of [/cong/i, /maladie/i, /vacances/i]) {
      expect(screen.queryByLabelText(forbidden)).toBeNull();
    }
  });
});

describe('the steppers', () => {
  it('adds and subtracts one step on the rate', () => {
    setUp();
    fireEvent.click(screen.getByRole('button', { name: FORM.rate.decrease }));

    expect(rateInput().value).toBe('95');

    fireEvent.click(screen.getByRole('button', { name: FORM.rate.increase }));

    expect(rateInput().value).toBe('100');
  });

  it('will not step the rate above its maximum', () => {
    setUp();
    fireEvent.click(screen.getByRole('button', { name: FORM.rate.increase }));

    expect(rateInput().value).toBe('100');
  });

  it('clamps to the minimum rather than stepping past it', () => {
    setUp();
    type(rateInput(), '3');
    fireEvent.click(screen.getByRole('button', { name: FORM.rate.decrease }));

    // 3 - 5 would be -2, which is not a rate. The minimum is 1, not 0: a
    // contract at nothing per cent is not a contract.
    expect(rateInput().value).toBe('1');
  });

  it('steps the day field by the half-day', () => {
    setUp();
    fireEvent.click(screen.getByRole('button', { name: FORM.days.increase }));

    expect(daysInput().value).toBe('0.5');
  });

  it('will not step the day field below zero', () => {
    setUp();
    fireEvent.click(screen.getByRole('button', { name: FORM.days.decrease }));

    expect(daysInput().value).toBe('0');
  });

  it('uses buttons, so neither one submits the form', () => {
    setUp();

    for (const name of [
      FORM.rate.increase,
      FORM.rate.decrease,
      FORM.days.increase,
      FORM.days.decrease,
    ]) {
      expect(screen.getByRole('button', { name }).getAttribute('type'), name).toBe('button');
    }
  });

  it('is sized from the touch-target token, not a hand-typed value', () => {
    // jsdom applies no stylesheet, so the rendered box cannot be measured
    // here - increment 5's baselines do that. What IS checkable is that the
    // size comes from the token rather than a literal, which is the rule this
    // repo actually enforces.
    const scss = readFileSync(
      join(
        process.cwd(),
        'app/(public)/calculateur-teletravail-frontalier/CalculatorForm.module.scss',
      ),
      'utf8',
    );

    expect(scss).toContain('--size-touch-target-web');
  });
});

describe('validation, once the input can be built', () => {
  it('shows the engine rate error in French on the rate field', () => {
    setUp();
    chooseCanton();
    type(rateInput(), '0');

    expect(renderedText()).toContain(errorMessage({ code: 'RATE_OUT_OF_RANGE' }));
    expect(rateInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('leaves the unrelated fields unmarked', () => {
    setUp();
    chooseCanton();
    type(rateInput(), '0');

    expect(daysInput().hasAttribute('aria-invalid')).toBe(false);
    expect(cantonSelect().hasAttribute('aria-invalid')).toBe(false);
  });

  it('reports a negative day count against the day field', () => {
    setUp();
    chooseCanton();
    type(daysInput(), '-1');

    const message = errorMessage({ code: 'NEGATIVE_DAYS', field: 'teleworkDays' });

    expect(renderedText()).toContain(message);
    expect(daysInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('reports days beyond the annual basis', () => {
    setUp();
    chooseCanton();
    type(daysInput(), '300');

    expect(renderedText()).toContain(errorMessage({ code: 'DAYS_EXCEED_TOTAL' }));
  });

  it('clears the error when the value becomes valid again', () => {
    setUp();
    chooseCanton();
    type(rateInput(), '0');
    type(rateInput(), '50');

    expect(renderedText()).not.toContain(errorMessage({ code: 'RATE_OUT_OF_RANGE' }));
    expect(rateInput().hasAttribute('aria-invalid')).toBe(false);
  });

  it('validates nothing before a canton is chosen', () => {
    // THE INTERPRETATION, asserted rather than left implicit. A TeleworkInput
    // needs a canton, the engine exposes no validator that works without one,
    // and exporting validateInput would be an engine API change (SPEC 20,
    // ask-first). So an out-of-range rate is silent until the first field is
    // answered. Recorded in the report as a question.
    setUp();
    type(rateInput(), '0');

    expect(renderedText()).not.toContain(errorMessage({ code: 'RATE_OUT_OF_RANGE' }));
  });
});

describe('the default granularity, inferred from step 0.5', () => {
  it('accepts a half day with no complaint', () => {
    setUp();
    chooseCanton();
    type(daysInput(), '0.5');

    const mismatch = errorMessage({ code: 'GRANULARITY_MISMATCH', field: 'teleworkDays' });

    expect(renderedText()).not.toContain(mismatch);
  });

  it('rejects a quarter day, so the default really is the half-day', () => {
    // The other half of the pair. Without it, "accepts a half day" would also
    // pass under a granularity of 'hours', which accepts any value at all and
    // would make the assertion above vacuous.
    setUp();
    chooseCanton();
    type(daysInput(), '0.25');

    const mismatch = errorMessage({ code: 'GRANULARITY_MISMATCH', field: 'teleworkDays' });

    expect(renderedText()).toContain(mismatch);
  });
});

describe('ruling R109: a French decimal comma', () => {
  // THE DEFECT R109 CORRECTS, and it was FW11's Q11. A French user writes
  // "83,5". type="number" treats a comma as invalid input: the value arrives
  // as the empty string, so the digits appear to vanish as they are typed and
  // the calculator looks broken to exactly the audience it is for.
  //
  // R109's answer: type="text" with inputMode="decimal", accepting both
  // separators and normalising to the period internally, WITH the field
  // showing what was typed. That last clause is the part a naive fix gets
  // wrong - rewriting the comma to a period as the user types moves the caret
  // and fights them mid-number.
  //
  // 83.5 of the 240-day basis is 34.79166..., truncated to 34,79 % for the
  // AFC. Both spellings must reach that.

  const NBSP = String.fromCharCode(0x00a0);
  const RATE_FOR_83_5 = `34,79${NBSP}%`;

  it('accepts a comma and computes from it', () => {
    setUp();
    chooseCanton();
    type(daysInput(), '83,5');

    expect(renderedText()).toContain(RATE_FOR_83_5);
  });

  it('accepts a period and computes the same answer', () => {
    setUp();
    chooseCanton();
    type(daysInput(), '83.5');

    expect(renderedText()).toContain(RATE_FOR_83_5);
  });

  it('shows what was typed, comma included', () => {
    setUp();
    chooseCanton();
    type(daysInput(), '83,5');

    // NOT normalised on screen. The value the user sees is the value they
    // entered; the period exists only inside the engine call.
    expect(daysInput().value).toBe('83,5');
  });

  it('shows a typed period as a period', () => {
    setUp();
    chooseCanton();
    type(daysInput(), '83.5');

    expect(daysInput().value).toBe('83.5');
  });

  it('takes a comma in the rate too', () => {
    // Non-vacuity across fields: R109 is about number inputs, not about one
    // of them. A rate of 87,5 % on the 240-day basis gives a total of 210.
    setUp();
    chooseCanton();
    type(rateInput(), '87,5');
    type(daysInput(), '211');

    expect(renderedText()).toContain(errorMessage({ code: 'DAYS_EXCEED_TOTAL' }));

    type(daysInput(), '210');

    expect(renderedText()).not.toContain(errorMessage({ code: 'DAYS_EXCEED_TOTAL' }));
  });

  it('still rejects text that is not a number at all', () => {
    // The cost of leaving the browser out of it: a text input accepts
    // anything, so the engine has to be the one that refuses. "abc" parses to
    // NaN, which validate reports against the field.
    setUp();
    chooseCanton();
    type(daysInput(), 'abc');

    expect(renderedText()).toContain(
      errorMessage({ code: 'NEGATIVE_DAYS', field: 'teleworkDays' }),
    );
  });
});

describe('ruling R112: what left the pixel layer is picked up here', () => {
  // THE PRINCIPLE, which generalises past this case: anything removed from one
  // verification layer is NAMED and picked up by another.
  //
  // e2e/visual-select.css paints the native select's label transparent for the
  // duration of a screenshot, because Chromium draws a closed select's text
  // through the platform theme and that path is not reproducible between a
  // local container and CI's. The box is still compared; the TEXT is not.
  //
  // So the text is asserted here, explicitly, rather than left to the option
  // list further up. That list proves all 26 options exist in the right order;
  // it says nothing about what the CONTROL displays once one is chosen, which
  // is precisely the pixels that stopped being compared.

  it('displays the chosen canton by name, not by code', () => {
    setUp();
    chooseCanton('GE');

    const selected = cantonSelect().selectedOptions[0];

    expect(selected?.textContent).toBe(CANTON_NAMES.GE);
  });

  it('displays a different canton when a different one is chosen', () => {
    // Non-vacuity: an implementation that always rendered the same label would
    // satisfy the assertion above.
    setUp();
    chooseCanton('VD');

    expect(cantonSelect().selectedOptions[0]?.textContent).toBe(CANTON_NAMES.VD);
    expect(CANTON_NAMES.VD).not.toBe(CANTON_NAMES.GE);
  });

  it('displays the placeholder before anything is chosen', () => {
    // THE EXACT STRING WHOSE PIXELS DIFFERED IN CI - "Selectionnez votre
    // canton", 497 pixels of glyph movement in the desktop empty-state
    // baseline. It is no longer compared as an image, so it is compared as
    // text.
    setUp();

    expect(cantonSelect().selectedOptions[0]?.textContent).toBe(FORM.canton.placeholder);
  });

  it('keeps the accented characters that made the glyphs environmental', () => {
    // Genève and Bâle-Campagne carry the accents; asserting them by codepoint
    // here is what the picture used to do.
    setUp();
    chooseCanton('BL');

    const shown = cantonSelect().selectedOptions[0]?.textContent ?? '';

    expect(shown).toBe(CANTON_NAMES.BL);
    expect(shown).toContain(String.fromCharCode(0x00e2));
  });
});

describe('R380: submitting with no canton says so, on the field', () => {
  // ==========================================================================
  // THE STATE THIS CHANGES, AND THE ONE IT DELIBERATELY DOES NOT
  // ==========================================================================
  //
  // Before this ruling an empty canton produced SILENCE on the field. A
  // TeleworkInput cannot be built without one, so the engine never ran, so
  // `errors` was empty, so errorFor('canton') was undefined - the field was
  // already wired for an error it could never receive.
  //
  // The neutral line in the result region (result.empty) stays exactly as it
  // was, and its own comment says why: somebody still filling the form in has
  // not done anything wrong. Pressing Calculer is what changes that.

  const submit = (): void => {
    fireEvent.click(screen.getByRole('button', { name: CALCULATEUR_COPY.result.calculate }));
  };

  it('says nothing about the canton before the form is submitted', () => {
    // THE HALF THAT PROTECTS THE EXISTING DECISION. Without this, "show the
    // error" would be satisfied by showing it always, which is the behaviour
    // result.empty's note exists to prevent.
    setUp();

    expect(screen.queryByText(FORM.canton.missing)).toBeNull();
  });

  it('shows the message once the form is submitted without one', () => {
    setUp();
    submit();

    expect(screen.queryByText(FORM.canton.missing)).not.toBeNull();
  });

  it('marks the field invalid, so it is not red ALONE', () => {
    // Colour is not an accessible signal on its own. FieldGroup already sets
    // aria-invalid and points aria-describedby at the error, which is what
    // makes the red border a presentation of something announced rather than
    // the whole message.
    setUp();
    submit();

    const select = cantonSelect();

    expect(select.getAttribute('aria-invalid')).toBe('true');

    const describedBy = select.getAttribute('aria-describedby') ?? '';
    const described = describedBy
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');

    expect(described).toContain(FORM.canton.missing);
  });

  it('clears as soon as a canton is chosen', () => {
    setUp();
    submit();

    expect(screen.queryByText(FORM.canton.missing)).not.toBeNull();

    fireEvent.change(cantonSelect(), { target: { value: 'GE' satisfies Canton } });

    expect(screen.queryByText(FORM.canton.missing)).toBeNull();
  });

  it('does not fire for a form that HAS a canton', () => {
    // R196's other direction: a guard that fired on every submit would pass
    // the "shows the message" test perfectly.
    setUp();
    fireEvent.change(cantonSelect(), { target: { value: 'GE' satisfies Canton } });
    submit();

    expect(screen.queryByText(FORM.canton.missing)).toBeNull();
  });
});
