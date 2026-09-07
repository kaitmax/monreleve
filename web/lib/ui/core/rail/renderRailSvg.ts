// web/lib/ui/core/rail/renderRailSvg.ts
//
// The product's signature element, as a pure string.
//
// SPEC 6.3: "Pure function, one implementation, rendered in the browser, the
// PDF, the OG image, and ported to Compose with a screenshot test asserting
// parity." D2 names this module as the reason lib/ui/core exists at all:
// "the PDF and OG routes still need DOM-free rendering".
//
// So: no DOM, no serialiser, no library. A template over numbers computed in
// geometry.ts, with every text node escaped by hand (xml.ts) because this is
// the one string in the product that bypasses React's escaping.
//
// WHAT IS A TOKEN AND WHAT IS A NUMBER, and why they differ. Measured in this
// repo's Chromium: an SVG attribute holding var() resolves when a cascade is
// present and degrades when it is not - but not equally. fill goes BLACK and
// font-size goes 16 px, which is wrong and VISIBLE; height goes to ZERO and
// the track disappears with no error. So colour and type are var() references
// (no hex, no px, ever, in this file) while geometry is numbers proved equal
// to their tokens in rail-tokens.test.ts.
//
// COLOUR COMES FROM ZONE_BAND_TOKEN, keyed by Zone. SPEC 6.2: colouring the
// rail by Status is a review rejection. The band names come from lib/fr keyed
// the same way, and STATUS_COPY is deliberately not reachable from here.
//
// style="" RATHER THAN A PRESENTATION ATTRIBUTE for the paints. Both resolve
// var(); a presentation attribute is the lowest-priority author declaration,
// so a stray page rule (svg rect { fill: currentColor }) would silently
// repaint the band, and a style attribute cannot be beaten that way.

import { railGeometry } from './geometry';
import { escapeXml } from './xml';
import { ZONE_BAND_TOKEN } from '../zone-tokens';
import { formatPercent } from '../format/number';
import { ZONE_BAND_NAME, railAriaLabel } from '@/lib/fr/rail';
import { APP_NAME } from '@/lib/fr';
import type { RailData, RailGeometry, RailTick } from './geometry';
import type { Zone, ZoneThresholds } from '../zones';

/** R40: the rate is declarableRate at its native two decimals. */
const RATE_DECIMALS = 2;

/**
 * Tabular figures, exactly as fonts.scss's mixin sets them - both properties,
 * because the two are not interchangeable across renderers and SPEC 6.4
 * mandates font-feature-settings while the brief asks for
 * font-variant-numeric. The quotes are escaped: this is an XML attribute.
 */
const TABULAR = 'font-variant-numeric: tabular-nums; font-feature-settings: &quot;tnum&quot;';

const FAMILY = 'font-family: var(--type-family)';

/** A <text> style block for one type step. No numerals appear here. */
const typeStyle = (step: string, colourToken: string): string =>
  `${FAMILY}; font-size: var(--type-${step}-size); font-weight: var(--type-${step}-weight); fill: var(${colourToken}); ${TABULAR}`;

const text = (x: number, y: number, anchor: string, style: string, body: string): string =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="${style}">${escapeXml(body)}</text>`;

const rect = (r: { x: number; y: number; width: number; height: number; rx: number }, style: string): string =>
  `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.rx}" style="${style}"/>`;

/**
 * A tick's label. The precision follows the CEILING rather than being fixed:
 * an integer ceiling renders "40 %" and a fractional one "49,9 %", so a rule
 * set that moved a ceiling to 42.5 would label it correctly instead of
 * rounding it away. R35 means these numbers arrive from the RuleSet, so the
 * formatter must be able to render whatever arrives.
 */
const tickLabel = (tick: RailTick): string =>
  formatPercent(tick.percentage, Number.isInteger(tick.percentage) ? 0 : 1);

