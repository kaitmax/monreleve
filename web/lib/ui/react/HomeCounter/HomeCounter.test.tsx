// @vitest-environment jsdom
// web/lib/ui/react/HomeCounter/HomeCounter.test.tsx
//
// R711: THE COUNTER USES THE ENGINE, NOT A SECOND FORMULA - and this file is
// the proof the ruling asks for. It sweeps BOTH sliders over their whole
// ranges and requires every figure the counter shows to equal the engine's
// output for that input.
//
// TWO SWEEPS, because they prove different things.
//
//   THE GRID (every telework value x every basis value, 141 x 81) drives the
//   real island through its real sliders and reads the rate and both tiles
//   OUT OF THE DOM, against calculateTelework called here, directly, on the
//   documented input. Nothing in between is trusted: not counterFigures, not
//   the island's formatting.
//
//   THE CANTONS. The counter passes GE because the engine needs a canton, and
//   the page says "sans canton". That sentence is only true if no canton
//   changes a figure the counter shows - so every canton is computed over the
//   same grid and compared with GE.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { calculateTelework, ruleSetFor } from '@/lib/calc-engine';
import type { Canton, TeleworkInput } from '@/lib/calc-engine';
import { COUNTER_BASIS, COUNTER_TELEWORK } from '@/lib/content/home-counter';
import { formatPercent, formatSignedDays, zoneFor } from '@/lib/ui/core';
import {
  HomeCounter,
  type HomeCounterCopy,
  type HomeCounterForm,
} from '@/lib/ui/react/HomeCounter/HomeCounter';

afterEach(cleanup);

const YEAR = 2026;

/**
 * Labels the test can find, deliberately NOT the page's French: this file
 * asserts figures, and R126 keeps French copy in lib/fr. Each is distinct so a
 * tile can be told from the other by its label.
 */
const COPY: HomeCounterCopy = {
  rateLabel: 'RATE',
  status: { compliant: 'ZONE-A', 'fiscal-exposure': 'ZONE-B', 'social-switch': 'ZONE-C' },
  fiscalTile: 'FISCAL-LEFT',
  fiscalOver: 'FISCAL-OVER',
  socialTile: 'SOCIAL-LEFT',
  socialOver: 'SOCIAL-OVER',
  teleworkLabel: 'TT',
  basisLabel: 'BASE',
};

const FORM: HomeCounterForm = {
  action: '/result',
  teleworkName: 'tt',
  basisName: 'total',
  hidden: [['methode', 'exact']],
};

/** The declarable rate as the counter shows it - RateDisplay's figure, read from the DOM. */
function rateShown(): string | null | undefined {
  return document.querySelector('[data-counter-rate] p')?.textContent;
}

/** The documented simplified input, written out here rather than imported. */
function engine(teleworkDays: number, basisDays: number, canton: Canton = 'GE') {
  const input: TeleworkInput = {
    taxYear: YEAR,
    canton,
    employmentRate: 100,
    periodFraction: 1,
    denominator: { kind: 'exact', totalWorkDays: basisDays },
    granularity: 'day',
    teleworkDays,
    missionDaysFrance: 0,
    missionDaysThirdState: 0,
  };
  const outcome = calculateTelework(input);

  if (!outcome.ok) {
    throw new Error(`the engine refused ${String(teleworkDays)} / ${String(basisDays)}`);
  }

  return outcome.value;
}

const range = (min: number, max: number): number[] =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index);

const TELEWORK = range(COUNTER_TELEWORK.min, COUNTER_TELEWORK.max);
const BASIS = range(COUNTER_BASIS.min, COUNTER_BASIS.max);

/** The figure under a tile's label - the label's sibling in MetricTile. */
function tileFigure(label: string): string {
  const node = screen.getByText(label).nextElementSibling;

  return node?.textContent ?? '';
}

