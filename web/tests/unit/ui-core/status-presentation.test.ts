// web/tests/unit/ui-core/status-presentation.test.ts
//
// SPEC 6.2: "Every status carries icon + label + one-line explanation,
// identical on web, Android, and PDF."
// DESIGN-SYSTEM.md section 1: "STATUS IS NEVER COLOUR ALONE: colour + icon +
// text, always."
//
// So each Status needs four things, and a missing one is a defect rather than
// a gap to fill later. This suite enumerates the union and checks all four,
// and then checks the two kinds of name that would otherwise fail silently at
// FW8: a colour token that does not exist in the token layer, and a Lucide
// icon name that does not exist in lucide-react.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { compileString } from 'sass';
import { icons } from 'lucide-react';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { STATUS_PRESENTATION, ZONE_BAND_TOKEN } from '@/lib/ui/core/zones';
import type { Status, Zone } from '@/lib/ui/core/zones';

/** Two-way: adding a Status without adding it here is a compile error. */
const ALL_STATUSES = [
  'compliant',
  'mission-exposure',
  'regime-lost',
  'social-switch',
] as const;

const ALL_ZONES = ['compliant', 'fiscal-exposure', 'social-switch'] as const;

/** Every custom property the compiled token layer actually defines. */
function tokenNames(): Set<string> {
  const tokens = join(process.cwd(), 'lib', 'ui', 'core', 'styles', 'tokens.scss');
  const { css } = compileString(readFileSync(tokens, 'utf8'), {
    // loadPaths: tokens.scss @forwards _breakpoints.scss since R68, and
    // compileString cannot resolve that without a path.
    loadPaths: [dirname(tokens)],
  });

  return new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1] ?? ''));
}

/** 'circle-check' -> 'CircleCheck', which is how lucide-react keys its icons. */
const toPascal = (kebab: string): string =>
  kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

describe('the Status union is covered', () => {
  it('the literal list and the type agree in both directions', () => {
    expectTypeOf<(typeof ALL_STATUSES)[number]>().toEqualTypeOf<Status>();
    expectTypeOf<(typeof ALL_ZONES)[number]>().toEqualTypeOf<Zone>();
  });

  it('has a presentation entry for every status and no extras', () => {
    expect(Object.keys(STATUS_PRESENTATION).sort()).toEqual([...ALL_STATUSES].sort());
  });

  it('has a band token for every zone and no extras', () => {
    expect(Object.keys(ZONE_BAND_TOKEN).sort()).toEqual([...ALL_ZONES].sort());
  });
});

describe('every status carries all four properties', () => {
  for (const status of ALL_STATUSES) {
    describe(status, () => {
      const presentation = STATUS_PRESENTATION[status];

      it('has a French label', () => {
        expect(presentation.label).toBeTypeOf('string');
        expect(presentation.label.trim().length).toBeGreaterThan(0);
      });

      it('has a one-line French explanation', () => {
        expect(presentation.explanation.trim().length).toBeGreaterThan(0);
        // One line: SPEC 6.2 says one-line, and a paragraph in a badge is a
        // different component.
        expect(presentation.explanation).not.toContain('\n');
      });

      it('has a Lucide icon name', () => {
        expect(presentation.icon.trim().length).toBeGreaterThan(0);
      });

      it('has a colour token and a soft background token', () => {
        expect(presentation.colourToken).toMatch(/^--colour-/);
        expect(presentation.softColourToken).toMatch(/^--colour-/);
      });
    });
  }
});

