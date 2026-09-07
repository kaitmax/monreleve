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

/**
 * The social card's track, ruling R48. A DOCUMENTED EXCEPTION to
 * DESIGN-SYSTEM.md's "progress bars, never taller than 8".
 *
 * That rule governs a progress bar inside a UI, where 8 px sits correctly
 * against Body text. The social variant is not UI: it is a 1200 x 630 raster
 * that will be seen as a thumbnail in a feed, where an 8 px bar is a hairline
 * and effectively invisible. Doubling it is the exception, it applies to this
 * variant ONLY, and no other variant may read this constant.
 */
export const SOCIAL_TRACK_HEIGHT = 16;

/** SPEC 6.3's "protruding 4 px above and below". Mirrors --space-1. */
export const TICK_PROTRUSION = 4;

/**
 * The tick's own thickness. Not a token, and not in SPEC 6.3, which states a
 * protrusion but no thickness.
 *
 * RULING R46 set it to 2, superseding R42's 1,5. The deciding evidence was
 * the device pixel grid rather than the design briefs: at 1,5 px the two
 * ticks rendered ASYMMETRICALLY FROM EACH OTHER in the 200 px baseline - one
 * a symmetric grey pair at alpha 192, the other alpha 243 then 141 - because
 * a 1,5 px rect lands on a half-pixel wherever its centre falls. Two marks
 * that are supposed to be identical looking different is a defect in the one
 * element that has to read as authoritative. 2 px sits on the grid.
 *
 * Still no token, and rail-tokens.test.ts still asserts its ABSENCE from the
 * spacing scale, so the gap stays visible.
 */
export const TICK_WIDTH = 2;

/** The compact variant is unreadable narrower than this. */
export const COMPACT_MIN_WIDTH = 200;

/** SPEC 6.3: "The `social` variant is 1200 x 630". */
export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;

/** R48: the social card's rail spans 80 % of the card and is centred. */
const SOCIAL_RAIL_FRACTION = 0.8;

/** Micro 11/14 for the band names, Caption 13/18 for the tick labels. */
const BAND_NAME_LINE = 14;
const LABEL_LINE = 18;

/** R48: Body 15/22 for the social card's tick labels. */
const SOCIAL_LABEL_LINE = 22;

/** Caption 13/18 for the rate. R44 removed the Display-size social rate. */
const RATE_LINE_INLINE = 18;

/** H2 24/32 for the product name, social card only. */
const PRODUCT_NAME_LINE = 32;

/**
 * The font SIZES of those same steps, mirrored from --type-*-size and proved
 * equal to them in rail-tokens.test.ts.
 *
 * A baseline is placed at rowTop + size rather than at the row's bottom edge.
 * Putting it at the bottom is the obvious arithmetic and it clips every
 * descender: the first render had the tick-label baseline at y = 78 in a
 * 78-tall SVG, so the comma of "49,9 %" was cut off. Using the size as the
 * ascent over-allocates slightly, which is the safe direction.
 */
export const CAPTION_SIZE = 13;
export const MICRO_SIZE = 11;
export const H2_SIZE = 24;
/** R48: the social card's tick labels are Body, not Caption. */
export const BODY_SIZE = 15;

/** One --space-1 between each stacked row. */
const ROW_GAP = 4;

/** Top to bottom, the order the bands appear in and are stacked in. */
const BAND_ORDER: readonly Zone[] = ['compliant', 'fiscal-exposure', 'social-switch'];

/** Fraction to percentage, and the rounding scale, in exponential form (R17). */
const PERCENT = 1e2;
const ROUND_SCALE = 1e3;

/**
 * SPEC 6.3's RailData, unchanged. R35 passes thresholds separately.
 *
 * FOR THE SOCIAL VARIANT, percentage AND zone ARE IGNORED - ruling R44. That
 * card is generic and never per-result, so it carries no rate, no fill and no
 * band colour, and there is nothing for either field to affect.
 *
 * They are ignored rather than made optional, and the reason is that the
 * alternative is worse. Marking them optional would split RailData into a
 * union, change the shape SPEC 6.3 states, and push a discriminated check into
 * every caller - to express something the caller does not need to know. The
 * honest guarantee is not a type here, it is a TEST: rail-render.test.ts
 * renders social twice with wildly different rates and zones and requires the
 * two strings to be byte-identical. A comment can rot; that cannot.
 */
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

export interface RailBandRow {
  readonly zone: Zone;
  readonly y: number;
}

/**
 * One coloured segment of the track, ruling R48.
 *
 * The social card fills its whole track with the three BANDS rather than with
 * a rate: success up to the fiscal ceiling, warning between the ceilings,
 * error above the social one. Nothing per-result is encoded - there is no
 * rate on that card - and the bands ARE the zones, so this does not breach
 * "coloured by Zone, positioned by rate": there is no position to take.
 *
 * Empty for every other variant, which fills from 0 to the rate instead.
 */
