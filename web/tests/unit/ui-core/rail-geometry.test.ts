// web/tests/unit/ui-core/rail-geometry.test.ts
//
// SPEC 6.3: "an 8 px pill track, filled from 0 to the declarable rate in the
// band colour, with two tick markers at 40 and 49.9 protruding 4 px above and
// below the bar, labelled in tabular figures."
//
// Geometry only - no SVG here. Every number the template will emit is
// computed and asserted first, because a wrong coordinate inside a string is
// invisible to every other check in the repo.
//
// THREE RULINGS SHAPE THIS FILE.
//
// R35 - the ceilings arrive as a PARAMETER, never as literals. lib/ui/core
// may not carry 40 or 49.9 (SPEC 7.7, and tests/unit/calc-engine/
// no-magic-thresholds.test.ts enforces it), and a 2028 rule set with a moved
// ceiling must move the tick. So railGeometry takes ZoneThresholds, exactly
// as zoneFor does, and the tick positions are derived from it.
//
// R39 - the two tick labels are anchored OUTWARD: "40 %" ends at its tick,
// "49,9 %" starts at its tick, so they extend away from each other and can
// never collide. Left-anchoring both, which is what the design briefs drew,
// collides below roughly 420 px of track - that is every phone, not merely
// the thumbnail.
//
// R40 - the rate label is declarableRate at TWO decimals. At one decimal a
// rate of 40.06 renders "40,0 %" beside an amber band; measured over 156 682
// engine results there are 80 such contradictions at one decimal and ZERO at
// two.
//
// BYTE DETERMINISM. Every emitted coordinate is rounded to three decimals.
// Measured: 376 * (49.9 / 100) is "187.624" but 376 * 49.9 / 100 is
// "187.62399999999997" - algebraically identical, four bytes apart. Rounding
// at the boundary makes the arithmetic ORDER irrelevant to the output, which
// is a stronger guarantee than fixing the order and hoping nobody reorders
// it. Increment 5's Node-versus-browser comparison cannot catch a reordering,
// because both sides run the same source.

import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';
import {
  COMPACT_MIN_WIDTH,
  SOCIAL_HEIGHT,
  SOCIAL_TRACK_HEIGHT,
  SOCIAL_WIDTH,
  TICK_PROTRUSION,
  TICK_WIDTH,
  TRACK_HEIGHT,
  railGeometry,
} from '@/lib/ui/core/rail/geometry';
import type { RailData } from '@/lib/ui/core/rail/geometry';

const RULES = ruleSetFor(2026);

const inline = (patch: Partial<RailData> = {}): RailData => ({
  percentage: 0,
  zone: 'compliant',
  width: 376,
  height: TRACK_HEIGHT,
  variant: 'inline',
  ...patch,
});

describe('the constants mirror their tokens rather than inventing values', () => {
  it('uses the 8 px track and the 4 px protrusion SPEC 6.3 states', () => {
    expect(TRACK_HEIGHT).toBe(8);
    expect(TICK_PROTRUSION).toBe(4);
  });

  it('derives the pill radius from the height, so no radius literal exists', () => {
    // A pill on an 8 px bar IS rx = height / 2. Writing 4 would be a radius
    // literal (DESIGN-SYSTEM.md 4.1 closes the radius set); deriving it means
    // a change to the track height carries the corner with it.
    expect(railGeometry(inline(), RULES).track.rx).toBe(TRACK_HEIGHT / 2);
  });
});

