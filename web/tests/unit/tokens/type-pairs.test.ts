// web/tests/unit/tokens/type-pairs.test.ts
//
// RULING R70: `label` 13/18/500 and `wordmark` 17/26/600 join the type scale,
// and "no cross-family composing".
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

  it('is a COMPLETE pair each - size, line and weight', () => {
    // A half-declared family is worse than none: the missing third is what
    // sends the next author back to another family to fill the gap, which is
    // the composing R70 forbids.
    for (const step of ['label', 'wordmark']) {
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