/** The three band names, each centred over the middle of its own band. */
function bandNames(geometry: RailGeometry, thresholds: ZoneThresholds): string {
  const fiscal = thresholds.fiscalCeiling;
  const social = thresholds.socialCeiling;
  const { x, width } = geometry.track;
  const centreOf = (from: number, to: number): number =>
    Math.round((x + width * ((from + to) / 2)) * 1e3) / 1e3;

  const bands: ReadonlyArray<readonly [Zone, number]> = [
    ['compliant', centreOf(0, fiscal)],
    ['fiscal-exposure', centreOf(fiscal, social)],
    ['social-switch', centreOf(social, 1)],
  ];

  return bands
    .map(([zone, centre]) =>
      text(
        centre,
        geometry.bandNameBaselineY,
        'middle',
        typeStyle('micro', '--colour-text-secondary'),
        ZONE_BAND_NAME[zone],
      ),
    )
    .join('');
}

/**
 * The rail, as an SVG string.
 *
 * R35: the ceilings arrive as a parameter. SPEC 6.3's stated signature took
 * RailData alone, which cannot place a tick without hardcoding 40 and 49.9 in
 * lib/ui/core - forbidden by SPEC 7.7 and by the threshold guard. RailData
 * itself is unchanged.
 */
export function renderRailSvg(data: RailData, thresholds: ZoneThresholds): string {
  const geometry = railGeometry(data, thresholds);
  const rate = formatPercent(geometry.percentage, RATE_DECIMALS);

  // The social card is a standalone image: it is the only variant that owns
  // its whole surface, so it paints a background and centres its text. The
  // other two are embedded in a page that already has one.
  const social = data.variant === 'social';

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${geometry.svgWidth}" height="${geometry.svgHeight}" viewBox="0 0 ${geometry.svgWidth} ${geometry.svgHeight}" role="img" aria-label="${escapeXml(railAriaLabel(rate, data.zone))}">`,

    // SPEC 6.1: the canvas is grey. No shadow anywhere - SPEC 20's v2 bullet
    // and 6.1 both forbid one on a card.
    social
      ? rect(
          { x: 0, y: 0, width: geometry.svgWidth, height: geometry.svgHeight, rx: 0 },
          'fill: var(--colour-canvas)',
        )
      : '',

    // The product name, social only (SPEC 6.3: "carries the product name").
    geometry.productNameShown
      ? text(
          geometry.svgWidth / 2,
          geometry.productNameBaselineY,
          'middle',
          typeStyle('h2', '--colour-text-primary'),
          APP_NAME,
        )
      : '',

    // The rate, on its own row. SPEC 16: the zone is never colour-only, and
    // this is one of the two words that carry it when the colour is lost.
    text(
      social ? geometry.svgWidth / 2 : geometry.track.x,
      geometry.rateBaselineY,
      social ? 'middle' : 'start',
      typeStyle(social ? 'display' : 'caption', '--colour-text-primary'),
      rate,
    ),

    geometry.bandNamesShown ? bandNames(geometry, thresholds) : '',

    // The track. No token names the rail's track colour; the design brief
    // draws #E4E7EC, which IS --colour-border-default, so the token is used
    // rather than the hex.
    rect(geometry.track, 'fill: var(--colour-border-default)'),

    // The fill, in the band colour, keyed by ZONE.
    rect(geometry.fill, `fill: var(${ZONE_BAND_TOKEN[data.zone]})`),

    // The two ticks, and their labels anchored outward (R39).
    ...geometry.ticks.map((tick) => rect({ ...tick, rx: 0 }, 'fill: var(--colour-text-primary)')),
    ...geometry.ticks.map((tick) =>
      text(
        tick.labelX,
        tick.labelY,
        tick.labelAnchor === 'end' ? 'end' : 'start',
        typeStyle('caption', '--colour-text-secondary'),
        tickLabel(tick),
      ),
    ),

    '</svg>',
  ];

  return parts.join('');
}
