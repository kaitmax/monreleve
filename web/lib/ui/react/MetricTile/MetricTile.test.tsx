// web/lib/ui/react/MetricTile/MetricTile.test.tsx
//
// SPEC 7.2, step 6: "Negative values are reported, never clamped. 'Vous êtes
// 6 jours au-dessus' beats '0 jours restants'." A headroom that has gone
// negative is not minus six days of headroom; it is six days over, which is a
// different sentence about a different quantity.
//
// That is why the component takes a SignedDays - the magnitude already
// formatted, plus a flag - and never a signed number. formatSignedDays
// returns exactly that shape, and its docblock says the caller renders the
// sign itself. Here the caller renders it as WORDS: the label is replaced,
// and the figure turns error-coloured. No minus character is ever emitted,
// and the test that matters most in this file is the one that says so.
//
// A component taking `days: number` could not have this property. It would
// have to decide between "-6" and "6" at the point of rendering, and the
// first is the wrong sentence rather than the wrong format.
//
// RULING R73 - IT OWNS NO COPY AT ALL. It used to substitute its own
// "Jours au-dessus du seuil" from lib/fr, which lost WHICH threshold had been
// passed - and SPEC 9.3 stands two negative-capable tiles side by side, so
// two adjacent tiles could carry identical words about different ceilings.
// Both labels now arrive from the caller, which is the only layer holding the
// year's RuleSet, and the threshold in them is formatted by formatPercent
// rather than written as a literal.
//
// BOTH ARE REQUIRED, not one required and one optional. SPEC 7.2 step 6 is a
// product invariant - a negative figure must never appear under a "remaining"
// label - and an optional overLabel would let a caller ship exactly that by
// omission. The type is what makes it impossible, the same way Container's
// union and FieldGroup's render prop are.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';
import { formatDays, formatPercent, formatSignedDays } from '@/lib/ui/core';
import { METRIC_COPY } from '@/lib/fr/metrics';
import { MetricTile } from './MetricTile';

// Composed the way a caller must: the threshold comes from the RuleSet and
// goes through formatPercent, never a literal (R73). ruleSetFor(2026) gives
// fiscalCeiling 0.4, so this reads "40,0 %".
const THRESHOLD = formatPercent(ruleSetFor(2026).fiscalCeiling * 100);
const LABEL = METRIC_COPY.remaining(THRESHOLD);
const OVER_LABEL = METRIC_COPY.over(THRESHOLD);

const render = (value: number, label = LABEL, overLabel = OVER_LABEL): string =>
  renderToStaticMarkup(
    <MetricTile label={label} overLabel={overLabel} days={formatSignedDays(value)} />,
  );

describe('a tile in its ordinary state', () => {
  it('shows the label it was given', () => {
    expect(render(12)).toContain(LABEL);
  });

  it('shows the figure exactly as formatDays produced it', () => {
    // Not as its own formatting: SPEC 6.4 puts every number through format/,
    // and a component that re-rendered the number would be a second place
    // where the separator could go wrong.
    expect(render(1234.5)).toContain(formatDays(1234.5));
  });

  it('is not marked negative, so the variant cannot be styled onto it', () => {
    // The flag is a data attribute rather than an inline colour: unlike the
    // Zone and Status colours, which are keyed by a union and belong in
    // zone-tokens.ts, this is a binary variant and belongs in the
    // stylesheet. The markup carries the STATE; the sheet carries the paint.
    expect(render(12)).not.toContain("data-negative=\"true\"");
  });
});

describe('a tile whose headroom has gone negative', () => {
  it('renders the over-label the caller gave, and drops the ordinary one', () => {
    const html = render(-6);

    expect(html).toContain(OVER_LABEL);
    expect(html).not.toContain(LABEL);
  });

  it('names WHICH threshold was passed (R73)', () => {
    // The defect R73 fixes. Two negative-capable tiles sit side by side in
    // SPEC 9.3, and the old component substituted one generic sentence for
    // both - so a reader could not tell the 40 % tile from the 49,9 % one.
    const fiscal = formatPercent(ruleSetFor(2026).fiscalCeiling * 100);
    const social = formatPercent(ruleSetFor(2026).socialCeiling * 100);

    expect(render(-6, LABEL, METRIC_COPY.over(fiscal))).toContain(fiscal);
    expect(render(-6, LABEL, METRIC_COPY.over(social))).toContain(social);
    expect(fiscal).not.toBe(social);
  });

  it('owns no au-dessus string of its own', () => {
    // Structural half of R73: the component cannot substitute copy the caller
    // did not choose, so the phrase must not appear in its CODE.
    //
    // Comments are stripped first, and that is not a convenience - the first
    // version of this test read the whole file and failed on the module
    // comment, which explains the ruling by quoting the string it removed. A
    // test that fails on an explanation is testing the wrong thing, and the
    // repair it invites is deleting the explanation.
    const source = readFileSync(
      join(process.cwd(), 'lib', 'ui', 'react', 'MetricTile', 'MetricTile.tsx'),
      'utf8',
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).not.toMatch(/au-dessus/i);
    expect(code).not.toContain('METRIC_COPY');

    // And the stripping must not have removed everything, which would make
    // the two assertions above pass against an empty string.
    expect(code).toContain('export function MetricTile');
  });

  it('marks the figure negative, which is what the sheet paints red', () => {
    expect(render(-6)).toContain("data-negative=\"true\"");
  });

  it('EMITS NO MINUS SIGN, in either the ASCII or the typographic form', () => {
    // The assertion this component exists for. -6 renders as six days over,
    // in words, not as "-6 jours restants" - which reads as a formatting bug
    // rather than as the fact that a limit has been passed.
    const html = render(-6);

    expect(html).toContain(formatDays(6));
    expect(html).not.toContain(String.fromCharCode(45) + '6');
    expect(html).not.toContain(String.fromCharCode(0x2212));
  });

  it('renders the same magnitude as the positive tile of the same size', () => {
    // The magnitude is the flag's only companion: 6 and -6 differ in colour
    // and in words, never in the number.
    const over = render(-6);
    const under = render(6);

    expect(over).toContain(formatDays(6));
    expect(under).toContain(formatDays(6));
  });
});

describe('the stylesheet carries what markup cannot show (R61)', () => {
  const scss = readFileSync(new URL('./MetricTile.module.scss', import.meta.url), 'utf8');

  it('sets the figure at H2 with tabular figures', () => {
    expect(scss).toContain('var(--type-h2-size)');
    expect(scss).toContain('tabular-figures');
  });

  it('paints the negative figure with the error token', () => {
    expect(scss).toContain('--colour-error');
  });

  it('sets the label in secondary, never tertiary (R58)', () => {
    expect(scss).toContain('var(--colour-text-secondary)');
    expect(scss).not.toContain('var(--colour-text-tertiary)');
  });
});
