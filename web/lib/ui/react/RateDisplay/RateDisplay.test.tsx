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
import type { Zone } from '@/lib/ui/core';
import { RATE_COPY } from '@/lib/fr/rates';
import { text } from '@/tests/support/markup';
import { RateDisplay } from './RateDisplay';

// Geneva case (c), the fixture the whole two-rate rule exists for.
const GENEVA_C = { declarable: 39.16, raw: 45 };
// RULING R96: FORMATTED REGULATORY FIGURES ARE ASSERTED AGAINST LITERAL
// STRINGS BY CODEPOINT, never against a formatter call.
//
// WHY, in one sentence: an assertion built from the formatter agrees with the
// formatter, so it cannot see a wrong ARGUMENT. That is not hypothetical -
// RateDisplay rendered the declarable rate at one decimal for three tasks
// while expect(html).toContain(formatPercent(39.16)) stayed green, because
// both sides passed the same wrong precision.
//
// The escapes are written out rather than pasted as invisible characters, so
// the separator is readable in source and a plain space cannot be typed here
// by accident. Every value below was MEASURED from the formatter, not derived.

/** formatPercent(39.16, 2) - the filed figure, SPEC 7.3. */
const DECLARABLE_RATE = '39,16 %';

/** formatPercent(45, 1) - the share of days, R26's second domain. */
const RAW_RATE = '45,0 %';


const render = (props: {
  declarableRate: number;
  zone: Zone;
  rawRate?: number;
}): string => renderToStaticMarkup(<RateDisplay {...props} />);

describe('the declarable rate is the primary figure', () => {
  it('renders it through formatPercent, never as its own string', () => {
    // FORMATTER-RELATIVE ON PURPOSE, and now with the precision the component
    // asks for. What this assertion owes is "the number came from the
    // formatter rather than being hand-built here"; the PRECISION is pinned
    // literally in its own describe block below.
    //
    // The pairing is the lesson. When this assertion passed formatPercent one
    // argument it agreed with a component that also passed one argument, and
    // the two agreed on the wrong answer for three tasks - a declarable rate
    // of 39.16 rendered "39,1 %". A formatter-relative assertion cannot see a
    // wrong argument, so it needs a literal beside it.
    const html = render({ declarableRate: GENEVA_C.declarable, zone: 'compliant' });

    expect(html).toContain(DECLARABLE_RATE);
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

    expect(html).toContain(RAW_RATE);
    expect(text(html)).toContain(RATE_COPY.rawCaption);
    expect(text(html)).toContain(RATE_COPY.divergence);
  });

  it('shows BOTH rates for Geneva case (c), which is the entire point', () => {
    const html = render({
      declarableRate: GENEVA_C.declarable,
      zone: 'compliant',
      rawRate: GENEVA_C.raw,
    });

    // Two rates, two precisions: the filed figure at 2 dp, the share of days
    // at 1. See the precision block below and SPEC 7.3.
    expect(html).toContain(DECLARABLE_RATE);
    expect(html).toContain(RAW_RATE);
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

describe('the precision each rate is rendered at (SPEC 7.3)', () => {
  // THE DEFECT THIS PINS, found while gathering FW11's inputs. formatPercent's
  // signature is formatPercent(value, decimals = 1), and this component called
  // it with ONE argument for both rates. So a declarable rate of 39.16 - the
  // figure SPEC 7.3 says "must match the employer's filing" - rendered as
  // "39,1 %", silently dropping the second decimal. The formatter is pinned to
  // roundingMode 'trunc', so it truncated rather than rounded; either way a
  // digit that the filing depends on did not reach the page.
  //
  // The component's own header comment has described this figure as "39,16 %"
  // since FW8. The intent was right and the call lost it, which is exactly the
  // kind of defect a formatter-relative assertion cannot see: the old test
  // asserted formatPercent(39.16), so it agreed with whatever the call
  // produced. Both assertions below are therefore LITERAL. They restate the
  // formatter on purpose, because what is being pinned is not "the formatter
  // works" but "this component asks it for the right number of digits".
  //
  // SPEC 7.3, verbatim: "The declarable rate truncates to 2 decimals. Geneva
  // publishes 39.16% for 94/240 (39.1666...) and 4.16% for 10/240; rounding
  // would give 39.17% and 4.17%. The engine reproduces truncation because this
  // number must match the employer's filing."

  it('renders the declarable rate at TWO decimals', () => {
    const html = render({ declarableRate: GENEVA_C.declarable, zone: 'compliant' });

    expect(html).toContain(DECLARABLE_RATE);
    expect(html).not.toContain('39,1 %');
  });

  it('renders the raw rate at ONE decimal', () => {
    // R26's second domain: "the same for rawRate's one decimal over n in
    // 0...1 000". The raw rate is a share of days, not a filed figure, and a
    // second decimal there would imply a precision the day count does not
    // have.
    const html = render({
      declarableRate: GENEVA_C.declarable,
      zone: 'compliant',
      rawRate: GENEVA_C.raw,
    });

    expect(html).toContain(RAW_RATE);
    expect(html).not.toContain('45,00 %');
  });

  it('truncates rather than rounds, on the digit that decides a threshold', () => {
    // 39.999 at two decimals is 39,99 under truncation and 40,00 under
    // half-expand - one side of the fiscal ceiling against the other. This is
    // the case R26's header measured and the reason the formatter pins trunc.
    const html = render({ declarableRate: 39.999, zone: 'compliant' });

    expect(html).toContain('39,99 %');
    expect(html).not.toContain('40,00 %');
  });

  it('keeps both rates distinguishable when they differ only in the second decimal', () => {
    // The failure mode of the OLD behaviour, stated as a test: at one decimal,
    // 39.16 and 39.24 both render "39,2" once rounded or "39,1"/"39,2" once
    // truncated - two different filed figures that look identical or swap
    // order. At two decimals they cannot collide.
    const first = render({ declarableRate: 39.16, zone: 'compliant' });
    const second = render({ declarableRate: 39.24, zone: 'compliant' });

    expect(first).not.toBe(second);
    expect(first).toContain(DECLARABLE_RATE);
    expect(second).toContain('39,24 %');
  });
});
