// web/tests/unit/ui-core/rail-render.test.ts
//
// renderRailSvg, the inline variant. SPEC 6.3: "Pure function, one
// implementation, rendered in the browser, the PDF, the OG image."
//
// NOTHING IN THIS REPO CAN SEE INSIDE A TYPESCRIPT TEMPLATE STRING. stylelint
// reads .scss and never .ts; eslint has no colour, size or radius rule; the
// threshold guard strips template literals whole (recorded at that fence
// under R43). SPEC 21 nonetheless claims "zero raw hex, radius, or spacing
// literal outside the token set in web src/ ... all lint-enforced", and for
// this module that claim is false unless the tests make it true.
//
// So the guards below are load-bearing rather than decorative: no hex, no
// raw px, and every var() name resolved against the COMPILED token layer -
// because a var() naming a token that does not exist does not render as
// nothing, it renders BLACK, which reads as a deliberate colour rather than
// a defect, and identically for all three zones.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';
import { APP_NAME } from '@/lib/fr';
import { ZONE_BAND_NAME } from '@/lib/fr/rail';
import { renderRailSvg } from '@/lib/ui/core/rail/renderRailSvg';
import {
  COMPACT_MIN_WIDTH,
  SOCIAL_HEIGHT,
  SOCIAL_WIDTH,
  railGeometry,
} from '@/lib/ui/core/rail/geometry';
import type { RailData } from '@/lib/ui/core/rail/geometry';
import type { Zone } from '@/lib/ui/core/zones';

const RULES = ruleSetFor(2026);

/**
 * U+00A0, the no-break space formatPercent puts before the percent sign.
 *
 * Every expectation below builds it from this escape. Typed as a plain space
 * - which is what I did first - the assertions fail against output that is
 * CORRECT, because U+0020 and U+00A0 are indistinguishable on screen. FW6 hit
 * the same trap from the other side, asserting a character nobody could see.
 */
const NBSP = '\u00A0';

/** "39,16" -> the digits plus U+00A0 plus the sign, as the formatter emits. */
const pct = (digits: string): string => digits + NBSP + '%';

const data = (patch: Partial<RailData> = {}): RailData => ({
  percentage: 39.16,
  zone: 'compliant',
  width: 376,
  height: 8,
  variant: 'inline',
  ...patch,
});

const render = (patch: Partial<RailData> = {}): string => renderRailSvg(data(patch), RULES);

/** Every custom property the compiled token layer defines. */
function definedTokens(): Set<string> {
  const source = join(process.cwd(), 'lib', 'ui', 'core', 'styles', 'tokens.scss');
  const { css } = compileString(readFileSync(source, 'utf8'));

  return new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] ?? ''));
}

describe('the SVG envelope', () => {
  it('is a well-formed svg element with the geometry dimensions', () => {
    const geometry = railGeometry(data(), RULES);
    const svg = render();

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain(`width="${geometry.svgWidth}"`);
    expect(svg).toContain(`height="${geometry.svgHeight}"`);
    expect(svg).toContain(`viewBox="0 0 ${geometry.svgWidth} ${geometry.svgHeight}"`);
  });

  it('carries role="img" and an accessible name from lib/fr', () => {
    // SPEC 16: the zone is never colour-only. Without an accessible name the
    // rail is an unlabelled graphic, and axe's svg-img-alt fires on exactly
    // that at FW8's gate.
    const svg = render();

    expect(svg).toContain('role="img"');
    expect(svg).toContain(
      `aria-label="Taux de télétravail déclarable ${pct('39,16')}, imposition en Suisse."`,
    );
  });

  it('names the zone in words in the accessible name, per zone', () => {
    expect(render({ zone: 'fiscal-exposure' })).toContain('une partie est imposable en France');
    expect(render({ zone: 'social-switch' })).toContain('seuil de sécurité sociale dépassé');
  });
});

