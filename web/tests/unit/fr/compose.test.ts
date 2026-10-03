// web/tests/unit/fr/compose.test.ts
//
// The shared French-composition helpers (R206). Moved here from private copies
// in releve-annuel.ts (cardinal) and tarifs.ts (frenchList); this is their
// first direct test. The releve/tarifs copy tests stay green because the moved
// helpers produce identical output - that is the move being correct.

import { describe, expect, it } from 'vitest';
import { cardinal, frenchList, n } from '@/lib/fr/compose';

const NBSP = String.fromCharCode(0x00a0);

describe('n() - the French no-break space (R91)', () => {
  it('puts U+00A0 before the mark', () => {
    expect(n(':')).toBe(`${NBSP}:`);
    expect(n('?')).toBe(`${NBSP}?`);
  });
});

describe('cardinal() - a small count in words', () => {
  it('writes one by gender', () => {
    expect(cardinal(1, 'un')).toBe('Un');
    expect(cardinal(1, 'une')).toBe('Une');
  });

  it('is gender-invariant from two to ten, and capitalised', () => {
    expect(cardinal(2, 'un')).toBe('Deux');
    expect(cardinal(2, 'une')).toBe('Deux');
    expect(cardinal(6, 'une')).toBe('Six');
    expect(cardinal(7, 'un')).toBe('Sept');
    expect(cardinal(10, 'un')).toBe('Dix');
  });

  it('falls back to the numeral above ten, so an unexpected range reads oddly rather than crashes', () => {
    expect(cardinal(11, 'un')).toBe('11');
    expect(cardinal(0, 'un')).toBe('0');
  });
});

describe('frenchList() - A / A et B / A, B et C', () => {
  it('joins with the comma only on three or more', () => {
    expect(frenchList([])).toBe('');
    expect(frenchList(['admin.ch'])).toBe('admin.ch');
    expect(frenchList(['admin.ch', 'ge.ch'])).toBe('admin.ch et ge.ch');
    expect(frenchList(['admin.ch', 'ge.ch', 'CLEISS'])).toBe('admin.ch, ge.ch et CLEISS');
  });
});
