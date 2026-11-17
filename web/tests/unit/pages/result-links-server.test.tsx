// @vitest-environment jsdom
//
// web/tests/unit/pages/result-links-server.test.tsx
//
// R976 (FW-CALC-BYTES) FOR THE RESULT PANEL'S ONE CONTEXTUAL LINK (slot 7).
//
// The panel renders inside the calculator's client island, and it decided R85
// for itself with ctaHrefIfLive - which imported the route registry into the
// calculator's client bundle (REPORT-FW-CALC-BYTES.txt, R975). The decision is
// the SERVER's now: the two pages that render the panel resolve every status's
// link with liveHrefs and hand the answers down as plain data.
//
// BOTH DIRECTIONS, so nothing here can pass by the panel ignoring its input: a
// table saying "not live" must give text although the registry says live, and
// a table giving the href must give the anchor. And through the REAL entry
// points (R204): the calculator page's element tree and the result page's
// render, not the panel alone.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import CalculateurPage from '@/app/(public)/calculateur-teletravail-frontalier/page';
import ResultatPage from '@/app/(public)/calculateur-teletravail-frontalier/resultat/page';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import { ResultPanel } from '@/app/(public)/calculateur-teletravail-frontalier/ResultPanel';
import { type TeleworkInput, calculateTelework, ruleSetFor } from '@/lib/calc-engine';
import { liveHrefs } from '@/lib/content/routes';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { RESULT_COPY } from '@/lib/fr/result';
import { encode } from '@/lib/params/codec';
import { statusFor } from '@/lib/ui/core';

afterEach(cleanup);

beforeAll(() => {
  // jsdom has no layout; the island calls scrollIntoView optionally.
  Element.prototype.scrollIntoView = function scrollIntoView() {
    return undefined;
  };
});

const TAX_YEAR = 2026;
const RULES = ruleSetFor(TAX_YEAR);

/** Geneva case (c), the fixture the engine is verified against. */
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

const result = (() => {
  const outcome = calculateTelework(GENEVA_C);

  if (!outcome.ok) throw new Error('the fixture does not compute');

  return outcome.value;
})();

const STATUS = statusFor(result);
const LINK = RESULT_COPY.links[STATUS];

/** Every status withheld: what a server would send if no target were live. */
const NONE_LIVE = { compliant: null, 'mission-exposure': null, 'regime-lost': null, 'social-switch': null };

/** The server's real answer, from the registry that ships. */
const RESOLVED = liveHrefs(RESULT_COPY.links);

const slot = (container: HTMLElement) => container.querySelector('[data-panel="link"]');

describe('the panel renders what the server resolved (R976)', () => {
  it('renders TEXT when the server says the target is not live, whatever the registry says', () => {
    // The registry says this target IS live today - the next test proves it -
    // so only a panel reading its input, not the registry, can render text here.
    const { container } = render(<ResultPanel result={result} thresholds={RULES} liveLinks={NONE_LIVE} />);

    expect(slot(container)?.querySelector('a')).toBeNull();
    expect(slot(container)?.textContent).toContain(RESULT_COPY.linkPending(LINK.text));
  });

  it('renders the ANCHOR when the server hands it the live href', () => {
    expect(RESOLVED[STATUS], 'the registry has this target live today').toBe(LINK.href);

    const { container } = render(<ResultPanel result={result} thresholds={RULES} liveLinks={RESOLVED} />);

    expect(slot(container)?.querySelector('a')?.getAttribute('href')).toBe(LINK.href);
  });

  it('reads an absent table as "not known to be live": text, never a guessed link (R85)', () => {
    const { container } = render(<ResultPanel result={result} thresholds={RULES} />);

    expect(slot(container)?.querySelector('a')).toBeNull();
  });
});

describe('the island passes the server’s answers to the panel', () => {
  const FORM = CALCULATEUR_COPY.form;

  const enterGenevaCaseC = () => {
    fireEvent.change(screen.getByLabelText(FORM.canton.label), { target: { value: 'GE' } });
    fireEvent.change(screen.getByLabelText(FORM.days.label), { target: { value: '84' } });
    fireEvent.click(screen.getByRole('radio', { name: FORM.missions.yes }));
    fireEvent.change(screen.getByLabelText(FORM.missions.france.label), { target: { value: '24' } });
  };

  it.each([
    ['withheld', false, NONE_LIVE],
    ['resolved', true, RESOLVED],
  ] as const)('%s by the server: the panel’s link is an anchor = %s', (_, anchor, table) => {
    const { container } = render(<CalculatorForm taxYear={TAX_YEAR} liveLinks={table} />);

    enterGenevaCaseC();

    expect(slot(container), 'the island rendered no panel').not.toBeNull();
    expect(slot(container)?.querySelector('a') !== null).toBe(anchor);
  });
});

describe('the pages resolve the table on the server and hand it down (R204)', () => {
  /** Every element in a server render's tree, depth first. */
  function* elements(node: ReactNode): Generator<ReactElement> {
    if (Array.isArray(node)) {
      for (const child of node) yield* elements(child);

      return;
    }

    if (!isValidElement(node)) return;

    yield node;
    const props = node.props as { readonly children?: ReactNode };

    yield* elements(props.children);
  }

  it('the calculator page gives the island liveHrefs(RESULT_COPY.links)', () => {
    const island = [...elements(CalculateurPage())].find((element) => element.type === CalculatorForm);

    expect(island, 'the page renders no CalculatorForm').toBeDefined();
    expect((island?.props as { readonly liveLinks?: unknown }).liveLinks).toEqual(RESOLVED);
  });

  it('the result page links the result by the registry’s answer', async () => {
    const searchParams = Promise.resolve(Object.fromEntries(encode(GENEVA_C)));
    const { container } = render(await ResultatPage({ searchParams }));

    expect(slot(container), 'the result page rendered no panel').not.toBeNull();
    expect(slot(container)?.querySelector('a')?.getAttribute('href') ?? null).toBe(RESOLVED[STATUS]);
  });
});
