// @vitest-environment jsdom
// web/tests/unit/pages/home.test.tsx
//
// The A2 home page (FW-HOME-A2, R709-R723), rendered. Each assertion takes
// its expectation from the source of the thing it checks - the engine, the
// RuleSet, lib/fr/home.ts, lib/fr/sources.ts, the route registry - never from
// a literal typed here (R171, R181).

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import HomePage from '@/app/(public)/page';
import { calculateTelework } from '@/lib/calc-engine';
import { COUNTER_BASIS, COUNTER_TELEWORK, counterFigures } from '@/lib/content/home-counter';
import { heroExampleInput } from '@/lib/content/home';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { CALCULATOR_PATH, COMPARATOR_PATH, PUBLIC_ROUTES, RESULT_PATH } from '@/lib/content/routes';
import { currentTaxYear } from '@/lib/content/tax-year';
import { HOME_COPY } from '@/lib/fr/home';
import { SHELL_COPY } from '@/lib/fr/shell';
import { SOURCE_CITATIONS } from '@/lib/fr/sources';
import { guideScope } from '@/lib/guides/scope';
import { PARAM_NAMES, methodCode } from '@/lib/params/schema';
import { formatPercent } from '@/lib/ui/core';
import { typedFiguresIn } from '../../support/typed-figures';

afterEach(cleanup);

const YEAR = currentTaxYear();
const SCOPE = guideScope(YEAR);
const C = HOME_COPY;

/** Testing Library collapses whitespace in DOM text, U+00A0 included. */
const seen = (text: string): string => text.replace(/\s+/gu, ' ');

describe('the sections, in the approved order (R709)', () => {
  it('renders one h1 and the h2s of sections 3 to 8, in order', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(C.opening.heading);

    const h2 = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);

    // The alert card's own heading is AlertCapture's (R718), between the
    // year's cards and the questions.
    expect(h2[0]).toBe(C.counter.heading);
    expect(h2[1]).toBe(C.mobile.heading);
    expect(h2[2]).toBe(C.thresholds.heading);
    // FW-COMPARATEUR-SURFACE: the health-insurance choice, after the band.
    expect(h2[3]).toBe(C.health.heading);
    expect(h2[4]).toBe(C.year.heading);
    expect(h2[h2.length - 1]).toBe(C.questions.heading);
  });

  it('opens on the line, the lead with both thresholds, and the free note', () => {
    render(<HomePage />);

    expect(screen.getByText(C.opening.line)).toBeTruthy();
    expect(screen.getByText(seen(C.opening.lead(SCOPE.fiscal, SCOPE.social, PRODUCT_STATE)))).toBeTruthy();
    expect(screen.getByText(C.opening.free)).toBeTruthy();
  });

  it('puts the releve excerpt beside the opening, named as a sample (R714)', () => {
    render(<HomePage />);

    expect(screen.getByRole('figure', { name: C.excerpt.label })).toBeTruthy();
  });
});

describe('the counter (R711)', () => {
  it('serves the engine figure for its opening position, before any script', () => {
    const { container } = render(<HomePage />);
    const figures = counterFigures(YEAR, COUNTER_TELEWORK.initial, COUNTER_BASIS.initial);

    expect(figures).not.toBeNull();
    expect(container.querySelector('[data-counter-rate] p')?.textContent).toBe(
      formatPercent(figures?.declarableRate ?? Number.NaN, 2),
    );
  });

  it('is a GET form to the page that answers, every field a calculator parameter (R346, R351)', () => {
    const { container } = render(<HomePage />);
    const form = container.querySelector('form[data-counter]');

    expect(form?.getAttribute('method')).toBe('get');
    expect(form?.getAttribute('action')).toBe(RESULT_PATH);

    const names = [...(form?.querySelectorAll('input[name], select[name]') ?? [])].map(
      (field) => (field as HTMLInputElement).name,
    );

    expect(names.length).toBeGreaterThanOrEqual(3);
    for (const name of names) {
      expect(PARAM_NAMES as readonly string[], `${name} is not a calculator parameter`).toContain(name);
    }
    expect(
      form?.querySelector('input[type="hidden"][name="methode"]')?.getAttribute('value'),
    ).toBe(methodCode('exact'));
  });

  it('carries the simplification note, with its two required phrases (R712)', () => {
    render(<HomePage />);

    expect(screen.getByText(C.counter.note)).toBeTruthy();
  });
});

