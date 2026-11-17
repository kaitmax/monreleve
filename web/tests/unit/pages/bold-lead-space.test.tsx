// @vitest-environment jsdom
//
// web/tests/unit/pages/bold-lead-space.test.tsx
//
// FW-NOTICE-SPACE (W24), R1061: A BOLD LEAD AND THE TEXT AFTER IT ARE
// SEPARATED BY EXACTLY ONE SPACE, read on the RENDERED text (R225).
//
// THE DEFECT. The calculator's provisional notice names the pending reading
// in bold and runs it straight into the next sentence: "...des jours de
// missionVos jours de mission..." and "...au decompte exactVous utilisez...".
// JSX drops the line break between a closing tag and the expression on the
// next line, so `</span>` followed by `{body}` on its own line renders with
// nothing between them. W23 saw it in the old and the new baseline alike
// (REPORT-FW-AVIS-CAPTURE.txt N2), and no test could, because every
// assertion on the notice used `toContain` on one string at a time.
//
// EVERY SITE OF THE PATTERN (R267). Each surface that renders a bold lead
// with text beside it, by tag or by class, is checked here through the same
// helper:
//   - the provisional notice, P1, P3 and both at once (CalculatorForm) - the
//     site that was broken;
//   - the comparator's limits list, a <strong> lead and its rest (lamal page);
//   - the deadline helper's first step (bold lead, then text) and its second
//     (text, then a bold date) (DeadlineHelper).
// The comparator's sites were correct before this task. The notice's RED,
// through the same helper, is what proves the helper can fire on them.
//
// EXACTLY ONE SPACE, and an ASCII one. Equality on the joint, so no space and
// two spaces both fail. Whitespace is never folded with `\s`: the copy carries
// the no-break spaces French typography puts in it (R91), and folding them
// would make a correct page fail or a wrong one pass.
//
// The words are read from the copy modules, never retyped (R171, R181).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ComparateurPage from '@/app/(public)/calculateur-lamal-cmu/page';
import { SECTION_ID } from '@/app/(public)/calculateur-lamal-cmu/section-ids';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import type { ProvisionalId } from '@/lib/content/provisional';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { PROVISIONAL_COPY } from '@/lib/fr/provisional';

afterEach(cleanup);

beforeAll(() => {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    return undefined;
  };
});

const FORM = CALCULATEUR_COPY.form;

/**
 * THE ONE HELPER. `container`'s rendered text is `before + bold + after`, and
 * the joint between the bold element and the text beside it is exactly one
 * ASCII space on the side where text sits. Text that is not there (a lead
 * that ends its container, or one that starts it) has no joint to check.
 */
function expectOneSpaceBeside(container: Element, bold: Element): void {
  const whole = container.textContent ?? '';
  const lead = bold.textContent ?? '';
  const at = whole.indexOf(lead);

  expect(lead.length, 'the bold element carries text').toBeGreaterThan(0);
  expect(at, 'the bold text is inside its container').toBeGreaterThanOrEqual(0);

  const before = whole.slice(0, at);
  const after = whole.slice(at + lead.length);

  // Two characters each side: the joint and the one beyond it, so a doubled
  // space shows as "  " rather than passing as " ".
  if (after !== '') expect(after.slice(0, 2), `after "${lead}"`).toMatch(/^ [^ \t\n\r]/u);
  if (before !== '') expect(before.slice(-2), `before "${lead}"`).toMatch(/[^ \t\n\r] $/u);
}

// ---------------------------------------------------------------------------
// The provisional notice (CalculatorForm). The site that was broken.
// ---------------------------------------------------------------------------

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const radio = (name: string) => {
  fireEvent.click(screen.getByRole('radio', { name }));
};

/** P1: mission days in France AND in a third state. */
const triggerP1 = () => {
  fireEvent.change(screen.getByLabelText(FORM.canton.label), { target: { value: 'GE' } });
  type(FORM.days.label, '40');
  radio(FORM.missions.yes);
  type(FORM.missions.france.label, '6');
  type(FORM.missions.thirdState.label, '4');
};