describe('the track and the fill', () => {
  it('spans the requested width at the requested height', () => {
    const g = railGeometry(inline({ width: 376 }), RULES);

    expect(g.track.x).toBe(0);
    expect(g.track.width).toBe(376);
    expect(g.track.height).toBe(TRACK_HEIGHT);
  });

  it('draws no fill at 0 %', () => {
    expect(railGeometry(inline({ percentage: 0 }), RULES).fill.width).toBe(0);
  });

  it('fills the whole track at 100 %', () => {
    expect(railGeometry(inline({ percentage: 100, width: 376 }), RULES).fill.width).toBe(376);
  });

  it('fills proportionally at 34.58 %', () => {
    // 376 * 34.58 / 100 = 130.0208, rounded to three decimals.
    expect(railGeometry(inline({ percentage: 34.58, width: 376 }), RULES).fill.width).toBe(130.021);
  });

  it('rounds every coordinate to three decimals, whatever the arithmetic order', () => {
    // The measured hazard: 376 * (49.9 / 100) and 376 * 49.9 / 100 differ in
    // the fourteenth decimal and therefore in the emitted bytes.
    const g = railGeometry(inline({ percentage: 49.9, width: 376 }), RULES);

    expect(String(g.fill.width)).toBe('187.624');
    expect(String(g.fill.width).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });
});

describe('the two ticks come from the RuleSet (R35)', () => {
  it('places them at the fiscal and social ceilings', () => {
    const g = railGeometry(inline({ width: 1000 }), RULES);

    // 1000 px of track, ceilings at 0.4 and 0.499 -> 400 and 499.
    expect(g.ticks[0].percentage).toBe(RULES.fiscalCeiling * 1e2);
    expect(g.ticks[1].percentage).toBe(RULES.socialCeiling * 1e2);
    expect(g.ticks[0].x).toBe(400 - TICK_WIDTH / 2);
    expect(g.ticks[1].x).toBe(499 - TICK_WIDTH / 2);
  });

  it('moves the ticks when the rule set moves', () => {
    // The whole point of taking thresholds as a parameter: a 2028 rule set
    // with a different ceiling must move the tick, and a hardcoded 40 could
    // not. If this passes with the tick unmoved, the ceiling is hardcoded.
    const shifted = { fiscalCeiling: 0.5, socialCeiling: 0.6 };
    const g = railGeometry(inline({ width: 1000 }), shifted);

    expect(g.ticks[0].x).toBe(500 - TICK_WIDTH / 2);
    expect(g.ticks[1].x).toBe(600 - TICK_WIDTH / 2);
  });

  it('protrudes 4 px above and below the bar', () => {
    const g = railGeometry(inline(), RULES);

    expect(g.ticks[0].y).toBe(g.track.y - TICK_PROTRUSION);
    expect(g.ticks[0].height).toBe(TRACK_HEIGHT + TICK_PROTRUSION * 2);
  });
});

describe('tick labels are anchored outward (R39)', () => {
  it('ends the fiscal label at its tick and starts the social label at its', () => {
    const g = railGeometry(inline({ width: 1000 }), RULES);

    expect(g.ticks[0].labelAnchor).toBe('end');
    expect(g.ticks[0].labelX).toBe(400);
    expect(g.ticks[1].labelAnchor).toBe('start');
    expect(g.ticks[1].labelX).toBe(499);
  });

  it('keeps the labels apart at the 200 px thumbnail width', () => {
    // Measured at Caption 13/400 with tabular figures: "40 %" is 33.125 px
    // and "49,9 %" is 45.047 px, while the ticks at 200 px sit 19.8 px apart.
    // Left-anchoring both overlaps by 13 px. Anchored outward they diverge,
    // so the only thing that can collide is each label with the edge.
    const g = railGeometry(inline({ width: COMPACT_MIN_WIDTH }), RULES);

    expect(g.ticks[0].labelAnchor).toBe('end');
    expect(g.ticks[1].labelAnchor).toBe('start');
    expect(g.ticks[1].labelX).toBeGreaterThan(g.ticks[0].labelX);
  });
});

describe('clamping bounds the geometry and never the label (AC3)', () => {
  it('clamps a negative rate to an empty fill and reports it', () => {
    const g = railGeometry(inline({ percentage: -5 }), RULES);

    expect(g.fill.width).toBe(0);
    expect(g.clampedFill).toBe(true);
    // The label is the truth: geometry carries the value through untouched
    // so the renderer can format the REAL number.
    expect(g.percentage).toBe(-5);
  });

  it('clamps an over-100 rate to a full fill and reports it', () => {
    const g = railGeometry(inline({ percentage: 140, width: 376 }), RULES);

    expect(g.fill.width).toBe(376);
    expect(g.clampedFill).toBe(true);
    expect(g.percentage).toBe(140);
  });

  it('does not report clamping for a rate inside the track', () => {
    expect(railGeometry(inline({ percentage: 60 }), RULES).clampedFill).toBe(false);
    expect(railGeometry(inline({ percentage: 0 }), RULES).clampedFill).toBe(false);
    expect(railGeometry(inline({ percentage: 100 }), RULES).clampedFill).toBe(false);
  });
});

describe('the variants', () => {
  it('inline takes its width from RailData and carries NO band names (R45)', () => {
    // R45 moved them out of the SVG entirely for inline and compact: the
    // React wrapper renders them as an HTML legend, where a font can measure
    // and wrap them. Centring them here could not work - "Imposition France"
    // is 93,7 px over a band 9,9 % of the track wide.
    const g = railGeometry(inline({ width: 500 }), RULES);

    expect(g.svgWidth).toBe(500);
    expect(g.bandNamesShown).toBe(false);
    expect(g.bandNameRows).toEqual([]);
  });

  it('social keeps them, as a left-anchored stack below the rail (R45)', () => {
    const g = railGeometry(inline({ variant: 'social', width: 0 }), RULES);

    expect(g.bandNamesShown).toBe(true);
    expect(g.bandNameRows.map((row) => row.zone)).toEqual([
      'compliant',
      'fiscal-exposure',
      'social-switch',
    ]);
    // Below the tick labels, one line apart, all at the same left edge.
    expect(g.bandNameX).toBe(g.track.x);
    const ys = g.bandNameRows.map((row) => row.y);
    expect(Math.min(...ys)).toBeGreaterThan(g.ticks[0].labelY);
    expect(ys[1]! - ys[0]!).toBe(ys[2]! - ys[1]!);
  });

  it('compact drops the band names and enforces a 200 px minimum', () => {
    const narrow = railGeometry(inline({ variant: 'compact', width: 120 }), RULES);

    expect(narrow.svgWidth).toBe(COMPACT_MIN_WIDTH);
    expect(narrow.clampedWidth).toBe(true);
    expect(narrow.bandNamesShown).toBe(false);
  });

  it('compact leaves a wide enough request alone', () => {
    const wide = railGeometry(inline({ variant: 'compact', width: 400 }), RULES);

    expect(wide.svgWidth).toBe(400);
    expect(wide.clampedWidth).toBe(false);
  });

  it('social is 1200 x 630 with the rail at 80 % of the width, centred (R48)', () => {
    const g = railGeometry(inline({ variant: 'social', width: 0 }), RULES);

    expect(g.svgWidth).toBe(SOCIAL_WIDTH);
    expect(g.svgHeight).toBe(SOCIAL_HEIGHT);
    expect(g.track.width).toBe(SOCIAL_WIDTH * 0.8);
    expect(g.track.x).toBe((SOCIAL_WIDTH - SOCIAL_WIDTH * 0.8) / 2);
    expect(g.bandNamesShown).toBe(true);
  });

  it('doubles the social track height, and only there (R48)', () => {
    // A documented exception to "progress bars, never taller than 8": that
    // rule governs a bar inside a UI, and the social card is a raster seen at
    // thumbnail size, where 8 px is a hairline.
    const social = railGeometry(inline({ variant: 'social', width: 0 }), RULES);

    expect(social.track.height).toBe(SOCIAL_TRACK_HEIGHT);
    expect(social.track.rx).toBe(SOCIAL_TRACK_HEIGHT / 2);
    expect(railGeometry(inline(), RULES).track.height).toBe(TRACK_HEIGHT);
    expect(railGeometry(inline({ variant: 'compact', width: 300 }), RULES).track.height).toBe(
      TRACK_HEIGHT,
    );
  });

  it('divides the social track into three band segments (R48)', () => {
    const g = railGeometry(inline({ variant: 'social', width: 0 }), RULES);

    expect(g.bandSegments.map((s) => s.zone)).toEqual([
      'compliant',
      'fiscal-exposure',
      'social-switch',
    ]);
    // They tile the track exactly: no gap, no overlap, no overhang.
    const total = g.bandSegments.reduce((sum, s) => sum + s.width, 0);
    expect(total).toBeCloseTo(g.track.width, 3);
    expect(g.bandSegments[0]!.x).toBe(g.track.x);
    for (let i = 1; i < g.bandSegments.length; i++) {
      const previous = g.bandSegments[i - 1]!;
      expect(g.bandSegments[i]!.x).toBeCloseTo(previous.x + previous.width, 3);
    }
  });

  it('derives the segments from the RuleSet, not from constants (R48)', () => {
    // The same requirement as the ticks: a rule set that moves a ceiling must
    // move the boundary between the coloured bands.
    const shifted = railGeometry(inline({ variant: 'social', width: 0 }), {
      fiscalCeiling: 0.5,
      socialCeiling: 0.6,
    });

    expect(shifted.bandSegments[0]!.width).toBeCloseTo(shifted.track.width * 0.5, 3);
    expect(shifted.bandSegments[1]!.width).toBeCloseTo(shifted.track.width * 0.1, 3);
  });

  it('gives no band segments to inline or compact', () => {
    expect(railGeometry(inline(), RULES).bandSegments).toEqual([]);
    expect(railGeometry(inline({ variant: 'compact', width: 300 }), RULES).bandSegments).toEqual([]);
  });

  it('derives a total height that leaves room for ticks and labels', () => {
    // SPEC 6.3's comment says "track height 8; total including ticks 16", but
    // 16 accounts for the bar and its protrusions only - not the rate above
    // or the labels below. The total is derived and exposed rather than
    // assumed.
    const g = railGeometry(inline(), RULES);

    expect(g.svgHeight).toBeGreaterThan(TRACK_HEIGHT + TICK_PROTRUSION * 2);
    expect(g.ticks[0].labelY).toBeLessThan(g.svgHeight);
  });

  it('makes inline and compact the same SHAPE after R45', () => {
    // Worth pinning, because it is a consequence rather than a goal: once the
    // band names left the SVG, the only thing separating the two variants is
    // the 200 px minimum. Their visible difference now lives in the React
    // wrapper, which draws the legend for inline only.
    const a = railGeometry(inline({ width: 400 }), RULES);
    const b = railGeometry(inline({ variant: 'compact', width: 400 }), RULES);

    expect(b.svgHeight).toBe(a.svgHeight);
    expect(b.track).toEqual(a.track);
  });
});

describe('a non-finite rate is refused here too (R33)', () => {
  it('throws rather than computing a NaN coordinate', () => {
    // A NaN width in an SVG attribute is not an error anywhere - it renders
    // nothing, silently, on a document that reports a tax position.
    expect(() => railGeometry(inline({ percentage: Number.NaN }), RULES)).toThrow(RangeError);
    expect(() => railGeometry(inline({ percentage: Number.POSITIVE_INFINITY }), RULES)).toThrow(
      RangeError,
    );
  });

  it('refuses a width that cannot produce a track', () => {
    expect(() => railGeometry(inline({ width: Number.NaN }), RULES)).toThrow(RangeError);
    expect(() => railGeometry(inline({ width: 0 }), RULES)).toThrow(RangeError);
    expect(() => railGeometry(inline({ width: -10 }), RULES)).toThrow(RangeError);
  });
});
