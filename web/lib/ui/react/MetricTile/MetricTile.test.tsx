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

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatDays, formatSignedDays } from '@/lib/ui/core';
import { METRIC_COPY } from '@/lib/fr/metrics';
import { MetricTile } from './MetricTile';

const LABEL = 'Jours restants';

const render = (value: number, label = LABEL): string =>
  renderToStaticMarkup(<MetricTile label={label} days={formatSignedDays(value)} />);

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
  it('replaces the label with the au-dessus phrasing, and does not keep both', () => {
    const html = render(-6);

    expect(html).toContain(METRIC_COPY.over);
    expect(html).not.toContain(LABEL);
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
