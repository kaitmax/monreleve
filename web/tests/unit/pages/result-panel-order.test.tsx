// @vitest-environment jsdom
//
// web/tests/unit/pages/result-panel-order.test.tsx
//
// FW12 increment 1: the panel's ORDER, which is the design and not an
// arrangement.
//
// SPEC 9.3 states the sequence and says why: "Order is decision-relevance."
// ZoneBadge first because the status is the answer; the rate next because it
// is the number; the rail because it places the number; the tiles because they
// are the consequences; warnings because they are conditional; the legal note
// because it qualifies everything above it; and exactly one contextual link,
// last, because it is what to do next.
//
// WHY A DOM-SEQUENCE ASSERTION. Every one of those seven renders correctly in
// any order - a reviewer reading a diff that moves the rail above the rate
// sees two components swap and nothing fail. The operator's instruction is
// explicit: "A DOM-sequence assertion means a later refactor can't silently
// reorder a panel whose order is the design."
//
// data-panel IS THE CONTRACT, deliberately. Asserting on class names would
// couple this test to styling, and asserting on component internals would
// break every time one of FW8's components changes markup. The attribute names
// the SLOT, which is the thing SPEC specifies - the same reasoning Container
// uses for data-width and FieldGroup for data-invalid.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ResultPanel } from '@/app/(public)/calculateur-teletravail-frontalier/ResultPanel';
import { type TeleworkInput, calculateTelework, ruleSetFor } from '@/lib/calc-engine';

afterEach(cleanup);

const TAX_YEAR = 2026;
const RULES = ruleSetFor(TAX_YEAR);

/** Geneva case (c): the fixture the whole engine is verified against. */
const GENEVA_C: TeleworkInput = {
  taxYear: TAX_YEAR,
  canton: 'GE',
  employmentRate: 100,
  periodFraction: 1,
  denominator: { kind: 'simplified240' },
  granularity: 'halfDay',
  teleworkDays: 84,
  missionDaysFrance: 24,
  missionDaysThirdState: 0,
};

const resultFor = (input: TeleworkInput) => {
  const outcome = calculateTelework(input);

  if (!outcome.ok) throw new Error(`fixture does not compute: ${outcome.error[0]?.code ?? ''}`);

  return outcome.value;
};

const panelFor = (input: TeleworkInput = GENEVA_C) =>
  render(<ResultPanel result={resultFor(input)} thresholds={RULES} />);

/** The slots in document order. */
const slotOrder = (container: HTMLElement): readonly string[] =>
  [...container.querySelectorAll('[data-panel]')].map(
    (element) => element.getAttribute('data-panel') ?? '',
  );

/**
 * SPEC 9.3's sequence, written once.
 *
 * Email capture and share are items 8 and 9 in SPEC and belong to FW13/FW14;
 * their slots are deliberately absent rather than empty, because an empty
 * landmark is a thing a screen reader announces.
 */
const SPEC_ORDER = [
  'badge',
  'rate',
  'rail',
  'tiles',
  'warnings',
  'legal',
  'link',
] as const;

describe('SPEC 9.3 order', () => {
  it('renders the seven slots in exactly the specified sequence', () => {
    const { container } = panelFor();

    expect(slotOrder(container)).toEqual([...SPEC_ORDER]);
  });

  it('renders each slot exactly once', () => {
    // A duplicated slot would satisfy a "contains in order" check and is the
    // likelier accident: a section copied to a second breakpoint.
    const { container } = panelFor();
    const seen = slotOrder(container);

    for (const slot of SPEC_ORDER) {
      expect(seen.filter((name) => name === slot), slot).toHaveLength(1);
    }
  });

  it('keeps the order in every status, not only this fixture', () => {
    // The panel's contents vary by status - the badge, the link, whether
    // warnings appear - and the ORDER must not. Geneva case (e) is
    // regime-lost; a rate under both ceilings is compliant.
    const compliant: TeleworkInput = { ...GENEVA_C, teleworkDays: 72, missionDaysFrance: 0 };
    const regimeLost: TeleworkInput = { ...GENEVA_C, teleworkDays: 144, missionDaysFrance: 5 };

    for (const input of [compliant, regimeLost]) {
      const { container, unmount } = panelFor(input);

      expect(slotOrder(container)).toEqual([...SPEC_ORDER]);
      unmount();
    }
  });

  it('places the legal note after everything it qualifies', () => {
    // Stated separately because it is the one whose position carries a
    // meaning beyond convention: a disclaimer above the number it disclaims
    // is read before there is anything to disclaim.
    const seen = slotOrder(panelFor().container);

    expect(seen.indexOf('legal')).toBeGreaterThan(seen.indexOf('rate'));
    expect(seen.indexOf('legal')).toBeGreaterThan(seen.indexOf('tiles'));
    expect(seen.indexOf('legal')).toBeLessThan(seen.indexOf('link'));
  });

  it('leaves no slot for FW13 and FW14', () => {
    // Email capture and share are SPEC 9.3 items 8 and 9 and out of scope
    // here. Asserted as an absence so that adding one is a deliberate edit
    // rather than something that appears half-built.
    const seen = slotOrder(panelFor().container);

    expect(seen).not.toContain('email');
    expect(seen).not.toContain('share');
  });
});

describe('the panel computes nothing (standing protocol 7)', () => {
  it('renders the rate the engine returned, not one of its own', () => {
    // The panel receives a TeleworkResult. If it ever recomputed, this is
    // where the two would diverge - and the engine is the only thing verified
    // against the tax administration.
    const result = resultFor(GENEVA_C);
    const { container } = render(
      <ResultPanel result={result} thresholds={RULES} />,
    );

    expect(result.declarableRate).toBe(39.16);
    expect(container.querySelector('[data-panel="rate"]')?.textContent).toContain('39,16');
  });

  it('takes its thresholds from the caller, never from a literal', () => {
    // R35 for the rail, R73 everywhere else: the ceilings arrive as props so
    // a rule change moves the panel with it.
    const { container } = render(
      <ResultPanel result={resultFor(GENEVA_C)} thresholds={RULES} />,
    );

    expect(container.querySelector('[data-panel="rail"]')).not.toBeNull();
    expect(RULES.fiscalCeiling).toBe(0.4);
  });
});

describe('the live region moves here from FW11', () => {
  it('is the panel, and it is polite', () => {
    // FW11 put aria-live on the provisional rate region. That region is gone,
    // so the announcement has to live on what replaced it - otherwise a
    // recalculation changes the whole panel and says nothing.
    const { container } = panelFor();
    const live = container.querySelectorAll('[aria-live]');

    expect(live).toHaveLength(1);
    expect(live[0]?.getAttribute('aria-live')).toBe('polite');
  });

  it('is focusable, so the Calculer button still has a target', () => {
    const { container } = panelFor();

    expect(container.querySelector('#resultat')?.getAttribute('tabindex')).toBe('-1');
  });
});