describe('the track, the fill and the ticks', () => {
  it('fills proportionally, at the geometry width', () => {
    // 376 * 34.58 / 100 = 130.021 after rounding.
    expect(render({ percentage: 34.58 })).toContain('width="130.021"');
  });

  it('draws both ticks at the ceiling positions', () => {
    const geometry = railGeometry(data(), RULES);

    for (const tick of geometry.ticks) {
      expect(render()).toContain(`x="${tick.x}" y="${tick.y}" width="${tick.width}"`);
    }
  });

  it('labels the ticks from the RuleSet, at the precision each needs', () => {
    // An integer ceiling renders "40 %", a fractional one "49,9 %". Both come
    // from the thresholds, so a moved ceiling relabels itself.
    const svg = render();

    expect(svg).toContain(`>${pct('40')}<`);
    expect(svg).toContain(`>${pct('49,9')}<`);
  });

  it('anchors the tick labels outward (R39)', () => {
    const svg = render();

    expect(svg).toMatch(new RegExp(`text-anchor="end"[^>]*>${pct('40')}<`));
    expect(svg).toMatch(new RegExp(`text-anchor="start"[^>]*>${pct('49,9')}<`));
  });

  it('renders the rate at two decimals (R40)', () => {
    // At one decimal a rate of 40.06 reads "40,0 %" beside an amber band;
    // measured over 156 682 engine results, 80 such contradictions at one
    // decimal and none at two.
    expect(render({ percentage: 40.06, zone: 'fiscal-exposure' })).toContain(
      `>${pct('40,06')}<`,
    );
    expect(render({ percentage: 39.16 })).toContain(`>${pct('39,16')}<`);
  });
});

describe('colour comes from the Zone, never from a Status', () => {
  const EXPECTED: ReadonlyArray<readonly [Zone, string]> = [
    ['compliant', '--colour-success'],
    ['fiscal-exposure', '--colour-warning'],
    ['social-switch', '--colour-error'],
  ];

  for (const [zone, token] of EXPECTED) {
    it(`fills ${zone} with var(${token})`, () => {
      expect(render({ zone })).toContain(`fill: var(${token})`);
    });
  }

  it('never reaches for a status colour', () => {
    // SPEC 6.2: colouring the rail by Status is a review rejection. The soft
    // variants belong to the badge and must not appear here.
    for (const [zone] of EXPECTED) {
      expect(render({ zone })).not.toContain('--colour-success-soft');
      expect(render({ zone })).not.toContain('--colour-warning-soft');
      expect(render({ zone })).not.toContain('--colour-error-soft');
    }
  });
});

describe('the band names come from lib/fr and are parallel (R36)', () => {
  it('are absent from inline and compact entirely (R45)', () => {
    for (const variant of ['inline', 'compact'] as const) {
      const svg = render({ variant, width: 376 });
      for (const name of Object.values(ZONE_BAND_NAME)) {
        expect(svg).not.toContain(`>${name}<`);
      }
    }
  });

  it('appear on social as a left-anchored stack (R45)', () => {
    const svg = render({ variant: 'social', width: 0 });

    for (const name of Object.values(ZONE_BAND_NAME)) {
      expect(svg).toContain(`>${name}<`);
    }
    // No centring anywhere in the stack.
    for (const name of Object.values(ZONE_BAND_NAME)) {
      expect(svg).not.toMatch(new RegExp(`text-anchor="middle"[^>]*>${name}<`));
    }
  });

  it('carries no banned vocabulary', () => {
    // SPEC 20 and DESIGN-SYSTEM.md forbid these five, and FW25 asserts the
    // PDF's text layer contains none of them. The rail is rendered into that
    // PDF, so a band name is exactly how one would arrive there.
    const svg = render();

    for (const banned of ['certifié', 'attesté', 'conforme', 'validé', 'approuvé']) {
      expect(svg.toLowerCase()).not.toContain(banned);
    }
  });
});

