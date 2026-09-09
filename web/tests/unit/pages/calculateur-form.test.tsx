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
import { CANTON_NAMES } from '@/lib/fr/cantons';
import { errorMessage } from '@/lib/fr/errors';

// PLAIN DOM ASSERTIONS, NOT jest-dom. @testing-library/jest-dom is a
// devDependency here but no setup file has ever registered it, so
// toBeInTheDocument and friends are not in scope - tsc says so before any
// test runs. Adding a global setup file to import them would change the
// config for all 74 test files to save a few characters in one, so this
// follows the convention every other test in the repo already uses.
//
// valueAsNumber rather than value on the number inputs: value is the raw
// string the control holds, and asserting '0.5' would pass against a
// field that had stopped parsing.

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
  it('offers all 26 cantons, each named in French', () => {
    setUp();

    const codes = Object.keys(CANTON_NAMES) as readonly Canton[];

    // Non-vacuous: the map itself must really hold 26, or the loop below
    // would assert nothing while passing.
    expect(codes).toHaveLength(26);

    for (const code of codes) {
      const option = screen.getByRole('option', { name: CANTON_NAMES[code] });

      expect(option.getAttribute('value'), code).toBe(code);
    }
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

    expect(rateInput().valueAsNumber).toBe(100);
  });

  it('carries step 5 and the range the engine accepts', () => {
    setUp();

    expect(rateInput().getAttribute('step')).toBe('5');
    expect(rateInput().getAttribute('min')).toBe('1');
    expect(rateInput().getAttribute('max')).toBe('100');
  });

  it('takes a typed value', () => {
    setUp();
    type(rateInput(), '80');

    expect(rateInput().valueAsNumber).toBe(80);
  });
});

describe('field 3: telework days already taken', () => {
  it('defaults to 0', () => {
    setUp();

    expect(daysInput().valueAsNumber).toBe(0);
  });

  it('carries step 0.5 and no upper bound, which the engine supplies', () => {
    setUp();

    expect(daysInput().getAttribute('step')).toBe('0.5');
    expect(daysInput().getAttribute('min')).toBe('0');
    expect(daysInput().hasAttribute('max')).toBe(false);
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

    expect(rateInput().valueAsNumber).toBe(95);

    fireEvent.click(screen.getByRole('button', { name: FORM.rate.increase }));

    expect(rateInput().valueAsNumber).toBe(100);
  });

  it('will not step the rate above its maximum', () => {
    setUp();
    fireEvent.click(screen.getByRole('button', { name: FORM.rate.increase }));

    expect(rateInput().valueAsNumber).toBe(100);
  });

  it('clamps to the minimum rather than stepping past it', () => {
    setUp();
    type(rateInput(), '3');
    fireEvent.click(screen.getByRole('button', { name: FORM.rate.decrease }));

    // 3 - 5 would be -2, which is not a rate. The minimum is 1, not 0: a
    // contract at nothing per cent is not a contract.
    expect(rateInput().valueAsNumber).toBe(1);
  });

  it('steps the day field by the half-day', () => {
    setUp();
    fireEvent.click(screen.getByRole('button', { name: FORM.days.increase }));

    expect(daysInput().valueAsNumber).toBe(0.5);
  });

  it('will not step the day field below zero', () => {
    setUp();
    fireEvent.click(screen.getByRole('button', { name: FORM.days.decrease }));

    expect(daysInput().valueAsNumber).toBe(0);
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
