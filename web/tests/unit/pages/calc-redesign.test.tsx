// @vitest-environment jsdom
// web/tests/unit/pages/calc-redesign.test.tsx
//
// FW-CALC-REDESIGN (R1406-R1409): the two calculator pages as one family - a
// form beside a sticky result rail, the explanations in native accordions.
// What a unit test can say about it (the layout itself - sticky, widths, the
// browser opening an accordion on a fragment - is e2e/calc-redesign.spec.ts):
//
//   R1407  the irrevocability warning stays under the h1, in the error style,
//          with "irrévocable" and the three-month window OUTSIDE any closed
//          disclosure - asserted on the rendered page (R225);
//   R1408  the rail: a France panel with ONE figure, a Suisse panel with the
//          lowest, the median and the highest (R668), the rate and its date in
//          the Swiss panel and beside the range bar (R672), the range bar's
//          text alternative the dot chart's own (it carries the same sentence),
//          the case sentence (R674), the care and franc cards inside
//          accordions IN the rail, no chip navigation, and every section id
//          still resolving, inside its accordion's content;
//   R1409  the seven explanation sections collapsed - closed by default, each
//          summary its section's existing heading - and every lib/fr string
//          the BASE page rendered still served (calc-pages-inventory.json,
//          derived from the base's rendered page, R181).
//
// Words are read from lib/fr, never retyped (R171, R181).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ComparateurPage from '@/app/(public)/calculateur-lamal-cmu/page';
import CalculateurPage from '@/app/(public)/calculateur-teletravail-frontalier/page';
import { SECTION_ID } from '@/app/(public)/calculateur-lamal-cmu/section-ids';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { LAMAL_PAGE_COPY } from '@/lib/fr/lamal-page';
import { formatDate } from '@/lib/ui/core';
import { formatEur, formatRate } from '@/lib/lamal/format';
import { countAgainst, householdTotals, scenario } from '@/lib/lamal/scenario';
import { DEFAULT_YEAR, EXCHANGE_RATE } from '@/lib/lamal/years';
import INVENTORY from './calc-pages-inventory.json';

const COPY = LAMAL_COPY;
const PAGE = LAMAL_PAGE_COPY;

afterEach(cleanup);

beforeAll(() => {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    return undefined;
  };
});

/** Layout whitespace collapsed; no-break spaces kept (R91). */
const norm = (text: string | null | undefined): string => (text ?? '').replace(/[ \t\n\r]+/gu, ' ').trim();

const INCOME = '40000';
const BIRTH_YEAR = 1985;

function compareAdult(): void {
  fireEvent.change(screen.getByLabelText(COPY.form.income.label), { target: { value: INCOME } });
  fireEvent.change(screen.getByLabelText(COPY.form.persons.you), { target: { value: String(BIRTH_YEAR) } });
  fireEvent.click(screen.getByRole('button', { name: COPY.form.submit }));
}

/** True when the node is inside a <details> that is closed, outside its summary. */
function hiddenByClosedDetails(node: Element): boolean {
  let at: Element | null = node;

  while (at !== null) {
    const details: HTMLDetailsElement | null = at.closest('details');

    if (details === null) return false;

    const summary = details.querySelector(':scope > summary');

    if (!details.open && !(summary !== null && summary.contains(at))) return true;
    at = details.parentElement;
  }

  return false;
}

/** The seven collapsed sections (R1409), each with the heading its summary carries. */
const FOLDS: readonly { readonly id: string; readonly heading: string }[] = [
  { id: SECTION_ID.deadline, heading: COPY.deadline.heading },
  { id: SECTION_ID.final, heading: PAGE.final.heading },
  { id: SECTION_ID.family, heading: PAGE.family.heading },
  { id: SECTION_ID.scope, heading: PAGE.scope.heading },
  { id: SECTION_ID.france, heading: PAGE.france.heading },
  { id: SECTION_ID.switzerland, heading: PAGE.switzerland.heading },
  { id: SECTION_ID.limits, heading: COPY.limitsHeading },
];