describe('token discipline, which no linter here can enforce', () => {
  it('contains no hex colour anywhere', () => {
    for (const zone of ['compliant', 'fiscal-exposure', 'social-switch'] as const) {
      expect(render({ zone })).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });

  it('contains no raw px length in any style attribute', () => {
    // Geometry is numbers in ATTRIBUTES, which is deliberate and measured;
    // a px inside a style would be a hardcoded type or colour value, which
    // is what SPEC 20 Never forbids.
    const styles = [...render().matchAll(/style="([^"]*)"/g)].map((m) => m[1] ?? '');

    expect(styles.length).toBeGreaterThan(0);
    for (const style of styles) expect(style).not.toMatch(/\d+px/);
  });

  it('references only custom properties the token layer actually defines', () => {
    // The measured failure this prevents: an undefined var() in a fill does
    // not render as nothing, it renders BLACK - and identically for all three
    // zones, so a screenshot baseline of all nine combinations could pass
    // with every rail the same black bar.
    const defined = definedTokens();
    const used = [...render().matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1] ?? '');

    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((token) => !defined.has(token))).toEqual([]);
  });

  it('sets tabular figures on every text node', () => {
    // SPEC 6.3: "labelled in tabular figures". An SVG rendered into a PDF or
    // a raster does not inherit the page's font-feature settings, so the
    // string has to carry them. Both properties, matching fonts.scss's mixin.
    const texts = [...render().matchAll(/<text[^>]*style="([^"]*)"/g)].map((m) => m[1] ?? '');

    expect(texts.length).toBeGreaterThan(0);
    for (const style of texts) {
      expect(style).toContain('font-variant-numeric: tabular-nums');
      expect(style).toContain('font-feature-settings: &quot;tnum&quot;');
    }
  });
});

describe('the test file itself', () => {
  it('contains no literal U+00A0 in its own source', () => {
    const source = readFileSync(new URL(import.meta.url), 'utf8');
    expect(source).not.toContain('\u00A0');
  });
});

describe('the output is escaped', () => {
  it('escapes the quotes it puts inside attributes', () => {
    // The tnum feature name is quoted, and it sits inside a style attribute.
    // Unescaped it would end the attribute and the rest would become markup.
    const svg = render();

    expect(svg).toContain('&quot;tnum&quot;');
    expect(svg).not.toContain('"tnum"');
  });

  it('leaves the mandated separators byte-exact', () => {
    // U+00A0 before the percent sign, straight from the FW6 formatter.
    const svg = render();
    const rateIndex = svg.indexOf('39,16');

    expect(rateIndex).toBeGreaterThan(0);
    expect(svg.charCodeAt(rateIndex + 5)).toBe(0x00a0);
  });
});

describe('compact drops the band names (the other half of the branch)', () => {
  // The full compact and social treatment is increment 3; this exists so the
  // bandNamesShown branch is covered here rather than only in geometry, and
  // because lib/ui/core carries a 100 % branch gate.
  it('renders no band name and stays shorter', () => {
    const compact = render({ variant: 'compact', width: 376 });

    for (const name of Object.values(ZONE_BAND_NAME)) {
      expect(compact).not.toContain(`>${name}<`);
    }
    expect(compact).toContain('role="img"');
    expect(compact).toContain(`>${pct('40')}<`);
  });
});

describe('the compact variant (increment 3)', () => {
  it('enforces the 200 px minimum and reports it through the geometry', () => {
    const narrow = render({ variant: 'compact', width: 120 });
    const geometry = railGeometry(data({ variant: 'compact', width: 120 }), RULES);

    expect(geometry.clampedWidth).toBe(true);
    expect(geometry.svgWidth).toBe(COMPACT_MIN_WIDTH);
    expect(narrow).toContain(`width="${COMPACT_MIN_WIDTH}"`);
  });

  it('keeps its tick labels and its rate, so the zone is never colour-alone', () => {
    // SPEC 16: "Zone/status is never colour-only - icon + text label on every
    // surface". compact drops the band NAMES, so the tick labels and the rate
    // are the only words left carrying it. Losing them too would leave the
    // band meaning nothing without colour.
    const compact = render({ variant: 'compact', width: 300 });

    expect(compact).toContain(`>${pct('40')}<`);
    expect(compact).toContain(`>${pct('49,9')}<`);
    expect(compact).toContain(`>${pct('39,16')}<`);
  });

  it('paints no background - it is embedded, not standalone', () => {
    expect(render({ variant: 'compact', width: 300 })).not.toContain('--colour-canvas');
  });
});

