// @vitest-environment jsdom
//
// web/lib/ui/react/FieldGroup/FieldGroup.test.tsx
//
// The wiring is the component. A label, a hint and an error message are easy;
// what is hard, and what every hand-rolled form gets wrong, is that the
// CONTROL has to carry aria-describedby pointing at both, aria-invalid when
// there is an error, and a hook the stylesheet can use for the 2 px error
// border. Miss one and the field looks right and announces wrong.
//
// SO children IS A FUNCTION, not a slot. That needs defending, because
// "composition, not a props bag" is the instruction and a function looks like
// neither at first glance.
//
// A plain slot cannot be wired. FieldGroup would have to reach into an
// element it does not own - React.cloneElement - and guess that the child
// accepts aria-describedby, which is untypeable and silently wrong for a
// wrapped or fragment child. The alternative, documenting that the caller
// must set four attributes itself, makes the guarantee a convention, and a
// convention is what this component exists to replace.
//
// The function receives exactly the attributes the control must carry and
// nothing else. It is composition - the caller still decides what the control
// IS, an input, a select, a fieldset of radios - and it is a props bag only
// in the sense that the props are handed to the caller rather than taken from
// it, which is the direction that makes them provable. Every test below
// asserts on the real <input> the caller rendered.
//
// Testing Library on roles, text and attributes (FW9 protocol item 6).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { errorMessage } from '@/lib/fr/errors';
import { FieldGroup } from './FieldGroup';

// EXPLICIT, because it does not happen by itself here. Testing Library
// registers its own afterEach cleanup only when a global afterEach exists,
// which needs vitest's "globals: true" - and this repo does not set it, on
// purpose. Without this line renders ACCUMULATE in one jsdom document across
// the tests in a file, and every screen query then searches a page holding
// several copies of the component. Found the hard way: six tests failed
// against a component the markup proved correct.
afterEach(cleanup);

const LABEL = 'Jours de télétravail';
const HELPER = 'Journées entières uniquement.';

// RULING R66's sweep found this. ERROR used to be a hardcoded copy of the
// sentence errorMessage produces, which is a second source of truth: the test
// would keep passing after lib/fr's wording changed, and - the reason it falls
// under R66 rather than beside it - a drift in WHICH SPACE CHARACTER the copy
// uses would be invisible, because the getByText assertions below normalise
// U+00A0 and U+202F to an ordinary space. French typography puts U+00A0 before
// a colon, and this sentence has one.
//
// Sourced from the real function, so the test now moves with the copy. The
// assertions on it stay Testing Library queries because it is PROSE, not a
// formatted number - R66 governs numbers - but sourcing it removes the only
// place a codepoint drift could have hidden.
const ERROR = errorMessage({ code: 'NEGATIVE_DAYS', field: 'teleworkDays' });

function renderField(props: { helper?: string; error?: string } = {}) {
  return render(
    <FieldGroup id="telework-days" label={LABEL} {...props}>
      {(control) => <input type="number" {...control} />}
    </FieldGroup>,
  );
}

const control = (): HTMLElement => screen.getByLabelText(LABEL);

describe('the label is attached to the control', () => {
  it('finds the control BY ITS LABEL, which is the whole point', () => {
    renderField();

    // getByLabelText fails unless htmlFor and id actually match, so this one
    // assertion covers the association rather than inspecting attributes.
    expect(control()).toBeDefined();
    expect(control().tagName).toBe('INPUT');
  });

  it('gives the control the id it was told to use', () => {
    renderField();

    expect(control().getAttribute('id')).toBe('telework-days');
  });
});

describe('a field with neither helper nor error', () => {
  it('sets no aria-describedby at all', () => {
    // Not an empty string: aria-describedby="" is a described-by pointing at
    // nothing, which some screen readers announce as a missing reference.
    renderField();

    expect(control().hasAttribute('aria-describedby')).toBe(false);
  });

  it('is not marked invalid', () => {
    renderField();

    expect(control().hasAttribute('aria-invalid')).toBe(false);
    expect(control().hasAttribute('data-invalid')).toBe(false);
  });

  it('renders no error text', () => {
    renderField();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('a field with helper text', () => {
  it('shows it', () => {
    renderField({ helper: HELPER });

    expect(screen.getByText(HELPER)).toBeDefined();
  });

  it('points aria-describedby at it', () => {
    renderField({ helper: HELPER });

    const described = control().getAttribute('aria-describedby') ?? '';

    // The id must actually resolve. A describedby naming an element that is
    // not in the document is the failure mode this catches - it looks correct
    // in the markup and announces nothing.
    expect(described).not.toBe('');
    expect(document.getElementById(described)?.textContent).toBe(HELPER);
  });
});

describe('a field in its error state', () => {
  it('shows the message', () => {
    renderField({ error: ERROR });

    expect(screen.getByText(ERROR)).toBeDefined();
  });

  it('announces it as an alert', () => {
    // The message appears after the user has acted, so it needs a live region
    // to be heard at all - a visually obvious message that is silent to a
    // screen reader is the classic form defect.
    renderField({ error: ERROR });

    expect(screen.getByRole('alert').textContent).toContain(ERROR);
  });

  it('marks the control invalid and flags it for the stylesheet', () => {
    renderField({ error: ERROR });

    expect(control().getAttribute('aria-invalid')).toBe('true');
    expect(control().getAttribute('data-invalid')).toBe('true');
  });

  it('points aria-describedby at the message', () => {
    renderField({ error: ERROR });

    const described = control().getAttribute('aria-describedby') ?? '';

    expect(document.getElementById(described)?.textContent).toContain(ERROR);
  });

  it('carries an icon that is hidden from the accessible name', () => {
    // SPEC 16: never colour-only. The icon is the second channel and the
    // words are the first, so announcing the glyph would say it twice.
    const { container } = renderField({ error: ERROR });
    const icon = container.querySelector('svg');

    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('a field with BOTH helper and error', () => {
  it('describes the control by both, in DOM order', () => {
    // The case a single-id implementation silently drops one of. Order
    // matters because it is the order they are announced in, and it follows
    // the visual order so that hearing and seeing agree.
    renderField({ helper: HELPER, error: ERROR });

    const ids = (control().getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);

    expect(ids).toHaveLength(2);

    const texts = ids.map((id) => document.getElementById(id)?.textContent ?? '');

    expect(texts[0]).toBe(HELPER);
    expect(texts[1]).toContain(ERROR);
  });

  it('keeps both visible', () => {
    renderField({ helper: HELPER, error: ERROR });

    expect(screen.getByText(HELPER)).toBeDefined();
    expect(screen.getByText(ERROR)).toBeDefined();
  });
});

describe('two fields on one page do not collide', () => {
  it('derives every id from the one it was given', () => {
    // Ids are built from the caller's id rather than from a counter, so two
    // instances cannot produce the same describedby target - and the ids stay
    // stable across a re-render, which a counter or a random suffix would not.
    render(
      <>
        <FieldGroup id="first" label="Premier" helper={HELPER}>
          {(c) => <input {...c} />}
        </FieldGroup>
        <FieldGroup id="second" label="Second" helper={HELPER}>
          {(c) => <input {...c} />}
        </FieldGroup>
      </>,
    );

    const first = screen.getByLabelText('Premier').getAttribute('aria-describedby');
    const second = screen.getByLabelText('Second').getAttribute('aria-describedby');

    expect(first).not.toBe(second);
    expect(first).toContain('first');
    expect(second).toContain('second');
  });
});
