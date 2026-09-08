// web/lib/ui/react/RateDisplay/RateDisplay.test.tsx
//
// SPEC 9.3, "the two-rate problem": in Geneva case (c) the rates differ
// sharply - 39,16 % declarable against 45,0 % of days actually outside
// Switzerland. "Showing only the declarable rate hides real exposure; showing
// only the raw rate contradicts the payslip." Both appear, and when they
// differ an explanatory line says why.
//
// So the divergence is the subject of this file, not a footnote in it. The
// interesting assertions are the three-way distinction between rawRate
// ABSENT, rawRate EQUAL and rawRate DIFFERENT - a component that always
// showed the second block would pass a naive "renders both rates" test while
// putting a redundant 39,1 % under a 39,1 % on every ordinary result.
//
// RULING R57 governs the colour, and this is the one place its exception
// applies. #B7791F is 3,43:1 on the canvas, which fails AA for normal text -
// hence the chip label in ZoneBadge is text-primary. At Display 48/600 the
// same colour is LARGE text, where the bar is 3:1, so the warning band's rate
// may be warning-coloured. Measured rather than assumed: 3,43 canvas, 3,64
// surface, both above 3,00. The audit in increment 5 re-derives this from the
// tokens rather than trusting this comment.
//
// The rates are not hardcoded as strings anywhere here. Every expectation
// goes through formatPercent, because what this component owes is "the number
// the formatter produced" - pinning "39,1 %" would restate the formatter's
// rounding in a second place and make a deliberate change to it look like a
// component bug (SPEC 6.4: every number through format/).

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatPercent } from '@/lib/ui/core';
import type { Zone } from '@/lib/ui/core';
import { RATE_COPY } from '@/lib/fr/rates';
import { text } from '@/tests/support/markup';
import { RateDisplay } from './RateDisplay';

// Geneva case (c), the fixture the whole two-rate rule exists for.
const GENEVA_C = { declarable: 39.16, raw: 45 };

const render = (props: {
  declarableRate: number;
  zone: Zone;
  rawRate?: number;
}): string => renderToStaticMarkup(<RateDisplay {...props} />);

describe('the declarable rate is the primary figure', () => {
  it('renders it through formatPercent, never as its own string', () => {
    const html = render({ declarableRate: GENEVA_C.declarable, zone: 'compliant' });

    expect(html).toContain(formatPercent(GENEVA_C.declarable));
  });

  it('labels it with the AFC caption from lib/fr', () => {
    const html = render({ declarableRate: 12, zone: 'compliant' });

    expect(text(html)).toContain(RATE_COPY.declarableCaption);
  });

  it('colours it by ZONE, taking the band token for each of the three', () => {
    // Zone, not Status: SPEC 6.2 makes colouring a Zone surface by Status a
    // review rejection, and this figure sits directly above the rail.
    expect(render({ declarableRate: 12, zone: 'compliant' })).toContain('--colour-success');
    expect(render({ declarableRate: 45, zone: 'fiscal-exposure' })).toContain('--colour-warning');
    expect(render({ declarableRate: 60, zone: 'social-switch' })).toContain('--colour-error');
  });

  it('never emits a hex literal', () => {
    const html = render({ declarableRate: 45, zone: 'fiscal-exposure', rawRate: 50 });

    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('the second rate appears only when it differs (SPEC 9.3)', () => {
  it('is absent when rawRate is not given', () => {
    const html = render({ declarableRate: GENEVA_C.declarable, zone: 'compliant' });

    expect(text(html)).not.toContain(RATE_COPY.rawCaption);
    expect(text(html)).not.toContain(RATE_COPY.divergence);
  });

  it('is absent when rawRate EQUALS the declarable rate', () => {
    // The case a component that always rendered both would get wrong: it
    // would print the same percentage twice, under two different labels, on
    // every ordinary result. SPEC 9.3 says "when they differ".
    const html = render({ declarableRate: 30, zone: 'compliant', rawRate: 30 });

    expect(text(html)).not.toContain(RATE_COPY.rawCaption);
    expect(text(html)).not.toContain(RATE_COPY.divergence);
  });

  it('appears, captioned and explained, when they differ', () => {
    const html = render({
      declarableRate: GENEVA_C.declarable,
      zone: 'compliant',
      rawRate: GENEVA_C.raw,
    });

    expect(html).toContain(formatPercent(GENEVA_C.raw));
    expect(text(html)).toContain(RATE_COPY.rawCaption);
    expect(text(html)).toContain(RATE_COPY.divergence);
  });

  it('shows BOTH rates for Geneva case (c), which is the entire point', () => {
    const html = render({
      declarableRate: GENEVA_C.declarable,
      zone: 'compliant',
      rawRate: GENEVA_C.raw,
    });

    expect(html).toContain(formatPercent(GENEVA_C.declarable));
    expect(html).toContain(formatPercent(GENEVA_C.raw));
    // ...and the zone is still the compliant band, because declarableRate is
    // what positions the rail. The exposure is visible without recolouring.
    expect(html).toContain('--colour-success');
    expect(html).not.toContain('--colour-warning');
  });
});

describe('the stylesheet carries what markup cannot show (R61)', () => {
  const scss = readFileSync(new URL('./RateDisplay.module.scss', import.meta.url), 'utf8');

  it('sets tabular figures on both rates through the shared mixin', () => {
    // AC3: no numeric jitter. Asserted here as the DECLARATION, because a
    // computed font-feature-settings string exists only in a real browser -
    // jsdom would return the literal text and prove nothing. The computed
    // value is checked in Chromium by the Playwright pass, which is the
    // environment-appropriate half of the same claim (R61).
    expect(scss.match(/tabular-figures/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('sets the primary figure at Display and the second at H3', () => {
    expect(scss).toContain('var(--type-display-size)');
    expect(scss).toContain('var(--type-h3-size)');
  });

  it('puts the second rate in secondary text, not tertiary', () => {
    // R58, and measured: tertiary is 2,42:1 on the canvas and fails AA at
    // BOTH sizes, so it is not a text colour anywhere in this product.
    expect(scss).toContain('var(--colour-text-secondary)');
    expect(scss).not.toContain('var(--colour-text-tertiary)');
  });
});
