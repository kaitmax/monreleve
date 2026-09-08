// web/tests/unit/tokens/type-pairs.test.ts
//
// RULINGS R70, R88 and R89: four product-specific type pairs join the scale,
// and "no cross-family composing".
//
//   label     13/18/500              R70
//   wordmark  17/26/600              R70
//   hero      40/48/700              R88
//   eyebrow   13/18/500 + tracking   R89
//
// WHY THEY WERE NEEDED. The scale pairs each size with one weight - 13 with
// 400 (Caption), 15 with 500 (Body-M), 17 with 400 (Body-L) - and two places
// in the product want a pairing it does not offer:
//
//   13/500   DESIGN-SYSTEM.md:38, the input label. FieldGroup was taking its
//            size from Caption and its weight from Body-M.
//   17/600   the wordmark. Body-L's size with a semibold weight Body-L does
//            not have.
//
// Composing across two families is not merely untidy: it means a change to
// Body-M's weight silently restyles every label in the product, and the two
// halves of one decision live in different lines of a stylesheet where nobody
// reviewing the label will see both.
//
// THE INTERESTING ASSERTION IS THE LAST BLOCK. A token family is only worth
// having if the call sites actually use it, so this file also reads the
// component stylesheets and fails if any of them still composes 13-with-500
// out of two families. Without that, R70 could be "applied" by adding tokens
// nothing consumes - which is how a scale grows without getting tidier.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const REACT_DIR = join(root, 'lib', 'ui', 'react');

function tokens(): Record<string, string> {
  const source = join(root, 'lib', 'ui', 'core', 'styles', 'tokens.scss');
  const { css } = compileString(readFileSync(source, 'utf8'), {
    // loadPaths, because tokens.scss now @forwards _breakpoints.scss and
    // compileString cannot resolve a relative load without one. Compiling it
    // with no load path only worked while the file had no dependencies.
    loadPaths: [dirname(source)],
  });
  const found: Record<string, string> = {};

  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/g)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) found[name] = value.trim();
  }

  return found;
}

const TOKENS = tokens();

const pixels = (value: string | undefined): number => Number.parseFloat(value ?? '');
const number = (value: string | undefined): number => Number.parseFloat(value ?? '');

