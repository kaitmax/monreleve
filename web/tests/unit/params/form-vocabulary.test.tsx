// @vitest-environment jsdom
//
// web/tests/unit/params/form-vocabulary.test.tsx
//
// R351: THE CALCULATOR'S FORM SPEAKS SPEC 9.4'S VOCABULARY, OR IT ANSWERS A
// DIFFERENT QUESTION IN SILENCE.
//
// The island became a real GET form, so with no scripting the BROWSER builds
// the query out of the `name` and `value` attributes in the markup - nothing
// in this codebase touches it on the way out. That makes those attributes a
// wire format, and a wire format with no test is a transcription (R181).
//
// IT IS NOT A HYPOTHETICAL. Before this test the radios carried the ENGINE's
// names: `methode=simplified240` and `decompte=halfDay`. Measured through
// decode(): both come back in `invalid`, both fall back to the default, and
// the reader who asked for half-days is shown the whole-day answer with no
// word that anything was dropped. Nothing was broken enough to fail - the
// page returned 200 and a plausible figure.
//
// WHY IT SERIALISES THE FORM BY HAND. jsdom implements no form submission, so
// the browser's own algorithm is reproduced here: every named control, radios
// only when checked, in document order. That is a second description of a
// standard and it is the only one available short of a real browser - so the
// nojs e2e spec drives a REAL submit as well (R204), and this test exists to
// say WHICH control is wrong when that one goes red.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import { RESULT_PATH } from '@/lib/content/routes';
import { currentTaxYear } from '@/lib/content/tax-year';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { decode } from '@/lib/params/codec';
import { FORM_ONLY_PARAMS, PARAM_NAMES } from '@/lib/params/schema';

const COPY = CALCULATEUR_COPY.form;
const YEAR = currentTaxYear();

afterEach(cleanup);

/** The browser's form-serialisation algorithm, for the controls we use. */
const serialise = (form: HTMLFormElement): URLSearchParams => {
  const query = new URLSearchParams();

  for (const control of form.querySelectorAll<
    HTMLInputElement | HTMLSelectElement
  >('input[name], select[name]')) {
    // UNCHECKED RADIOS **AND** CHECKBOXES ARE NOT SUBMITTED, which is the
    // browser rule this helper exists to reproduce. It skipped radios only
    // until R343 put five checkboxes in the form, and an unchecked checkbox
    // sent here would have decoded as a rhythm nobody chose - the helper
    // asserting a scenario the browser cannot produce.
    if (
      control instanceof HTMLInputElement &&
      (control.type === 'radio' || control.type === 'checkbox') &&
      !control.checked
    ) {
      continue;
    }

    query.append(control.name, control.value);
  }

  return query;
};

/**
 * Every control the form has, revealed and filled in: missions answered so
 * the two count fields exist, accordion open so the four advanced ones do,
 * and a canton chosen because without one there is no TeleworkInput to
 * decode into - the engine has no default canton and inventing one would
 * compute a regime nobody selected.
 */
const openedForm = (): HTMLFormElement => {
  const { container } = render(<CalculatorForm taxYear={YEAR} />);

  fireEvent.click(screen.getByLabelText(COPY.missions.yes));
  fireEvent.click(screen.getByText(COPY.advanced.summary));
  fireEvent.change(screen.getByLabelText(COPY.canton.label), { target: { value: 'GE' } });

  const form = container.querySelector('form');

  if (form === null) throw new Error('the calculator renders no form element');

  return form;
};