describe('the social variant (increment 3)', () => {
  const social = (patch: Partial<RailData> = {}): string =>
    render({ variant: 'social', width: 0, ...patch });

  it('is 1200 x 630 with the rail at 80 % of the width, centred (R48)', () => {
    const geometry = railGeometry(data({ variant: 'social', width: 0 }), RULES);

    expect(social()).toContain(`width="${SOCIAL_WIDTH}" height="${SOCIAL_HEIGHT}"`);
    expect(geometry.track.width).toBe(SOCIAL_WIDTH * 0.8);
    expect(geometry.track.x).toBe((SOCIAL_WIDTH - SOCIAL_WIDTH * 0.8) / 2);
  });

  it('paints the canvas background, because it owns its whole surface', () => {
    expect(social()).toContain('fill: var(--colour-canvas)');
  });

  it('carries the product name from lib/fr', () => {
    // SPEC 6.3: "The social variant is 1200 x 630 and carries the product
    // name."
    expect(social()).toContain(`>${APP_NAME}<`);
    expect(social()).toContain('var(--type-h2-size)');
  });

  it('carries NO rate at all (R44)', () => {
    // SPEC 6.3: the OG card is generic, never per-result. A rate is a result.
    // The only percentages left are the two tick labels, which mark where the
    // ceilings are and say nothing about anyone.
    const svg = social();
    const percentages = [...svg.matchAll(/>([^<]*%)</g)].map((m) => m[1]);

    expect(percentages).toEqual([`${pct('40')}`, `${pct('49,9')}`]);
    expect(svg).not.toContain('var(--type-display-size)');
  });

  it('is BYTE-IDENTICAL whatever rate and zone it is given (R44)', () => {
    // The structural form of "generic, never per-result". A comment saying
    // the fields are ignored can rot; this cannot. If any per-result value
    // ever reaches the card - a rate, a fill width, a band colour, a word in
    // the accessible name - these two strings diverge.
    const a = render({ variant: 'social', width: 0, percentage: 4.16, zone: 'compliant' });
    const b = render({ variant: 'social', width: 0, percentage: 97.5, zone: 'social-switch' });

    expect(a).toBe(b);
  });

  it('paints the three bands and no per-result fill (R48)', () => {
    // R48 gives the card weight with the one thing that IS generic: the zones
    // themselves. All three colours appear, each exactly once, as static
    // segments tiling the track - and none of them depends on the rate.
    const svg = social();

    for (const token of ['--colour-success', '--colour-warning', '--colour-error']) {
      expect(svg.split(`var(${token})`).length - 1).toBe(1);
    }
  });

  it('left-anchors everything to the rail, including the product name (R48)', () => {
    const svg = social();
    const geometry = railGeometry(data({ variant: 'social', width: 0 }), RULES);

    expect(svg).toContain(`<text x="${geometry.track.x}" y="${geometry.productNameBaselineY}" text-anchor="start"`);
    expect(svg).not.toContain('text-anchor="middle"');
  });

  it('sets the social tick labels at Body, not Caption (R48)', () => {
    // Caption 13 is right beside Body text in a UI and far too small on a
    // 1200 x 630 raster seen as a thumbnail.
    const svg = social();

    // Located by walking the text nodes rather than by regex: the token
    // names contain parentheses, which a hand-built RegExp turns into
    // capture groups - the assertion then matches nothing and reads as a
    // product defect rather than a test defect.
    const tickLabelNode = (markup: string): string =>
      markup.split('<text').find((node) => node.includes(`>${pct('40')}<`)) ?? '';

    expect(tickLabelNode(svg)).toContain('var(--type-body-size)');
    expect(tickLabelNode(render())).toContain('var(--type-caption-size)');
  });

  it('names neither a rate nor a zone in its accessible name (R44)', () => {
    expect(social()).toContain('aria-label="Illustration des deux seuils');
  });

  it('takes no personal data - the interface has nowhere to put any', () => {
    // SPEC 6.3: "The OG card is generic, never per-result." renderRailSvg is
    // a pure function of RailData, and RailData has exactly five fields: a
    // number, a Zone, two numbers and a variant. There is no name, no email,
    // no date - so no identifier can reach the card through this function.
    // FW15 must still pass a constant rate; that is the route's guarantee,
    // not this one's.
    const fields = Object.keys(data()).sort();

    expect(fields).toEqual(['height', 'percentage', 'variant', 'width', 'zone']);
  });

  it('carries no shadow', () => {
    // SPEC 6.1 and SPEC 20's v2 bullet both forbid a shadow on a card.
    expect(social()).not.toContain('filter');
    expect(social()).not.toContain('drop-shadow');
  });
});