/** P3: the exact method at part time. */
const triggerP3 = () => {
  fireEvent.change(screen.getByLabelText(FORM.canton.label), { target: { value: 'GE' } });
  type(FORM.days.label, '40');
  type(FORM.rate.label, '80');
  fireEvent.click(screen.getByRole('button', { name: FORM.advanced.summary }));
  radio(FORM.method.exact);
};

const noticeItems = (): HTMLLIElement[] => {
  const notice = document.querySelector('[data-notice="provisional"]');

  if (notice === null) throw new Error('no provisional notice rendered');

  return [...notice.querySelectorAll('li')];
};

/** What one entry of the notice reads, composed from the copy (R181). */
const entryText = (id: ProvisionalId): string =>
  `${PROVISIONAL_COPY.items[id].interpretation} ${PROVISIONAL_COPY.items[id].body} ${PROVISIONAL_COPY.readMore}`;

describe('the provisional notice separates the reading it names from the sentence after it', () => {
  const cases: readonly { readonly name: string; readonly ids: readonly ProvisionalId[]; readonly reach: () => void }[] = [
    { name: 'P1', ids: ['P1'], reach: triggerP1 },
    { name: 'P3', ids: ['P3'], reach: triggerP3 },
    {
      name: 'P1 and P3 at once',
      ids: ['P1', 'P3'],
      reach: () => {
        triggerP1();
        type(FORM.rate.label, '80');
        fireEvent.click(screen.getByRole('button', { name: FORM.advanced.summary }));
        radio(FORM.method.exact);
      },
    },
  ];

  it.each(cases)('$name: each entry reads name, one space, sentence', ({ ids, reach }) => {
    render(<CalculatorForm taxYear={2026} />);
    reach();

    const items = noticeItems();

    expect(items.map((item) => item.textContent)).toEqual(ids.map(entryText));
  });

  it.each(cases)('$name: the bold name is followed by exactly one space', ({ ids, reach }) => {
    render(<CalculatorForm taxYear={2026} />);
    reach();

    const items = noticeItems();

    expect(items).toHaveLength(ids.length);
    items.forEach((item, index) => {
      const id = ids[index];
      const name = item.firstElementChild;

      if (id === undefined || name === null) throw new Error('a notice entry without its bold name');
      expect(name.textContent).toBe(PROVISIONAL_COPY.items[id].interpretation);
      expectOneSpaceBeside(item, name);
    });
  });
});

// ---------------------------------------------------------------------------
// The comparator (calculateur-lamal-cmu): the same pattern, by <strong>.
// ---------------------------------------------------------------------------

describe('the comparator separates its bold leads from the text beside them', () => {
  it('the limits list: each <strong> lead, one space, its rest', () => {
    render(<ComparateurPage />);

    const items = [...document.querySelectorAll(`#${SECTION_ID.limits} li`)];
    const withRest = items.filter((item) => item.querySelector('strong') !== null && item.children.length > 1);

    // Non-vacuity: the list renders, and at least one lead has a rest beside it.
    expect(items.length).toBeGreaterThan(0);
    expect(withRest.length).toBeGreaterThan(0);

    for (const item of items) {
      const lead = item.querySelector('strong');

      if (lead === null) throw new Error('a limit without its lead');
      expectOneSpaceBeside(item, lead);
    }
  });

  it('the deadline helper: a bold lead then text, and text then a bold date', () => {
    render(<ComparateurPage />);

    const helper = document.querySelector('[data-deadline-helper="true"]');

    if (helper === null) throw new Error('no deadline helper rendered');

    const steps = [...helper.querySelectorAll('ol > li > span:last-child')].filter(
      (step) => step.querySelector('strong') !== null,
    );

    // Step 1 leads with its bold phrase, step 2 ends with its bold date.
    expect(steps).toHaveLength(2);
    for (const step of steps) {
      const bold = step.querySelector('strong');

      if (bold === null) throw new Error('a step without its bold phrase');
      expectOneSpaceBeside(step, bold);
    }
  });
});
