// web/tests/unit/ui-core/rail-tokens.test.ts
//
// The rail's geometry is numbers, not var() references, because a var() in an
// SVG geometry attribute collapses to ZERO when no cascade is present and the
// track vanishes silently (measured in this repo's Chromium). That decision
// is right, and it opens a hole: SPEC 20 Never forbids hardcoding "a colour,
// spacing, radius, or font size outside the token set", and nothing in this
// repo can see a number inside a TypeScript file the way stylelint sees one
// inside SCSS.
//
// This closes it. A number PROVED equal to its token is a checked mirror; an
// unchecked one is a hardcoded value. tests/unit/tokens/radius.test.ts
// already uses the pattern for the radius set - compile the real token layer
// and compare against it, so the two cannot drift.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';
import {
  CAPTION_SIZE,
  DISPLAY_SIZE,
  H2_SIZE,
  MICRO_SIZE,
  TICK_PROTRUSION,
  TICK_WIDTH,
  TRACK_HEIGHT,
} from '@/lib/ui/core/rail/geometry';

/** Every custom property the compiled token layer actually defines. */
function tokens(): Record<string, string> {
  const source = join(process.cwd(), 'lib', 'ui', 'core', 'styles', 'tokens.scss');
  const { css } = compileString(readFileSync(source, 'utf8'));
  const found: Record<string, string> = {};

  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/g)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) found[name] = value.trim();
  }

  return found;
}

const pixels = (value: string): number => Number(value.replace('px', ''));

describe('the rail geometry constants mirror real tokens', () => {
  const defined = tokens();

  it('finds the token layer at all, so the comparisons below cannot pass vacuously', () => {
    expect(Object.keys(defined).length).toBeGreaterThan(0);
    expect(defined['--size-progress-height']).toBeDefined();
    expect(defined['--space-1']).toBeDefined();
  });

  it('TRACK_HEIGHT equals --size-progress-height', () => {
    // SPEC 6.3's "8 px pill track" and the design system's progress height
    // are the same 8, and this is what keeps them the same 8.
    expect(TRACK_HEIGHT).toBe(pixels(defined['--size-progress-height'] ?? ''));
  });

  it('TICK_PROTRUSION equals --space-1', () => {
    // SPEC 6.3's "protruding 4 px above and below".
    expect(TICK_PROTRUSION).toBe(pixels(defined['--space-1'] ?? ''));
  });

  it('every font size used for a baseline mirrors its type token', () => {
    // The rail places a baseline at rowTop + the step's SIZE, so these four
    // numbers are geometry even though they are type values - and a var()
    // cannot be used, because the baseline is arithmetic. Mirrored, therefore,
    // exactly like the track height.
    expect(CAPTION_SIZE).toBe(pixels(defined['--type-caption-size'] ?? ''));
    expect(MICRO_SIZE).toBe(pixels(defined['--type-micro-size'] ?? ''));
    expect(DISPLAY_SIZE).toBe(pixels(defined['--type-display-size'] ?? ''));
    expect(H2_SIZE).toBe(pixels(defined['--type-h2-size'] ?? ''));
  });

  it('records that TICK_WIDTH has no token, rather than pretending it does', () => {
    // 1.5 px is not in the spacing scale and no token carries it: it comes
    // from the FW7 brief, and a design brief elsewhere draws 2 px. Asserting
    // the ABSENCE keeps that honest - if a token for it ever appears, this
    // test fails and the constant should become a mirror like the two above.
    const spacingValues = Object.entries(defined)
      .filter(([name]) => name.startsWith('--space-'))
      .map(([, value]) => pixels(value));

    expect(spacingValues).not.toContain(TICK_WIDTH);
    expect(TICK_WIDTH).toBe(1.5);
  });
});