export interface RailBandSegment {
  readonly zone: Zone;
  readonly x: number;
  readonly width: number;
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
  /**
   * RULING R45: only the social card carries band names inside the SVG, and
   * there they are a LEFT-ANCHORED VERTICAL STACK below the rail - one line
   * each, no centring. inline and compact carry none at all; the React
   * wrapper renders them as an HTML legend, where a font can measure them.
   */
  readonly bandNamesShown: boolean;
  readonly bandNameX: number;
  /**
   * One row per band, top to bottom, already PAIRED with its Zone. Empty
   * unless bandNamesShown.
   *
   * Paired here rather than zipped in the renderer on purpose: two parallel
   * arrays joined by index need an undefined check under
   * noUncheckedIndexedAccess, and that check is unreachable - which shows up
   * immediately as a branch lib/ui/core's 100 % gate cannot cover. Emitting
   * the pairs removes the indexing instead of testing an impossible case.
   */
  readonly bandNameRows: readonly RailBandRow[];
  /** R48: the three static band fills. Social only; empty elsewhere. */
  readonly bandSegments: readonly RailBandSegment[];
  /** R44: the social card shows no rate, so this is unused there. */
  readonly rateShown: boolean;
  readonly rateBaselineY: number;
  /** The social card names the product; the other variants do not. */
  readonly productNameShown: boolean;
  readonly productNameBaselineY: number;
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

  // R45: band names live in the SVG only on the social card. R44: the rate
  // appears everywhere EXCEPT the social card, which must stay generic.
  const bandNamesShown = social;
  const productNameShown = social;
  const rateShown = !social;
  // R48: the social card doubles its track and sets its tick labels at Body.
  const trackHeight = social ? SOCIAL_TRACK_HEIGHT : TRACK_HEIGHT;
  const labelSize = social ? BODY_SIZE : CAPTION_SIZE;
  const labelLine = social ? SOCIAL_LABEL_LINE : LABEL_LINE;

  // ROWS, top to bottom: product name (social only), the rate, the band
  // names, the bar with its protrusions, the tick labels.
  //
  // The rate gets a row of its own rather than sharing one. It cannot go
  // beside the band names, which are centred over their bands and already
  // span most of the width, and it cannot go beside the tick labels, which
  // R39 anchors outward from 40 % and 49.9 % of the track. Every other
  // placement collides at some width, and a label that overlaps at 320 px is
  // a defect the baselines would only catch if a baseline happened to be
  // taken there.
  const productNameRow = productNameShown ? PRODUCT_NAME_LINE + ROW_GAP : 0;
  const rateRow = rateShown ? RATE_LINE_INLINE + ROW_GAP : 0;
  const barRow = trackHeight + TICK_PROTRUSION * 2;
  const labelRow = ROW_GAP + labelLine;
  // The band-name stack sits BELOW the tick labels on the social card.
  const bandNameBlock = bandNamesShown ? ROW_GAP + BAND_ORDER.length * BAND_NAME_LINE : 0;
  const stackHeight = productNameRow + rateRow + barRow + labelRow + bandNameBlock;

  const svgHeight = social ? SOCIAL_HEIGHT : stackHeight;
  // On the social card the whole stack is centred vertically; elsewhere it
  // starts at the top.
  const stackTop = social ? round((SOCIAL_HEIGHT - stackHeight) / 2) : 0;

  const trackY = round(stackTop + productNameRow + rateRow + TICK_PROTRUSION);
  const rx = trackHeight / 2;

  const fillFraction = clamp(data.percentage, 0, PERCENT) / PERCENT;
  const clampedFill = data.percentage < 0 || data.percentage > PERCENT;

  const track: RailRect = {
    x: trackX,
    y: trackY,
    width: trackWidth,
    height: trackHeight,
    rx,
  };

  const fill: RailRect = {
    x: trackX,
    y: trackY,
    width: round(trackWidth * fillFraction),
    height: trackHeight,
    rx,
  };

  const labelBaselineY = round(trackY + trackHeight + TICK_PROTRUSION + ROW_GAP + labelSize);

  const tickAt = (ceilingFraction: number, anchor: 'start' | 'end'): RailTick => {
    const percentage = ceilingFraction * PERCENT;
    const centre = round(trackX + trackWidth * (percentage / PERCENT));

    return {
      percentage,
      x: round(centre - TICK_WIDTH / 2),
      y: round(trackY - TICK_PROTRUSION),
      width: TICK_WIDTH,
      height: trackHeight + TICK_PROTRUSION * 2,
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
    bandNameX: trackX,
    // R48. Derived from the THRESHOLDS alone - never from percentage or zone -
    // so the social card stays byte-identical whatever result it is handed.
    bandSegments: social
      ? [
          { zone: 'compliant' as const, from: 0, to: thresholds.fiscalCeiling },
          { zone: 'fiscal-exposure' as const, from: thresholds.fiscalCeiling, to: thresholds.socialCeiling },
          { zone: 'social-switch' as const, from: thresholds.socialCeiling, to: 1 },
        ].map(({ zone, from, to }) => ({
          zone,
          x: round(trackX + trackWidth * from),
          width: round(trackWidth * (to - from)),
        }))
      : [],
    bandNameRows: bandNamesShown
      ? BAND_ORDER.map((zone, index) => ({
          zone,
          y: round(labelBaselineY + ROW_GAP + MICRO_SIZE + index * BAND_NAME_LINE),
        }))
      : [],
    rateShown,
    rateBaselineY: round(stackTop + productNameRow + CAPTION_SIZE),
    productNameShown,
    productNameBaselineY: round(stackTop + H2_SIZE),
  };
}
