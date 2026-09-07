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
import { ZONE_BAND_NAME } from '@/lib/fr/rail';
import { renderRailSvg } from '@/lib/ui/core/rail/renderRailSvg';
import { railGeometry } from '@/lib/ui/core/rail/geometry';
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
  it('renders all three', () => {
    const svg = render();

    for (const name of Object.values(ZONE_BAND_NAME)) {
      expect(svg).toContain(`>${name}<`);
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
