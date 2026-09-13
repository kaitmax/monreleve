// @vitest-environment jsdom
// web/tests/unit/pages/calculator-events.test.tsx
//
// The events the calculator actually fires, with a fake collector installed.
//
// WHY THIS IS TESTABLE WITH NOTHING TO SEND TO. lib/analytics/track.ts takes
// an installed collector rather than looking up a vendor global, so a test
// installs one and reads exactly what the page emits. No collector ships
// today - see that module for the measurement - which makes these assertions
// the only evidence that the call sites are right.
//
// AND THE PLACEMENT IS THE THING BEING TESTED, not the payload shape.
// tests/unit/analytics/events.test.ts already proves what each builder
// returns. What only a rendered page can answer is WHEN: that a reader typing
// a rate one digit at a time is one calculation rather than three, and that
// closing an accordion is not a second opening.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { setCollector } from '@/lib/analytics/track';
import type { AnalyticsEvent } from '@/lib/analytics/events';

const FORM = CALCULATEUR_COPY.form;

let seen: AnalyticsEvent[] = [];

beforeEach(() => {
  seen = [];
  setCollector((event) => seen.push(event));
  window.history.replaceState(null, '', '/calculateur-teletravail-frontalier');
});

afterEach(() => {
  setCollector(null);
  cleanup();
});

const names = (): string[] => seen.map((event) => event.name);

const complete = (): void => {
  fireEvent.change(screen.getByLabelText(FORM.canton.label), { target: { value: 'GE' } });
  fireEvent.change(screen.getByLabelText(FORM.rate.label), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText(FORM.days.label), { target: { value: '40' } });
};

describe('calculated and result_status', () => {
  it('reports one calculation, not one per keystroke', () => {
    // THE ASSERTION THE PLACEMENT EXISTS FOR. SPEC 9.3 recomputes on every
    // input event with no debounce, and SPEC 15 wants calculated to mean
    // "real usage, not bounces". Three fields, several changes, one event.
    render(<CalculatorForm taxYear={2026} />);

    complete();
    fireEvent.change(screen.getByLabelText(FORM.days.label), { target: { value: '41' } });
    fireEvent.change(screen.getByLabelText(FORM.days.label), { target: { value: '42' } });

    expect(names().filter((name) => name === 'calculated').length).toBe(1);
  });

  it('carries the Status enum when the outcome changes', () => {
    render(<CalculatorForm taxYear={2026} />);

    complete();

    const statuses = seen
      .filter((event) => event.name === 'result_status')
      .map((event) => event.data?.status);

    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((status) => typeof status === 'string')).toBe(true);
  });

  it('reports a new status when the answer moves, not a repeat of the old one', () => {
    // R120 in event form: if result_status fired on every recomputation with
    // the same value, the count would look healthy and the data would say
    // nothing. A big change of days must produce a DIFFERENT status.
    render(<CalculatorForm taxYear={2026} />);

    complete();
    fireEvent.change(screen.getByLabelText(FORM.days.label), { target: { value: '200' } });

    const statuses = seen
      .filter((event) => event.name === 'result_status')
      .map((event) => String(event.data?.status));

    expect(new Set(statuses).size).toBeGreaterThan(1);
  });
});

describe('missions_declared', () => {
  it('reports the answer as a boolean, never a day count', () => {
    render(<CalculatorForm taxYear={2026} />);

    fireEvent.click(screen.getByRole('radio', { name: FORM.missions.yes }));

    const event = seen.find((candidate) => candidate.name === 'missions_declared');

    expect(event?.data).toEqual({ declared: true });
  });
});

describe('accordion_opened', () => {
  it('fires on opening and not on closing', () => {
    // Firing on both would count one reader twice and make the ratio SPEC 15
    // asks about - whether progressive disclosure works - meaningless.
    render(<CalculatorForm taxYear={2026} />);

    const toggle = screen.getByRole('button', { name: FORM.advanced.summary });

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(names().filter((name) => name === 'accordion_opened').length).toBe(1);
  });

  it('names the section by the id the panel actually uses', () => {
    const { container } = render(<CalculatorForm taxYear={2026} />);

    fireEvent.click(screen.getByRole('button', { name: FORM.advanced.summary }));

    const event = seen.find((candidate) => candidate.name === 'accordion_opened');
    const section = String(event?.data?.section);

    // The payload must join back to the page: the id it names has to be an
    // element that exists.
    expect(container.querySelector(`#${section}`)).not.toBeNull();
  });
});

describe('the page works with no collector at all', () => {
  it('calculates normally when analytics is absent, which is today and every ad blocker', () => {
    setCollector(null);

    const { container } = render(<CalculatorForm taxYear={2026} />);

    expect(() => {
      complete();
    }).not.toThrow();

    // The result is still produced: the assertion that matters is that the
    // page is unaffected, not that nothing was recorded. #resultat is the
    // id the page-order census names it by, so this reads the same landmark.
    expect(container.querySelector('#resultat')).not.toBeNull();
  });
});
