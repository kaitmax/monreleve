// web/tests/unit/tokens/radius.test.ts
//
// Ruling R8(b): the radius scale is closed AT THE POINT OF DEFINITION.
// stylelint enforces token names at the point of use; this asserts that the
// names it permits are exactly the ones the token layer defines, with the
// documented values, and that no tenth name has crept in.
//
// It compiles the real tokens.scss rather than reading its text, so what is
// asserted is what the browser receives. A semantic alias, a typo or a
// stray value fails here.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const TOKENS = join(process.cwd(), 'lib', 'ui', 'core', 'styles', 'tokens.scss');

/** The nine, and their documented values. Ruling R8(b). */
const EXPECTED_RADIUS = {
  '--radius-xs': '4px',
  '--radius-checkbox': '6px',
  '--radius-sm': '8px',
  '--radius-md': '12px',
  '--radius-button-lg': '14px',
  '--radius-lg': '16px',
  '--radius-xl': '20px',
  '--radius-2xl': '24px',
  '--radius-pill': '999px',
} as const;

function compiledCustomProperties(): Map<string, string> {
  const { css } = compileString(readFileSync(TOKENS, 'utf8'), { loadPaths: [] });
  const found = new Map<string, string>();
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/g)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) found.set(name, value.trim());
  }
  return found;
}

describe('radius token definitions (ruling R8b)', () => {
  const properties = compiledCustomProperties();
  const radiusNames = [...properties.keys()].filter((name) => name.startsWith('--radius-')).sort();

  it('defines exactly the nine radius tokens and no others', () => {
    expect(radiusNames).toEqual(Object.keys(EXPECTED_RADIUS).sort());
  });

  for (const [name, value] of Object.entries(EXPECTED_RADIUS)) {
    it(`defines ${name} as ${value}`, () => {
      expect(properties.get(name)).toBe(value);
    });
  }

  it('holds the closed numeric set {4, 6, 8, 12, 14, 16, 20, 24, 999}', () => {
    const values = radiusNames
      .map((name) => Number.parseFloat(properties.get(name) ?? 'NaN'))
      .sort((a, b) => a - b);

    expect(values).toEqual([4, 6, 8, 12, 14, 16, 20, 24, 999]);
  });
});
