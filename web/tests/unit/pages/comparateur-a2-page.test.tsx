// @vitest-environment jsdom
// web/tests/unit/pages/comparateur-a2-page.test.tsx
//
// /calculateur-lamal-cmu built to its approved A2 artboard
// (docs/design/comparateur-lamal-a2.dc.html) - FW-COMPARATEUR-A2-PAGE, W20,
// R1046-R1050. What a test can say about it:
//
//   - every section the artboard draws is in the page, by id, under its own
//     heading, and in the artboard's order;
//   - the chips under the head link to those sections, in BOTH directions -
//     every chip's target exists, and every section has a chip (R175: the
//     space between "declared" and "served");
//   - the figures the new sections state are DELIVERED from the data (R154),
//     and the copy module types none (R147);
//   - what the page never says (R673) holds over the WHOLE rendered page,
//     empty and with a result - not only over the result panel.
//
// The words are read from LAMAL_PAGE_COPY and LAMAL_COPY, never retyped
// (R171, R181).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ComparateurPage from '@/app/(public)/calculateur-lamal-cmu/page';
import { SECTION_ID } from '@/app/(public)/calculateur-lamal-cmu/section-ids';
import { COMPARATOR_PASS } from '@/lib/content/sources';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { LAMAL_PAGE_COPY } from '@/lib/fr/lamal-page';
import { formatWholePercent } from '@/lib/lamal/format';
import { COMPARATOR_YEARS } from '@/lib/lamal/years';
import { formatDate } from '@/lib/ui/core';
import { typedFiguresIn } from '../../support/typed-figures';

afterEach(cleanup);

const COPY = LAMAL_COPY;
const PAGE = LAMAL_PAGE_COPY;

/** The artboard's sections, in its order, each with the heading it carries. */
const SECTIONS: readonly { readonly id: string; readonly heading: string }[] = [
  { id: SECTION_ID.deadline, heading: COPY.deadline.heading },
  { id: SECTION_ID.final, heading: PAGE.final.heading },
  { id: SECTION_ID.family, heading: PAGE.family.heading },
  { id: SECTION_ID.scope, heading: PAGE.scope.heading },
  { id: SECTION_ID.france, heading: PAGE.france.heading },
  { id: SECTION_ID.switzerland, heading: PAGE.switzerland.heading },
  { id: SECTION_ID.limits, heading: COPY.limitsHeading },
  { id: SECTION_ID.sources, heading: PAGE.sources.heading },
];

/**
 * A node's text with its LAYOUT whitespace collapsed. ASCII only: `\s` would
 * also fold the no-break spaces French typography puts in the copy (R91), and
 * the comparison against the copy would then fail on a correct page.
 */
const text = (node: Element | null): string => (node?.textContent ?? '').replace(/[ \t\n\r]+/gu, ' ').trim();

function compareAdult(income: string): void {
  fireEvent.change(screen.getByLabelText(COPY.form.income.label), { target: { value: income } });
  fireEvent.change(screen.getByLabelText(COPY.form.persons.you), { target: { value: '1985' } });
  fireEvent.click(screen.getByRole('button', { name: COPY.form.submit }));
}