describe('R1407: the irrevocability warning stays prominent', () => {
  it('sits under the h1, before the form, in the error style, with both facts visible', () => {
    const { container } = render(<ComparateurPage />);
    const h1 = container.querySelector('h1');
    const banner = container.querySelector('[data-banner="irrevocable"]');
    const form = container.querySelector('form');

    expect(banner).not.toBeNull();
    expect(h1?.compareDocumentPosition(banner as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(banner?.compareDocumentPosition(form as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // The visible part: every text node of the banner outside a closed
    // disclosure. "irrévocable" and the three-month window are both in it.
    const visible: string[] = [];
    const walker = document.createTreeWalker(banner as Node, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;

      if (parent !== null && !hiddenByClosedDetails(parent)) visible.push(node.textContent ?? '');
    }

    const shown = norm(visible.join(' '));

    expect(shown).toContain('irrévocable');
    expect(shown).toContain('trois mois');
    // No word removed: the whole body is still in the banner.
    expect(norm(banner?.textContent)).toContain(norm(COPY.banner.body));
  });
});

describe('R1408: the result rail', () => {
  it('shows ONE French figure and the THREE Swiss figures, side by side, France first', () => {
    const { container } = render(<ComparateurPage />);

    compareAdult();

    const rail = container.querySelector('[data-result-region]');
    const france = rail?.querySelector('[data-side="france"]');
    const swiss = rail?.querySelector('[data-side="switzerland"]');

    expect(france?.querySelectorAll('dd')).toHaveLength(1);
    expect(swiss?.querySelectorAll('dd')).toHaveLength(3);
    expect(france?.compareDocumentPosition(swiss as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // The panels carry the country tokens through their hooks, not a class per side.
    expect(france?.closest('[data-panels]')).not.toBeNull();
    expect(swiss?.closest('[data-panels]')).toBe(france?.closest('[data-panels]'));
  });

  it('carries the rate and its date in the Swiss panel and beside the range bar (R672)', () => {
    const { container } = render(<ComparateurPage />);

    compareAdult();

    const sentence = COPY.result.swiss.conversion(formatRate(EXCHANGE_RATE.chfPerEurTenThousandths), formatDate(EXCHANGE_RATE.date));
    const swiss = container.querySelector('[data-side="switzerland"]');
    const bar = container.querySelector('[data-range]');

    expect(norm(swiss?.textContent)).toContain(norm(sentence));
    expect(bar).not.toBeNull();
    expect(norm(bar?.textContent)).toContain(norm(sentence));
  });

  it('draws ONE range bar whose text alternative is the dot chart’s own sentence, and keeps the dot chart', () => {
    const { container } = render(<ComparateurPage />);

    compareAdult();

    const result = scenario({ year: DEFAULT_YEAR, incomeEur: Number(INCOME), persons: [{ birthYear: BIRTH_YEAR, withAccident: false }] });

    if (!result.ok) throw new Error(result.error.code);

    const comparison = result.value.comparison;
    const totals = householdTotals(comparison, 12).map((total) => total.eur);
    const french = comparison.french.contributionEur;
    const { above, below, count } = countAgainst(totals, french);
    const label = COPY.result.chart.label(
      count,
      formatEur(totals[0] ?? 0),
      formatEur(totals[totals.length - 1] ?? 0),
      formatEur(french),
      COPY.result.chart.sentence(above, below, count),
    );
    const bars = container.querySelectorAll('[data-range] [role="img"]');

    expect(bars).toHaveLength(1);
    expect(bars[0]?.getAttribute('aria-label')).toBe(label);
    // The dot chart is kept - its words are about dots (R165) - inside an accordion in the rail.
    const chart = container.querySelector('[data-chart="insurers"]');

    // The card keeps its frame; the accordion is inside it, its summary the card's heading.
    expect(chart?.querySelector(':scope > details')).not.toBeNull();
    expect(chart?.closest('[data-result-region]')).not.toBeNull();
  });

  it('states the case sentence, and puts the care and franc cards as accordions inside the rail', () => {
    const { container } = render(<ComparateurPage />);

    compareAdult();

    const rail = container.querySelector('[data-result-region]');

    expect(rail?.querySelectorAll('[data-case-sentence]')).toHaveLength(1);

    for (const [hook, heading] of [
      ['[data-care]', COPY.result.care.heading],
      ['[data-franc]', COPY.result.franc.heading],
    ] as const) {
      const card = rail?.querySelector(hook);
      const details = card?.querySelector<HTMLDetailsElement>(':scope > details');

      expect(details, hook).not.toBeNull();
      expect(details?.open, `${hook} closed by default`).toBe(false);
      expect(norm(details?.querySelector('summary')?.textContent)).toBe(norm(heading));
    }
  });

  it('removes the chip navigation, and every section id still resolves inside its accordion', () => {
    const { container } = render(<ComparateurPage />);

    expect(container.querySelector('[data-on-this-page]')).toBeNull();

    for (const id of Object.values(SECTION_ID)) {
      expect(container.querySelectorAll(`[id="${id}"]`), `#${id}`).toHaveLength(1);
    }
    for (const { id } of FOLDS) {
      const target = container.querySelector(`[id="${id}"]`);
      const details = target?.closest('details');

      // The id is on the accordion's CONTENT, not on the <details> or in its
      // summary: a browser reveals a closed <details> only for a fragment
      // that points inside its content (measured in e2e/calc-redesign.spec.ts).
      expect(details, `#${id} inside an accordion`).not.toBeNull();
      expect(target?.closest('summary'), `#${id} not in a summary`).toBeNull();
      expect(target).not.toBe(details);
    }
  });
});

describe('R1409: the explanation sections are collapsed', () => {
  it('renders each of the seven as a closed accordion whose summary is its existing heading', () => {
    const { container } = render(<ComparateurPage />);

    for (const { id, heading } of FOLDS) {
      const details = container.querySelector(`[id="${id}"]`)?.closest('details');

      expect(details?.open, `${id} closed`).toBe(false);
      expect(norm(details?.querySelector('summary')?.textContent), `${id}'s summary`).toBe(norm(heading));
    }
    // Sources stays open: not in an accordion.
    expect(container.querySelector(`[id="${SECTION_ID.sources}"]`)?.closest('details')).toBeNull();
  });

  it('keeps the three-month tool inside its accordion', () => {
    const { container } = render(<ComparateurPage />);
    const helper = container.querySelector('[data-deadline-helper]');

    expect(helper).not.toBeNull();
    expect(helper?.closest('details')).toBe(container.querySelector(`[id="${SECTION_ID.deadline}"]`)?.closest('details'));
  });

  it('keeps the reminder landings OUTSIDE every accordion, so a :target reveal is never hidden', () => {
    const { container } = render(<ComparateurPage />);
    const outcomes = container.querySelectorAll('[data-rappel-outcome]');

    expect(outcomes.length).toBeGreaterThan(0);
    outcomes.forEach((outcome) => expect(outcome.closest('details')).toBeNull());
  });
});

// ---- the inventory: no text removed (R1409, R1410) --------------------------

type Inventory = Readonly<Record<string, readonly string[]>>;

/**
 * Removed on purpose by R1408, which removes the chip navigation: the three
 * chip labels that are not a section heading, and the navigation's name -
 * and DELETED from lib/fr by the addendum's R1416 (the operator: "Delete
 * them"). ASSERTED EXACT, so a fifth removal must survive its own argument
 * (R206's corollary), and asserted GONE from lib/fr, so none comes back
 * without a reader.
 */
const REMOVED_WITH_THE_CHIPS = [
  'lamal-page:LAMAL_PAGE_COPY.chips.compare',
  'lamal-page:LAMAL_PAGE_COPY.chips.france',
  'lamal-page:LAMAL_PAGE_COPY.chips.switzerland',
  'lamal-page:LAMAL_PAGE_COPY.onThisPage',
] as const;

async function resolve(key: string): Promise<string> {
  const [file = '', path = ''] = key.split(':');
  const [name = '', ...rest] = path.split('.');
  const module = (await import(`@/lib/fr/${file}`)) as Record<string, unknown>;
  let value: unknown = module[name];

  for (const step of rest) value = (value as Record<string, unknown>)[step];
  if (typeof value !== 'string') throw new Error(`${key} no longer resolves to a string`);

  return norm(value);
}

function served(container: HTMLElement): string {
  const attributes: string[] = [];

  container.querySelectorAll('*').forEach((element) => {
    for (const attribute of element.attributes) attributes.push(norm(attribute.value));
  });

  return `${norm(container.textContent)}\n${attributes.join('\n')}`;
}

describe('every lib/fr string the base pages rendered is still served', () => {
  const inventory = INVENTORY as unknown as Inventory;

  it('the exemption list is exactly the chips R1408 removes, each in the base inventory and deleted from lib/fr', async () => {
    for (const key of REMOVED_WITH_THE_CHIPS) {
      expect(inventory['lamal-empty']).toContain(key);
      await expect(resolve(key), key).rejects.toThrow();
    }
    expect(REMOVED_WITH_THE_CHIPS).toHaveLength(4);
  });

  it('the LAMal page, empty and with a result', async () => {
    const { container } = render(<ComparateurPage />);
    const empty = served(container);

    compareAdult();
    const withResult = served(container);

    for (const [state, page] of [
      ['lamal-empty', empty],
      ['lamal-result', withResult],
    ] as const) {
      const keys = inventory[state] ?? [];

      expect(keys.length, state).toBeGreaterThan(100);
      for (const key of keys) {
        if ((REMOVED_WITH_THE_CHIPS as readonly string[]).includes(key)) continue;
        expect(page.includes(await resolve(key)), `${state}: ${key}`).toBe(true);
      }
    }
  });

  it('the telework page', async () => {
    const { container } = render(<CalculateurPage />);
    const page = served(container);
    const keys = inventory['telework-empty'] ?? [];

    expect(keys.length).toBeGreaterThan(100);
    for (const key of keys) expect(page.includes(await resolve(key)), key).toBe(true);
  });
});