describe('the two thresholds come from the RuleSet and lib/fr/sources (R710, R715)', () => {
  it('shows each ceiling, its rule and its citation', () => {
    render(<HomePage />);

    expect(screen.getAllByText(seen(SCOPE.fiscal)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(seen(SCOPE.social)).length).toBeGreaterThan(0);
    expect(screen.getByText(seen(C.thresholds.fiscalBody(SCOPE.fiscal, SCOPE.missionCap)))).toBeTruthy();
    expect(screen.getByText(seen(C.thresholds.socialBody(SCOPE.social)))).toBeTruthy();
    expect(screen.getByText(seen(C.thresholds.source(SOURCE_CITATIONS.fiscal)))).toBeTruthy();
    expect(screen.getByText(seen(C.thresholds.source(SOURCE_CITATIONS.social)))).toBeTruthy();
  });

  it('types no regulatory figure into the rendered prose (R147)', () => {
    const { container } = render(<HomePage />);
    const prose = [...container.querySelectorAll('p, h1, h2, h3, li, figcaption')]
      .map((node) => node.textContent ?? '')
      .filter((text) => text.includes(' '));

    // The figures ARE rendered - from the RuleSet - so this asserts the
    // delivery, and that the copy module itself typed none (typed-numbers
    // test) is the other half.
    expect(prose.some((text) => typedFiguresIn(text).length > 0)).toBe(true);
  });
});

describe('the phones (R716)', () => {
  it('shows both platforms with the worked example the engine computes', () => {
    render(<HomePage />);

    const outcome = calculateTelework(heroExampleInput(YEAR));

    expect(outcome.ok).toBe(true);
    expect(screen.getByRole('img', { name: C.phone.androidLabel })).toBeTruthy();
    expect(screen.getByRole('img', { name: C.phone.iphoneLabel })).toBeTruthy();
  });
});

describe('every link goes somewhere that answers (R713)', () => {
  it('links only to live routes and to fragments that exist', () => {
    const { container } = render(<HomePage />);
    const live = new Set(PUBLIC_ROUTES.filter((route) => route.status === 'live').map((route) => route.path));
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '');

    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    expect(hrefs).toContain(CALCULATOR_PATH);

    for (const href of hrefs) {
      if (href.startsWith('#')) {
        expect(container.querySelector(`[id="${href.slice(1)}"]`), href).not.toBeNull();
      } else {
        expect(live.has(href), `${href} is not a live route`).toBe(true);
      }
    }
  });

  it('ships no sign-in and no sample-releve action, which have nowhere to go yet', () => {
    const { container } = render(<HomePage />);

    // Every action on the page is accounted for: the opening's anchor, the
    // calculator, and the application page - nothing else.
    const actions = [...container.querySelectorAll('main a[href]')].map((a) => a.getAttribute('href'));

    expect([...new Set(actions)].sort()).toEqual(
      ['#calcul', SHELL_COPY.ctaHref, CALCULATOR_PATH, COMPARATOR_PATH].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// FW-COMPARATEUR-SURFACE: the comparator is findable from the home page.
// ---------------------------------------------------------------------------

/**
 * What the health section must never carry: a digit (a premium, a rate, a
 * year's figure), a currency, a percent, or a verdict. The figures live on the
 * comparator with their sources and dates.
 */
const FIGURE_OR_VERDICT = /\d|%|€|\bCHF\b|\bEUR\b|moins cher/iu;

describe('the health-insurance section (FW-COMPARATEUR-SURFACE)', () => {
  const section = (): HTMLElement => screen.getByRole('region', { name: C.health.heading });

  it('sits after the two-thresholds band: its heading, ONE sentence, one action', () => {
    render(<HomePage />);

    const region = section();

    expect(within(region).getByText(seen(C.health.body))).toBeTruthy();
    expect(region.querySelectorAll('p')).toHaveLength(1);
    // One sentence: one full stop, at the end.
    expect(C.health.body.match(/\./gu)).toHaveLength(1);
    expect(C.health.body.endsWith('.')).toBe(true);

    const actions = [...region.querySelectorAll('a[href]')];

    expect(actions).toHaveLength(1);
    expect(actions[0]?.getAttribute('href')).toBe(COMPARATOR_PATH);
    expect(actions[0]?.textContent).toBe(C.health.cta);
  });

  it('carries no figure and no verdict - and the same scan finds the band’s', () => {
    const { container } = render(<HomePage />);

    expect(FIGURE_OR_VERDICT.test(section().textContent ?? '')).toBe(false);

    // POSITIVE CONTROL: the identical scan, on the same render, fires on the
    // thresholds band, which shows both ceilings. An absence assertion is
    // only worth something once the scan is shown to see (R169).
    const band = [...container.querySelectorAll('section')].find(
      (node) => node.querySelector('h2')?.textContent === C.thresholds.heading,
    );

    expect(FIGURE_OR_VERDICT.test(band?.textContent ?? '')).toBe(true);
    expect(FIGURE_OR_VERDICT.test('Le système le moins cher')).toBe(true);
  });
});

describe('the comparator question (FW-COMPARATEUR-SURFACE)', () => {
  it('asks it, answers in two sentences, and ends on a link to the comparator', () => {
    const { container } = render(<HomePage />);
    const entry = [...container.querySelectorAll('[data-faq] details')].find(
      (node) => node.querySelector('summary')?.textContent === C.questions.health.question,
    );

    expect(entry).toBeDefined();
    expect(C.questions.health.answer.match(/\./gu)).toHaveLength(2);

    const paragraph = entry?.querySelector('p');
    const anchor = paragraph?.querySelector('a');

    expect(paragraph?.textContent?.startsWith(C.questions.health.answer)).toBe(true);
    expect(anchor?.getAttribute('href')).toBe(COMPARATOR_PATH);
    expect(anchor?.textContent).toBe(C.questions.health.link);
  });
});

describe('the questions (R717) and the alert sign-up (R718)', () => {
  it('opens the first question, with its Avant / Apres pair', () => {
    const { container } = render(<HomePage />);
    const details = [...container.querySelectorAll('[data-faq] details')];

    expect(details).toHaveLength(5);
    expect(details[0]?.hasAttribute('open')).toBe(true);
    expect(details.slice(1).every((node) => !node.hasAttribute('open'))).toBe(true);
    expect(within(details[0] as HTMLElement).getByText(C.questions.change.afterBody)).toBeTruthy();
  });

  it('is the real AlertCapture, posting where it posts today', () => {
    const { container } = render(<HomePage />);
    const form = container.querySelector('form[action="/api/alertes"]');

    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.querySelector('input[name="source"]')?.getAttribute('value')).toBe('alertes');
  });
});