describe('the head, as the artboard sets it', () => {
  it('carries the pill, the long h1, the lead, then the banner', () => {
    const { container } = render(<ComparateurPage />);
    const h1 = container.querySelectorAll('h1');

    expect(h1).toHaveLength(1);
    expect(text(h1[0] ?? null)).toBe(PAGE.heading);
    // The pill is the tool's name, before the h1.
    const pill = h1[0]?.previousElementSibling ?? null;

    expect(text(pill)).toBe(COPY.title);
    expect(container.textContent).toContain(COPY.intro);

    const nav = container.querySelector('[data-on-this-page]');
    const banner = container.querySelector('[data-banner="irrevocable"]');

    expect(nav).not.toBeNull();
    // The chips sit in the head, before the banner, as drawn.
    expect(nav?.compareDocumentPosition(banner as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe('every section, by id, under its heading, in order', () => {
  it('renders each section exactly once, holding its own heading', () => {
    const { container } = render(<ComparateurPage />);

    for (const { id, heading } of SECTIONS) {
      const found = container.querySelectorAll(`[id="${id}"]`);

      expect(found, `#${id}`).toHaveLength(1);
      expect(text(found[0]?.querySelector('h2') ?? null), `#${id}'s heading`).toBe(heading);
    }
    expect(container.querySelectorAll(`[id="${SECTION_ID.compare}"]`)).toHaveLength(1);
  });

  it('keeps the artboard order: compare, deadline, final, family, scope, France, Suisse, limits, sources', () => {
    const { container } = render(<ComparateurPage />);
    const order = Object.values(SECTION_ID).map((id) => container.querySelector(`[id="${id}"]`));

    order.slice(1).forEach((node, index) => {
      const before = order[index];

      expect(before?.compareDocumentPosition(node as Node), `${String(before?.id)} before ${String(node?.id)}`).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
  });
});

describe('the chips (R1048)', () => {
  it('link to the sections that exist, and every section has a chip', () => {
    const { container } = render(<ComparateurPage />);
    const nav = screen.getByRole('navigation', { name: PAGE.onThisPage });
    const targets = [...nav.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');

    // Every chip is an in-page fragment whose target exists...
    for (const href of targets) {
      expect(href.startsWith('#'), href).toBe(true);
      expect(container.querySelector(`[id="${href.slice(1)}"]`), href).not.toBeNull();
    }
    // ...and every section the page declares has its chip.
    expect([...targets].sort()).toEqual(Object.values(SECTION_ID).map((id) => `#${id}`).sort());
  });
});

describe('the figures are delivered, never typed (R147, R154)', () => {
  it('states the newest year\'s rate and allowance in the France card, read from the data', () => {
    const newest = COMPARATOR_YEARS.reduce((a, b) => (b.year > a.year ? b : a));
    const { container } = render(<ComparateurPage />);
    const france = text(container.querySelector(`[id="${SECTION_ID.france}"]`));

    expect(france).toContain(
      PAGE.france.items(formatWholePercent(newest.ratePercent), formatWholePercent(newest.allowancePercentOfPass))[0],
    );
  });

  it('dates every source line from COMPARATOR_PASS', () => {
    const { container } = render(<ComparateurPage />);
    const date = formatDate(COMPARATOR_PASS);

    expect(text(container.querySelector(`[id="${SECTION_ID.sources}"]`))).toContain(PAGE.sources.lead(date));
    for (const line of [
      PAGE.deadlineSource(date),
      PAGE.final.source(date),
      PAGE.family.source(date),
      PAGE.scope.source(date),
      PAGE.france.source(date),
      PAGE.switzerland.source(date),
    ]) {
      expect(container.textContent).toContain(line);
    }
  });

  it('types no regulatory figure, no percentage and no age bound in lib/fr/lamal-page.ts', () => {
    const source = readFileSync(join(process.cwd(), 'lib', 'fr', 'lamal-page.ts'), 'utf8');
    // Full-line comments explain the rule and may name it; the strings may not.
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*\*)/u.test(line))
      .join('\n');

    expect(typedFiguresIn(code)).toEqual([]);
    expect(code).not.toMatch(/\d\s*%/u);
    expect(code).not.toMatch(/\d+\s*(?:à|a)\s*\d+\s*ans/u);
    // No amount of money in the static copy: R673's "a single LAMal figure".
    expect(code).not.toMatch(/\d[\d\s\p{Zs}]*(?:€|EUR|CHF)/u);
  });
});

describe('what the page never says (R673), over the whole page', () => {
  for (const state of ['empty', 'with a result'] as const) {
    it(`holds ${state}`, () => {
      const { container } = render(<ComparateurPage />);

      if (state === 'with a result') compareAdult('42000');

      const all = (container.textContent ?? '').toLowerCase();

      expect(all).not.toContain('recommand');
      // The OFSP numbers identify insurers in the data; none reaches the page.
      expect(container.textContent ?? '').not.toMatch(/\b1562\b|\b376\b/u);
    });
  }

  it('keeps the static sections free of any amount, in francs or euros', () => {
    const { container } = render(<ComparateurPage />);

    for (const id of [SECTION_ID.final, SECTION_ID.family, SECTION_ID.scope, SECTION_ID.france, SECTION_ID.switzerland, SECTION_ID.sources]) {
      const section = container.querySelector(`[id="${id}"]`);

      // PRESENCE FIRST (R169's corollary): an absent section holds no amount,
      // and that would read as a pass.
      expect(section, `#${id}`).not.toBeNull();
      expect(text(section).length, `#${id} has text`).toBeGreaterThan(0);
      expect(text(section), `#${id}`).not.toMatch(/\d[\d\s\p{Zs}]*(?:€|EUR|CHF)/u);
    }
  });
});

describe('Sources', () => {
  it('lists the artboard\'s rows and links to the site\'s full list', () => {
    const { container } = render(<ComparateurPage />);
    const sources = container.querySelector(`[id="${SECTION_ID.sources}"]`);

    expect(sources?.querySelectorAll('li')).toHaveLength(PAGE.sources.rows.length);
    for (const { name, what } of PAGE.sources.rows) {
      expect(text(sources)).toContain(name);
      expect(text(sources)).toContain(what);
    }

    const link = [...(sources?.querySelectorAll('a') ?? [])].find((a) => text(a) === PAGE.sources.allLink.text);

    expect(link?.getAttribute('href')).toBe(PAGE.sources.allLink.href);
  });
});