describe('R351: the form is a real GET form to the page that answers', () => {
  it('submits by GET to the result page, never to this route', () => {
    const form = openedForm();

    expect(form.getAttribute('method')?.toLowerCase()).toBe('get');
    expect(form.getAttribute('action')).toBe(RESULT_PATH);
  });

  it('names every control from SPEC 9.4, and invents none', () => {
    const names = [...new Set(serialise(openedForm()).keys())].sort();
    const allowed = [...PARAM_NAMES, ...FORM_ONLY_PARAMS].sort();

    // SUBSET, not equality: `total` appears only under the exact method and
    // `debut` only once a date is typed, so a form at its defaults carries
    // fewer than nine. What must never happen is a TENTH name.
    expect(names.filter((name) => !allowed.includes(name as never))).toEqual([]);
  });

  it('every value it submits is READ by the codec, not merely tolerated', () => {
    // THE ASSERTION THE RADIOS FAILED. `invalid` is decode()'s report of
    // values that arrived and could not be used; a form that fills it is a
    // form talking to itself.
    const decoded = decode(serialise(openedForm()), YEAR);

    expect(decoded.invalid).toEqual([]);
    expect(decoded.input).not.toBeNull();
  });

  it('the only param the engine does not know is the mission question', () => {
    const decoded = decode(serialise(openedForm()), YEAR);

    expect(decoded.ignored).toEqual([...FORM_ONLY_PARAMS]);
  });

  it('carries the values a reader typed, through to the engine input', () => {
    // R154's positive half: the three assertions above are all satisfied by a
    // form that submits NOTHING. This one requires the figures to arrive.
    const form = openedForm();

    fireEvent.change(screen.getByLabelText(COPY.canton.label), { target: { value: 'GE' } });
    fireEvent.change(screen.getByLabelText(COPY.days.label), { target: { value: '84' } });
    fireEvent.change(screen.getByLabelText(COPY.missions.france.label), {
      target: { value: '24' },
    });
    fireEvent.click(screen.getByLabelText(COPY.decompte.halfDay));

    const decoded = decode(serialise(form), YEAR);

    expect(decoded.input?.canton).toBe('GE');
    expect(decoded.input?.teleworkDays).toBe(84);
    expect(decoded.input?.missionDaysFrance).toBe(24);
    expect(decoded.input?.granularity).toBe('halfDay');
  });
});

describe('R343: the rhythm checkboxes speak the same vocabulary', () => {
  it('submits nothing for the rhythm when no day is checked', () => {
    // The prompt: "none checked by default", and "with none checked, the
    // calculator shows today's position only, as now." A form that sent
    // five unchecked boxes would project a rhythm the reader never gave.
    const query = serialise(openedForm());

    expect(query.getAll('rythme')).toEqual([]);
  });

  it('submits one value per checked day, which decode reads back', () => {
    const form = openedForm();

    fireEvent.click(screen.getByLabelText(CALCULATEUR_COPY.projection.days.TUESDAY));
    fireEvent.click(screen.getByLabelText(CALCULATEUR_COPY.projection.days.THURSDAY));

    const query = serialise(form);

    expect(query.getAll('rythme')).toEqual(['ma', 'je']);

    const decoded = decode(query, YEAR);

    expect(decoded.rhythm).toEqual({ TUESDAY: 'HOME', THURSDAY: 'HOME' });
    expect(decoded.invalid).toEqual([]);
  });

  it('is five checkboxes, one per weekday, sharing one name', () => {
    // R133: the assertions above would pass on a form with a single box.
    const boxes = [
      ...openedForm().querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="rythme"]'),
    ];

    expect(boxes.length).toBe(5);
    expect(boxes.map((box) => box.value)).toEqual(['lu', 'ma', 'me', 'je', 've']);
  });
});

describe('R351: the form-only exemption is asserted, never merely small', () => {
  it('exempts exactly one param, and it is the mission question', () => {
    // R206's corollary: an exemption list that can grow quietly is how the
    // contrast audit and the threshold guard each nearly failed. A second
    // entry here has to be a deliberate act that breaks this line.
    expect([...FORM_ONLY_PARAMS]).toEqual(['missions']);
  });

  it('exempts nothing the codec actually reads', () => {
    // The dangerous mistake is the opposite one: exempting a REAL param
    // would silence the notice about the value that was dropped.
    for (const name of FORM_ONLY_PARAMS) {
      expect(PARAM_NAMES).not.toContain(name);
    }
  });
});
