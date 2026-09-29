// web/tests/unit/content/nav-collapse.test.ts
//
// FW33, approved as H4: a disclosure left with ONE visible child renders as a
// plain link to that child, labelled with the child's own label. Opening a
// menu to find a single item is a wasted interaction, and a plural
// "Calculateurs" over one destination misnames it.
//
// BOTH DIRECTIONS, and the second is the one that matters. A collapse that
// always returned a link would pass the one-child case perfectly; only the
// two-child case can tell "collapses a lone child" from "flattens every menu".
//
// SYNTHETIC ENTRIES, as regulatory-gate.test.ts proves visibleNav, so no
// route-list parameter is needed. The collapse runs AFTER visibleNav and reads
// no registry itself: it is handed the entries that survived and decides their
// shape, nothing else.

import { describe, expect, it } from 'vitest';
import { CALCULATOR_PATH, collapseLoneDisclosures, visibleNav } from '@/lib/content/routes';
import { SHELL_NAV } from '@/lib/fr/shell';

const CALCULATOR = { label: 'Calculateur de télétravail', href: CALCULATOR_PATH };
const GUIDES = { label: 'Guides', href: '/guides' };

describe('collapseLoneDisclosures', () => {
  it('turns a disclosure with one child into a link to that child, under the child label', () => {
    const collapsed = collapseLoneDisclosures([{ label: 'Calculateurs', children: [CALCULATOR] }]);

    expect(collapsed).toEqual([CALCULATOR]);
  });

  it('keeps a disclosure with two children as a disclosure', () => {
    const menu = { label: 'Calculateurs', children: [CALCULATOR, GUIDES] };

    expect(collapseLoneDisclosures([menu])).toEqual([menu]);
  });

  it('leaves a plain link untouched', () => {
    expect(collapseLoneDisclosures([GUIDES])).toEqual([GUIDES]);
  });

  it('preserves the order of the entries around a collapsed one', () => {
    const entries = [{ label: 'Calculateurs', children: [CALCULATOR] }, GUIDES];

    expect(collapseLoneDisclosures(entries).map((entry) => entry.label)).toEqual([
      CALCULATOR.label,
      GUIDES.label,
    ]);
  });

  it('collapses the real Calculateurs menu today, because its second child is planned', () => {
    // THE SHIPPED STATE, pinned. /calculateur-lamal-cmu is `planned`, so
    // visibleNav leaves the menu one child and the header offers the
    // calculator by name. The day the comparator goes live this fails - and
    // the fix is to delete this test, because the menu is then correct again.
    const nav = collapseLoneDisclosures(visibleNav(SHELL_NAV));

    expect(nav.some((entry) => entry.children !== undefined)).toBe(false);
    expect(nav.find((entry) => entry.href === CALCULATOR_PATH)?.label).toBe(
      SHELL_NAV[0]?.children?.[0]?.label,
    );
  });
});
