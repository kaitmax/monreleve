// web/lib/ui/core/rail/geometry.ts
//
// Every number the rail draws, computed before any string exists.
//
// SPEC 6.3: "an 8 px pill track, filled from 0 to the declarable rate in the
// band colour, with two tick markers at 40 and 49.9 protruding 4 px above and
// below the bar, labelled in tabular figures."
//
// WHY GEOMETRY IS NUMBERS AND NOT TOKENS, when colour and type are tokens.
// Measured in this repo's own Chromium: an SVG attribute referencing a custom
// property resolves when a cascade is present - fill var(--colour-success)
// gives rgb(21,128,61), font-size var(--type-caption-size) gives 13px, and so
// do rx, width and height. Without a cascade (a rasterised or standalone SVG)
// they degrade very differently: fill goes BLACK and font-size goes 16px -
// wrong but visible - while height goes to ZERO and the track VANISHES with
// no error at all. A silently invisible rail on a document filed with an
// administration is the worst outcome available, so nothing structural is
// allowed to depend on a cascade. Colour and type do, geometry does not.
//
// The numbers below are therefore not hardcoded values but CHECKED MIRRORS:
// tests/unit/ui-core/rail-tokens.test.ts compiles tokens.scss and asserts
// TRACK_HEIGHT equals --size-progress-height and TICK_PROTRUSION equals
// --space-1. A number proved equal to its token is a mirror; an unchecked one
// is a hardcoded value, and DESIGN-SYSTEM.md 4.1 already uses this pattern for
// the radius set.
//
// RULING R35. The two ceilings arrive as a PARAMETER. lib/ui/core may not
// carry 40 or 49.9 - SPEC 7.7 makes RuleSet their only home - and a later
// rule set that moves a ceiling has to move the tick. zoneFor already takes
// ZoneThresholds for exactly this reason, so the rail takes the same type.
//
// BYTE DETERMINISM. Every emitted coordinate is rounded to three decimals.
// Measured: 376 * (49.9 / 100) is "187.624" while 376 * 49.9 / 100 is
// "187.62399999999997" - algebraically identical, four bytes apart, and a
// Node-versus-browser comparison cannot catch the difference because both
// sides run the same source. Rounding at the boundary makes the arithmetic
// order irrelevant to the bytes.

import type { Zone, ZoneThresholds } from '../zones';

/** SPEC 6.3's 8 px track. Mirrors --size-progress-height. */
export const TRACK_HEIGHT = 8;

/** SPEC 6.3's "protruding 4 px above and below". Mirrors --space-1. */
export const TICK_PROTRUSION = 4;

/**
 * The tick's own thickness. Not a token and not in SPEC 6.3 - it comes from
 * the FW7 brief. A design brief elsewhere draws 2 px; recorded in the report
 * as a discrepancy rather than silently picked.
 */
export const TICK_WIDTH = 1.5;

/** The compact variant is unreadable narrower than this. */
export const COMPACT_MIN_WIDTH = 200;

/** SPEC 6.3: "The `social` variant is 1200 x 630". */
export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;

/** The social card's rail spans 60 % of the card and is centred. */
const SOCIAL_RAIL_FRACTION = 0.6;

/** Micro 11/14 for the band names, Caption 13/18 for the tick labels. */
const BAND_NAME_LINE = 14;
const LABEL_LINE = 18;

/** One --space-1 between each stacked row. */
const ROW_GAP = 4;

/** Fraction to percentage, and the rounding scale, in exponential form (R17). */
const PERCENT = 1e2;
const ROUND_SCALE = 1e3;

/** SPEC 6.3's RailData, unchanged. R35 passes thresholds separately. */
export interface RailData {
  readonly percentage: number;
  readonly zone: Zone;
  readonly width: number;
  readonly height: number;
  readonly variant: 'inline' | 'compact' | 'social';
}

export interface RailRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rx: number;
}

export interface RailTick {
  /** The ceiling this tick marks, as a percentage. From the RuleSet. */
  readonly percentage: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Where the label's anchor sits - AT the tick, per R39. */
  readonly labelX: number;
  readonly labelY: number;
  /** R39: the fiscal label ends at its tick, the social label starts at its. */
  readonly labelAnchor: 'start' | 'end';
}

export interface RailGeometry {
  readonly svgWidth: number;
  readonly svgHeight: number;
  readonly track: RailRect;
  readonly fill: RailRect;
  readonly ticks: readonly [RailTick, RailTick];
  /** The rate as given, never clamped - the label is the truth. */
  readonly percentage: number;
  /** True when the rate fell outside 0..100 and the FILL was bounded. */
  readonly clampedFill: boolean;
  /** True when a compact request narrower than the minimum was widened. */
  readonly clampedWidth: boolean;
  readonly bandNamesShown: boolean;
  readonly bandNameBaselineY: number;
  readonly rateBaselineY: number;
}