describe('the names resolve to things that exist', () => {
  const defined = tokenNames();

  it('every colour token named by a status exists in the token layer', () => {
    // A token name that does not exist renders as nothing in CSS - no error,
    // no colour. This is the check that turns that into a test failure.
    const missing = ALL_STATUSES.flatMap((status) => {
      const { colourToken, softColourToken } = STATUS_PRESENTATION[status];

      return [colourToken, softColourToken].filter((token) => !defined.has(token));
    });

    expect(missing).toEqual([]);
  });

  it('every zone band token exists in the token layer', () => {
    const missing = ALL_ZONES.map((zone) => ZONE_BAND_TOKEN[zone]).filter(
      (token) => !defined.has(token),
    );

    expect(missing).toEqual([]);
  });

  it('every Lucide icon name exists in lucide-react', () => {
    // lucide-react keys its icons in PascalCase. A kebab name is what the
    // design system and the Android port both use, so zones.ts stores kebab
    // and this converts. A typo would otherwise render an empty badge.
    const missing = ALL_STATUSES
      .map((status) => STATUS_PRESENTATION[status].icon)
      .filter((icon) => !(toPascal(icon) in icons));

    expect(missing).toEqual([]);
  });

  it('the kebab-to-Pascal conversion is itself right', () => {
    // Guarding the guard: if the conversion were broken, the check above
    // would pass or fail for the wrong reason.
    expect(toPascal('circle-check')).toBe('CircleCheck');
    expect(toPascal('triangle-alert')).toBe('TriangleAlert');
    expect('CircleCheck' in icons).toBe(true);
    expect(toPascal('not-a-real-icon') in icons).toBe(false);
  });
});

describe('the Zone to band colour mapping (SPEC 6.2)', () => {
  it('maps the three bands to success, warning and error', () => {
    expect(ZONE_BAND_TOKEN.compliant).toBe('--colour-success');
    expect(ZONE_BAND_TOKEN['fiscal-exposure']).toBe('--colour-warning');
    expect(ZONE_BAND_TOKEN['social-switch']).toBe('--colour-error');
  });

  it('never carries a raw colour', () => {
    for (const zone of ALL_ZONES) {
      expect(ZONE_BAND_TOKEN[zone]).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
    for (const status of ALL_STATUSES) {
      expect(STATUS_PRESENTATION[status].colourToken).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });
});

describe('mission-exposure is the warning badge on the green band', () => {
  it('carries the warning colour, not the success one', () => {
    // SPEC 6.2's named oddity. Its ZONE is compliant (green rail); its BADGE
    // is a warning. If this ever became success, the badge would agree with
    // the rail and the exposure would be invisible.
    expect(STATUS_PRESENTATION['mission-exposure'].colourToken).toBe('--colour-warning');
    expect(ZONE_BAND_TOKEN.compliant).toBe('--colour-success');
  });
});

describe('the four statuses are actually distinguishable', () => {
  // A presence-only check is satisfied by a record where regime-lost and
  // social-switch carry identical copy, icon and colour - which is exactly
  // where the design system runs out of guidance, since SPEC 12 caps the
  // palette at three status tokens for four statuses. So colour ALONE cannot
  // separate them, and SPEC 12's monochrome-photocopy requirement plus
  // DESIGN-SYSTEM.md's "status is never colour alone" mean the label, the
  // explanation and the glyph each have to do it on their own.
  const unique = (values: readonly string[]) => new Set(values).size;

  it('gives every status its own label', () => {
    expect(unique(ALL_STATUSES.map((s) => STATUS_PRESENTATION[s].label))).toBe(
      ALL_STATUSES.length,
    );
  });

  it('gives every status its own explanation', () => {
    expect(unique(ALL_STATUSES.map((s) => STATUS_PRESENTATION[s].explanation))).toBe(
      ALL_STATUSES.length,
    );
  });

  it('gives every status its own icon', () => {
    // regime-lost and social-switch share --colour-error because only three
    // status colours exist. They must NOT also share a glyph: a badge that
    // looks identical for "you lost the tax regime" and "your social security
    // affiliation moves" flattens two different legal consequences into one
    // picture, and it makes FW8's "four badge states visually distinct"
    // unachievable by anything but the label.
    expect(unique(ALL_STATUSES.map((s) => STATUS_PRESENTATION[s].icon))).toBe(
      ALL_STATUSES.length,
    );
  });

  it('keeps the zone map and the status map as two separate objects', () => {
    // SPEC 6.2: the rail is coloured by Zone, never by Status. 'compliant'
    // and 'social-switch' are members of BOTH unions, so a single record
    // keyed on the bare literal would conflate the two axes and TypeScript
    // would not complain - the key types overlap.
    expect(ZONE_BAND_TOKEN).not.toBe(STATUS_PRESENTATION);
    expect(Object.keys(ZONE_BAND_TOKEN)).not.toEqual(Object.keys(STATUS_PRESENTATION));
  });
});
