// @vitest-environment jsdom
//
// web/tests/unit/pages/accessibility-calculateur.test.tsx
//
// FW11 increment 5: zero axe violations on the calculator, in every state it
// can be in.
//
// A SEPARATE FILE FROM accessibility.test.tsx, which covers the three legal
// pages. Those are static documents: one render each, two entity states, and
// the assertion is about composition. This page has STATES - a form that
// reveals fields, opens a disclosure, and swaps a number for an error - and
// each of them assembles a different document. The four the increment names
// are empty, filled, error and revealed.
//
// WHY THE STATES ARE THE POINT. An accessible empty form proves very little
// about the same form once it has grown two mission fields, an accordion full
// of radio groups and a live region announcing a rate. The defects that
// actually appear on this page appear in one state and not the others: a
// duplicate id when a revealed field reuses one, an aria-controls pointing at
// a node that is only sometimes rendered, a label orphaned when its control
// unmounts, a live region left without an accessible name.
//
// RENDERED INSIDE PublicShell, like the legal pages, because a landmark
// nested in another landmark and a second h1 are properties of the assembly
// and axe cannot see them from the content alone.
//
// WHAT AXE CANNOT SEE HERE, so the green is not read as more than it is: jsdom
// has no layout, so colour-contrast comes back INCOMPLETE and every size is
// unmeasurable. The 44 px touch targets are asserted from the token in
// calculateur-form.test.tsx and shown in increment 5's baselines; contrast is
// answered by tests/unit/tokens/contrast.test.ts.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import CalculateurPage from '@/app/(public)/calculateur-teletravail-frontalier/page';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

expect.extend(matchers);

afterEach(cleanup);

const FORM = CALCULATEUR_COPY.form;
const RESULT = CALCULATEUR_COPY.result;

const mount = () => render(<PublicShell>{<CalculateurPage />}</PublicShell>);

const setValue = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const click = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
};

const pick = (name: string) => {
  fireEvent.click(screen.getByRole('radio', { name }));
};

/**
 * The four states, each as a step to run after mounting.
 *
 * Functions rather than pre-rendered nodes because every one of them is
 * reached by USING the form. Constructing the DOM another way would test a
 * shape the product cannot actually get into.
 */
const STATES: ReadonlyArray<{ readonly name: string; readonly reach: () => void }> = [
  {
    name: 'empty - nothing chosen yet',
    reach: () => undefined,
  },
  {
    name: 'filled - Geneva case (c), a rate on screen',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      setValue(FORM.days.label, '84');
      pick(FORM.missions.yes);
      setValue(FORM.missions.france.label, '24');
    },
  },
  {
    name: 'error - a field marked invalid and a message under it',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      setValue(FORM.rate.label, '0');
    },
  },
  {
    name: 'revealed - missions shown and the accordion open',
    reach: () => {
      setValue(FORM.canton.label, 'GE');
      pick(FORM.missions.yes);
      click(FORM.advanced.summary);
      pick(FORM.method.exact);
    },
  },
];

describe('the calculator has no axe violations in any state', () => {
  it('covers the four states the increment names', () => {
    // Without this the loop could pass by shrinking to nothing - the same
    // vacuous-pass shape ruling R63 exists to catch.
    expect(STATES).toHaveLength(4);
    expect(STATES.map((state) => state.name.split(' ')[0])).toEqual([
      'empty',
      'filled',
      'error',
      'revealed',
    ]);
  });

  for (const state of STATES) {
    it(state.name, async () => {
      const { container } = mount();

      state.reach();

      expect(await axe(container)).toHaveNoViolations();
    });
  }

  it('really did reach the states, so the runs above were not all the same page', () => {
    // THE ASSERTION THAT KEEPS THE LOOP HONEST. axe passes on an empty form
    // four times over just as happily as on four different ones, so a broken
    // `reach` - a renamed label, a control that stopped existing - would turn
    // this whole describe into one test repeated. Each state is checked for
    // something only it contains.
    const { unmount: closeEmpty } = mount();

    expect(document.body.textContent).toContain(RESULT.empty);
    closeEmpty();
    cleanup();

    mount();
    STATES[1]?.reach();

    expect(document.body.textContent).toContain(`39,16${String.fromCharCode(0x00a0)}%`);
    cleanup();

    mount();
    STATES[2]?.reach();

    expect(screen.getByLabelText(FORM.rate.label).getAttribute('aria-invalid')).toBe('true');
    cleanup();

    mount();
    STATES[3]?.reach();

    expect(screen.getByLabelText(FORM.method.totalLabel)).toBeDefined();
  });
});

describe('the assembled document, in every state', () => {
  for (const state of STATES) {
    it(`${state.name}: one h1, no level skipped`, () => {
      // Asserted separately from axe because axe's heading-order rule is not
      // in its default set, and because the failure is specific here: the
      // shell emits no h1 so the page can, and the result region added an h2
      // in increment 4 which sits between the page's h1 and the footer's own
      // h2 columns.
      const { container } = mount();

      state.reach();

      const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((element) =>
        Number.parseInt(element.tagName.slice(1), 10),
      );

      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);

      for (let index = 1; index < levels.length; index += 1) {
        const previous = levels[index - 1] ?? 1;
        const current = levels[index] ?? 1;

        expect(current - previous, `h${previous} followed by h${current}`).toBeLessThanOrEqual(1);
      }
    });
  }
});

describe('no id is used twice, in any state', () => {
  // NOT COVERED BY AXE'S DEFAULT SET, and the most likely defect on a form
  // that renders fields conditionally: FieldGroup derives every id it needs
  // from the caller's id, so two fields sharing one would silently point two
  // labels and two error messages at the same control.
  for (const state of STATES) {
    it(state.name, () => {
      const { container } = mount();

      state.reach();

      const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
      const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);

      expect(duplicated, `duplicated: ${duplicated.join(', ')}`).toEqual([]);
      expect(ids.length).toBeGreaterThan(3);
    });
  }
});