/** Three decimals, so the arithmetic order cannot change the bytes. */
const round = (value: number): number => Math.round(value * ROUND_SCALE) / ROUND_SCALE;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high);

function requireFinite(value: number, what: string): void {
  if (!Number.isFinite(value)) {
    // A NaN in an SVG coordinate is not an error anywhere: the shape simply
    // does not render, silently, on a document that reports a tax position.
    throw new RangeError(`railGeometry needs a finite ${what}, received ${value}`);
  }
}

/**
 * Everything the template needs, from RailData and the year's ceilings.
 *
 * Clamping bounds the GEOMETRY and never the value: a rate of -5 draws an
 * empty track and a rate of 140 draws a full one, while `percentage` carries
 * the real number through for the label. The label is the truth.
 */
export function railGeometry(data: RailData, thresholds: ZoneThresholds): RailGeometry {
  requireFinite(data.percentage, 'percentage');
  requireFinite(data.width, 'width');

  const social = data.variant === 'social';
  const compact = data.variant === 'compact';

  const requestedWidth = social ? SOCIAL_WIDTH : data.width;
  if (requestedWidth <= 0) {
    throw new RangeError(`railGeometry needs a positive width, received ${data.width}`);
  }

  const clampedWidth = compact && requestedWidth < COMPACT_MIN_WIDTH;
  const svgWidth = clampedWidth ? COMPACT_MIN_WIDTH : requestedWidth;

  const trackWidth = round(social ? svgWidth * SOCIAL_RAIL_FRACTION : svgWidth);
  const trackX = round(social ? (svgWidth - trackWidth) / 2 : 0);

  const bandNamesShown = !compact;

  // Rows, top to bottom: band names, the bar with its protrusions, the tick
  // labels. The bar's own row is TRACK_HEIGHT plus a protrusion each side.
  const bandNameRow = bandNamesShown ? BAND_NAME_LINE + ROW_GAP : 0;
  const barRow = TRACK_HEIGHT + TICK_PROTRUSION * 2;
  const labelRow = ROW_GAP + LABEL_LINE;
  const stackHeight = bandNameRow + barRow + labelRow;

  const svgHeight = social ? SOCIAL_HEIGHT : stackHeight;
  // On the social card the whole stack is centred vertically; elsewhere it
  // starts at the top.
  const stackTop = social ? round((SOCIAL_HEIGHT - stackHeight) / 2) : 0;

  const trackY = round(stackTop + bandNameRow + TICK_PROTRUSION);
  const rx = TRACK_HEIGHT / 2;

  const fillFraction = clamp(data.percentage, 0, PERCENT) / PERCENT;
  const clampedFill = data.percentage < 0 || data.percentage > PERCENT;

  const track: RailRect = {
    x: trackX,
    y: trackY,
    width: trackWidth,
    height: TRACK_HEIGHT,
    rx,
  };

  const fill: RailRect = {
    x: trackX,
    y: trackY,
    width: round(trackWidth * fillFraction),
    height: TRACK_HEIGHT,
    rx,
  };

  const labelBaselineY = round(trackY + TRACK_HEIGHT + TICK_PROTRUSION + ROW_GAP + LABEL_LINE);

  const tickAt = (ceilingFraction: number, anchor: 'start' | 'end'): RailTick => {
    const percentage = ceilingFraction * PERCENT;
    const centre = round(trackX + trackWidth * (percentage / PERCENT));

    return {
      percentage,
      x: round(centre - TICK_WIDTH / 2),
      y: round(trackY - TICK_PROTRUSION),
      width: TICK_WIDTH,
      height: TRACK_HEIGHT + TICK_PROTRUSION * 2,
      // R39: the anchor sits ON the tick and the text runs away from the
      // other label. Left-anchoring both collides below about 420 px of
      // track, which is every phone.
      labelX: centre,
      labelY: labelBaselineY,
      labelAnchor: anchor,
    };
  };

  return {
    svgWidth,
    svgHeight,
    track,
    fill,
    ticks: [tickAt(thresholds.fiscalCeiling, 'end'), tickAt(thresholds.socialCeiling, 'start')],
    percentage: data.percentage,
    clampedFill,
    clampedWidth,
    bandNamesShown,
    bandNameBaselineY: round(stackTop + BAND_NAME_LINE),
    rateBaselineY: labelBaselineY,
  };
}