describe('the counter shows the engine, at every slider position (R711)', () => {
  it('opens on the design position with the engine figure already in the markup', () => {
    render(<HomeCounter taxYear={YEAR} copy={COPY} form={FORM} />);

    const expected = engine(COUNTER_TELEWORK.initial, COUNTER_BASIS.initial);

    expect(rateShown()).toBe(formatPercent(expected.declarableRate, 2));
  });

  it('sweeps both sliders over their whole ranges: rate, status and both tiles', { timeout: 300_000 }, () => {
    render(<HomeCounter taxYear={YEAR} copy={COPY} form={FORM} />);

    const telework = screen.getByLabelText(/^TT /);
    const basis = screen.getByLabelText(/^BASE /);
    const thresholds = ruleSetFor(YEAR);
    let positions = 0;

    for (const base of BASIS) {
      fireEvent.change(basis, { target: { value: String(base) } });

      for (const days of TELEWORK) {
        fireEvent.change(telework, { target: { value: String(days) } });

        const expected = engine(days, base);
        const zone = zoneFor(expected.declarableRate, thresholds);
        const fiscal = formatSignedDays(expected.remainingToFiscal);
        const social = formatSignedDays(expected.remainingToSocial);

        // Read back from the DOM, never from the component's own helpers.
        const rate = rateShown();

        expect(rate, `rate at ${String(days)}/${String(base)}`).toBe(
          formatPercent(expected.declarableRate, 2),
        );
        expect(screen.getByText(COPY.status[zone])).toBeTruthy();
        expect(tileFigure(fiscal.negative ? COPY.fiscalOver : COPY.fiscalTile)).toBe(fiscal.text);
        expect(tileFigure(social.negative ? COPY.socialOver : COPY.socialTile)).toBe(social.text);

        positions += 1;
      }
    }

    // Non-vacuity: the loops ran over every position, not over an empty range.
    expect(positions).toBe(TELEWORK.length * BASIS.length);
  });

  it('reaches all three zones inside the sliders, so the sweep tested every status', () => {
    const thresholds = ruleSetFor(YEAR);
    const zones = new Set(
      BASIS.flatMap((base) =>
        TELEWORK.map((days) => zoneFor(engine(days, base).declarableRate, thresholds)),
      ),
    );

    expect([...zones].sort()).toEqual(['compliant', 'fiscal-exposure', 'social-switch']);
  });

  it('truncates, never rounds: 94 of 240 shows 39,16 %, the Geneva figure', () => {
    // The design's own example, and the case R711 names. 94 / 240 is
    // 39,1666...; a counter that rounded would show 39,17.
    render(<HomeCounter taxYear={YEAR} copy={COPY} form={FORM} initialTelework={94} initialBasis={240} />);

    expect(rateShown()).toBe(
      formatPercent(engine(94, 240).declarableRate, 2),
    );
    expect(engine(94, 240).declarableRate).toBe(39.16);
  });
});

describe('the form a reader without JavaScript submits (R346, R351)', () => {
  it('is a GET form to the action it is given, the sliders named, the fixed fields hidden', () => {
    const { container } = render(<HomeCounter taxYear={YEAR} copy={COPY} form={FORM} />);
    const form = container.querySelector('form');

    expect(form?.getAttribute('method')).toBe('get');
    expect(form?.getAttribute('action')).toBe(FORM.action);
    expect(screen.getByLabelText(/^TT /).getAttribute('name')).toBe(FORM.teleworkName);
    expect(screen.getByLabelText(/^BASE /).getAttribute('name')).toBe(FORM.basisName);

    for (const [name, value] of FORM.hidden) {
      expect(form?.querySelector(`input[type="hidden"][name="${name}"]`)?.getAttribute('value')).toBe(value);
    }
  });

  it('renders the fallback it is given inside the form, and no submit button of its own', () => {
    const { container } = render(
      <HomeCounter taxYear={YEAR} copy={COPY} form={FORM}>
        <span data-fallback />
      </HomeCounter>,
    );

    expect(container.querySelector('form [data-fallback]')).not.toBeNull();
    expect(container.querySelector('form button, form input[type="submit"]')).toBeNull();
  });

  it('labels each slider with its current value', () => {
    render(<HomeCounter taxYear={YEAR} copy={COPY} form={FORM} />);

    const telework = screen.getByLabelText(`TT ${String(COUNTER_TELEWORK.initial)}`);

    fireEvent.change(telework, { target: { value: '7' } });

    expect(screen.getByLabelText('TT 7')).toBe(telework);
  });
});

describe('"sans canton" is true for the three figures the counter shows', () => {
  const CANTONS: readonly Canton[] = [
    'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
    'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
  ];

  it('every canton gives the GE rate and remaining days at every slider position', { timeout: 120_000 }, () => {
    const differing: string[] = [];

    for (const base of BASIS) {
      for (const days of TELEWORK) {
        const reference = engine(days, base, 'GE');

        for (const canton of CANTONS) {
          const other = engine(days, base, canton);

          if (
            other.declarableRate !== reference.declarableRate ||
            other.remainingToFiscal !== reference.remainingToFiscal ||
            other.remainingToSocial !== reference.remainingToSocial
          ) {
            differing.push(`${canton} ${String(days)}/${String(base)}`);
          }
        }
      }
    }

    expect(differing.slice(0, 10)).toEqual([]);
  });

  it('includes the cantons of both regimes, so the comparison can differ', () => {
    const regimes = new Set(
      CANTONS.map((canton) => ruleSetFor(YEAR).residence1983Cantons.includes(canton)),
    );

    expect([...regimes].sort()).toEqual([false, true]);
  });
});