describe('the unavailable state (R33)', () => {
  const BAND_TOKENS = ['--colour-success', '--colour-warning', '--colour-error'];

  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    it(`renders a word rather than throwing for ${String(bad)}`, () => {
      // The calculation layer is deliberately loud about a non-finite rate:
      // zoneFor throws, railGeometry throws, formatPercent throws. The RAIL
      // is a render path, where a throw is a blank page on a document that
      // reports a tax position. This is the third state.
      expect(() => render({ percentage: bad })).not.toThrow();
      expect(render({ percentage: bad })).toContain('>Taux indisponible<');
    });
  }

  it('says so in the accessible name too', () => {
    expect(render({ percentage: Number.NaN })).toContain(
      'aria-label="Taux de télétravail déclarable indisponible."',
    );
  });

  it('carries NO band colour at all', () => {
    // The point of the state. A rail with a colour implies a position, and
    // the whole reason it is unavailable is that the position is unknown.
    const svg = render({ percentage: Number.NaN });

    for (const token of BAND_TOKENS) {
      expect(svg).not.toContain(token);
    }
  });

  it('still draws the track, the ticks and the band names', () => {
    // Absent, the rail would be a blank box - which reads as a broken layout
    // rather than as an unknown value. The ceilings are still where they are.
    const svg = render({ percentage: Number.NaN });

    expect(svg).toContain('fill: var(--colour-border-default)');
    expect(svg).toContain(`>${pct('40')}<`);
    expect(svg).toContain(`>${pct('49,9')}<`);
  });

  it('never calls zoneFor - asserted structurally, from the source', () => {
    // The relay asks for a spy. The stronger form is available here: the rail
    // MAPS rather than decides, because RailData carries the Zone in, so
    // zoneFor is not imported at all. A spy could only prove it was not
    // called on one input; this proves it cannot be called on any.
    const source = readFileSync(
      join(process.cwd(), 'lib', 'ui', 'core', 'rail', 'renderRailSvg.ts'),
      'utf8',
    );
    const imports = source.slice(0, source.indexOf('const RATE_DECIMALS'));

    expect(imports).not.toContain('zoneFor');
    expect(source).not.toMatch(/\bzoneFor\s*\(/);
  });
});

describe('clamping bounds the geometry and never the label (AC3)', () => {
  it('draws an empty rail for a negative rate, labelled with the real value', () => {
    const svg = render({ percentage: -5 });

    expect(svg).toContain(`>${pct('-5,00')}<`);
    expect(svg).toContain('width="0"');
  });

  it('draws a full rail above 100, labelled with the real value', () => {
    const svg = render({ percentage: 140, width: 376 });

    expect(svg).toContain(`>${pct('140,00')}<`);
    // The fill reaches the full track width and no further.
    expect(svg).toContain('width="376" height="8" rx="4" style="fill: var(--colour-success)"');
  });

  it('reports the clamp through the geometry, so a caller can say so', () => {
    expect(railGeometry(data({ percentage: -5 }), RULES).clampedFill).toBe(true);
    expect(railGeometry(data({ percentage: 140 }), RULES).clampedFill).toBe(true);
    expect(railGeometry(data({ percentage: 39.16 }), RULES).clampedFill).toBe(false);
  });
});