describe('the two new type pairs (R70)', () => {
  it('compiled the token layer, so nothing below passes vacuously', () => {
    expect(Object.keys(TOKENS).length).toBeGreaterThan(0);
    expect(TOKENS['--type-caption-size']).toBeDefined();
  });

  it('carries label at 13/18/500', () => {
    // DESIGN-SYSTEM.md:38, "label 13/500 6 px above".
    expect(pixels(TOKENS['--type-label-size'])).toBe(13);
    expect(pixels(TOKENS['--type-label-line'])).toBe(18);
    expect(number(TOKENS['--type-label-weight'])).toBe(500);
  });

  it('carries wordmark at 17/26/600', () => {
    expect(pixels(TOKENS['--type-wordmark-size'])).toBe(17);
    expect(pixels(TOKENS['--type-wordmark-line'])).toBe(26);
    expect(number(TOKENS['--type-wordmark-weight'])).toBe(600);
  });

  it('carries hero at 40/48/700 (R88)', () => {
    // FD11:14, FD12:20 and FD13:16 all specify 40/48/700 for a page hero or an
    // article head. H1 stays 32/40/700 as the default, so this is a pair a
    // caller opts into rather than the new heading size - which is why it
    // needed a name of its own instead of moving --type-h1-*.
    expect(pixels(TOKENS['--type-hero-size'])).toBe(40);
    expect(pixels(TOKENS['--type-hero-line'])).toBe(48);
    expect(number(TOKENS['--type-hero-weight'])).toBe(700);
  });

  it('leaves h1 alone at 32/40/700, because hero is an addition (R88)', () => {
    // The failure this catches: "adding" hero by editing h1, which would
    // silently restyle every h1 in the product including the legal pages and
    // the 404. Both must be true at once for R88 to have been applied rather
    // than misread.
    expect(pixels(TOKENS['--type-h1-size'])).toBe(32);
    expect(pixels(TOKENS['--type-h1-line'])).toBe(40);
    expect(pixels(TOKENS['--type-hero-size'])).not.toBe(pixels(TOKENS['--type-h1-size']));
  });

  it('carries eyebrow at 13/18/500 with its own tracking (R89)', () => {
    // FD11:72 and FD13:46: "Caption 13/18 500 uppercase tracking 0.04 em".
    expect(pixels(TOKENS['--type-eyebrow-size'])).toBe(13);
    expect(pixels(TOKENS['--type-eyebrow-line'])).toBe(18);
    expect(number(TOKENS['--type-eyebrow-weight'])).toBe(500);
    expect(TOKENS['--tracking-eyebrow']).toBe('0.04em');
  });

  it('gives eyebrow its own name even though its numbers equal label (R68)', () => {
    // R68: "Distinct names even where values coincide with other tokens." The
    // values are identical to label's; the ROLE is not, and the tracking is
    // the half that differs. A shared token would mean restyling every input
    // label the day an eyebrow wants 12 px.
    expect(pixels(TOKENS['--type-eyebrow-size'])).toBe(pixels(TOKENS['--type-label-size']));
    expect(number(TOKENS['--type-eyebrow-weight'])).toBe(number(TOKENS['--type-label-weight']));

    // And the distinction is real, not nominal: label has no tracking.
    expect(TOKENS['--tracking-label']).toBeUndefined();
  });

  it('has exactly one tracking token, so 0,04 em cannot be typed raw', () => {
    // stylelint puts letter-spacing in its strict-value list, which is what
    // made a raw 0.04em impossible and produced ruling R89 in the first place.
    const tracking = Object.keys(TOKENS).filter((name) => name.startsWith('--tracking-'));

    expect(tracking).toEqual(['--tracking-eyebrow']);
  });

  it('is a COMPLETE pair each - size, line and weight', () => {
    // A half-declared family is worse than none: the missing third is what
    // sends the next author back to another family to fill the gap, which is
    // the composing R70 forbids.
    for (const step of ['label', 'wordmark', 'hero', 'eyebrow']) {
      for (const part of ['size', 'line', 'weight']) {
        expect(TOKENS[`--type-${step}-${part}`], `--type-${step}-${part} missing`).toBeDefined();
      }
    }
  });

  it('differs from the families it replaces, in the half that mattered', () => {
    // label shares Caption's size and NOT its weight; wordmark shares Body-L's
    // size and not its weight. That is precisely why each needed a name: the
    // shared half is why someone reached for the wrong family, and the
    // unshared half is why doing so was wrong.
    expect(pixels(TOKENS['--type-label-size'])).toBe(pixels(TOKENS['--type-caption-size']));
    expect(number(TOKENS['--type-label-weight'])).not.toBe(
      number(TOKENS['--type-caption-weight']),
    );

    expect(pixels(TOKENS['--type-wordmark-size'])).toBe(pixels(TOKENS['--type-body-l-size']));
    expect(number(TOKENS['--type-wordmark-weight'])).not.toBe(
      number(TOKENS['--type-body-l-weight']),
    );
  });
});

describe('no component still composes a pair out of two families (R70)', () => {
  function stylesheets(): { name: string; source: string }[] {
    return readdirSync(REACT_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: join(REACT_DIR, entry.name, `${entry.name}.module.scss`),
      }))
      .filter((entry) => {
        try {
          readFileSync(entry.path);

          return true;
        } catch {
          return false;
        }
      })
      .map((entry) => ({ name: entry.name, source: readFileSync(entry.path, 'utf8') }));
  }

  const sheets = stylesheets();

  it('found the component stylesheets, so the check is not vacuous', () => {
    expect(sheets.length).toBeGreaterThanOrEqual(7);
    expect(sheets.map((s) => s.name)).toContain('FieldGroup');
  });

  it('never takes a font-size from one family and a font-weight from another', () => {
    // Block-level, the same scan the contrast audit uses. A rule that names
    // --type-caption-size beside --type-body-m-weight is the composing R70
    // forbids, and it is invisible to stylelint because both are tokens.
    const offenders: string[] = [];

    for (const { name, source } of sheets) {
      for (const block of source.split('}')) {
        const size = /font-size:\s*var\(--type-([a-z0-9-]+)-size\)/.exec(block)?.[1];
        const weight = /font-weight:\s*var\(--type-([a-z0-9-]+)-weight\)/.exec(block)?.[1];

        if (size !== undefined && weight !== undefined && size !== weight) {
          const selector = block.slice(0, block.indexOf('{')).trim().split(/\s+/).pop() ?? '';

          offenders.push(`${name} ${selector}: ${size} size with ${weight} weight`);
        }
      }
    }

    expect(offenders, offenders.join(' | ')).toEqual([]);
  });
});
