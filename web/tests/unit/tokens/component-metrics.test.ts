// web/tests/unit/tokens/component-metrics.test.ts
//
// RULINGS R68 and R69, pinned against the compiled token layer the way
// radius.test.ts and layout.test.ts are.
//
// R68 - the header metrics, and the reason they needed a ruling at all. FW9
// stopped twice: once on a width the documents disagreed about, and once here,
// on four values that appear in the briefs and in no token. The operator
// settled the reading - FD1 and FD11 are the DESKTOP briefs, FD2 is the mobile
// one - so the header is 64 px above the breakpoint and 56 below it, and the
// CTA shrinks to a compact 40.
//
// DISTINCT NAMES EVEN WHERE VALUES COINCIDE, which R68 states explicitly and
// which this file is mostly here to hold. Three of the four numbers already
// exist in the token layer under other names:
//
//   56  $size-button-large-height   a BUTTON's height
//   40  $size-button-text-height    the TEXT button's height
//   1   $size-card-border           a CARD's border
//
// Reaching for any of them would have been the exact alias abuse ruling R62
// was issued about, and it would have coupled the header to a button: change
// the large button to 60 and the mobile header follows it silently. So the
// test asserts both the VALUE and that the names are separate declarations,
// by checking that each new token is defined in its own right.
//
// R69 - --size-rule, a hairline. Four product call sites were aliasing
// --size-card-border for something that is not a card border, and the header
// and footer would have made six. A card border and a rule between two rows
// of a table are different decisions that happen to be the same pixel today.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const STYLES = join(process.cwd(), 'lib', 'ui', 'core', 'styles');
const TOKENS_FILE = join(STYLES, 'tokens.scss');

/** Every custom property the compiled token layer actually defines. */
function customProperties(): Record<string, string> {
  const { css } = compileString(readFileSync(TOKENS_FILE, 'utf8'), {
    // loadPaths: tokens.scss @forwards _breakpoints.scss since R68, and
    // compileString cannot resolve that without a path.
    loadPaths: [dirname(TOKENS_FILE)],
  });
  const found: Record<string, string> = {};

  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/g)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) found[name] = value.trim();
  }

  return found;
}

/**
 * The value of a SASS variable, which is a different question from the value
 * of a custom property and needs a different mechanism: compile a probe that
 * @use's the token file and emits the variable, then read it back.
 *
 * This exists for the breakpoint, which cannot be a custom property at all.
 */
function sassVariable(name: string): string {
  const { css } = compileString(`@use "tokens" as t;\n.probe { width: t.$${name}; }`, {
    loadPaths: [STYLES],
  });

  // Scoped to the probe RULE. @use emits the used file's CSS too, so the
  // output carries tokens.scss's whole :root block - and a bare /width:/ then
  // matches --size-button-min-width: 120px, which is how the first version of
  // this helper reported the breakpoint as 120px.
  const match = /\.probe\s*\{[^}]*?width:\s*([^;}]+)/.exec(css);

  if (match?.[1] === undefined) throw new Error(`$${name} did not compile to a value`);

  return match[1].trim();
}

const TOKENS = customProperties();

const pixels = (value: string | undefined): number => Number.parseFloat(value ?? '');

describe('the header metrics (R68)', () => {
  it('compiled the token layer, so nothing below passes vacuously', () => {
    expect(Object.keys(TOKENS).length).toBeGreaterThan(0);
    expect(TOKENS['--size-input-height']).toBeDefined();
  });

  it('carries the two header heights', () => {
    // FD1:24 and FD11:24 (desktop) against FD2:28 (mobile).
    expect(pixels(TOKENS['--size-header-height'])).toBe(64);
    expect(pixels(TOKENS['--size-header-height-mobile'])).toBe(56);
  });

  it('carries the compact CTA height', () => {
    // FD2:31, "primary brand button, compact 40 h".
    expect(pixels(TOKENS['--size-button-compact-height'])).toBe(40);
  });

  it('keeps them DISTINCT from the tokens whose values they share', () => {
    // The point of R68's "distinct names even where values coincide". These
    // pairs are equal today and must be able to diverge: a header is not a
    // button, and coupling them means changing the large button silently
    // changes the mobile header.
    expect(pixels(TOKENS['--size-header-height-mobile'])).toBe(
      pixels(TOKENS['--size-button-large-height']),
    );
    expect(pixels(TOKENS['--size-button-compact-height'])).toBe(
      pixels(TOKENS['--size-button-text-height']),
    );

    // Equal in value, separate in name - so the token layer defines four
    // things here, not two.
    for (const name of [
      '--size-header-height',
      '--size-header-height-mobile',
      '--size-button-compact-height',
      '--size-button-large-height',
      '--size-button-text-height',
    ]) {
      expect(TOKENS[name], `${name} is not defined`).toBeDefined();
    }
  });
});

describe('the breakpoint is Sass-only, and that is not a style choice (R68)', () => {
  it('exists as a Sass variable', () => {
    expect(sassVariable('breakpoint-md')).toBe('768px');
  });

  it('is NOT emitted as a custom property, because it could not be used as one', () => {
    // A media query CONDITION cannot read var(): the custom property is
    // resolved per element at compute time, and a media query is evaluated
    // before and outside any element. So `@media (width >= var(--bp))` is not
    // a working thing that merely looks odd - it never matches.
    //
    // Emitting it anyway would be worse than useless: it would look available
    // and fail silently at the one place anyone would reach for it. The
    // absence is deliberate, so it is asserted.
    expect(TOKENS['--breakpoint-md']).toBeUndefined();

    for (const [name] of Object.entries(TOKENS)) {
      expect(name, 'a breakpoint leaked into the custom properties').not.toMatch(/breakpoint/);
    }
  });

  it('lives in a partial that emits NO CSS, which is why components can @use it', () => {
    // Measured, and it is the reason the value is not declared inline in
    // tokens.scss. A component needs @use to reach a Sass variable, and
    // `@use "tokens"` emits that file's CSS as well: compiled directly,
    // Container.module.scss with `@use "tokens"` produced a full :root block
    // and 4 386 bytes - the entire token layer, duplicated into one
    // component's stylesheet and again into every other that needed the
    // breakpoint. With the partial it is 455 bytes and no :root.
    const partial = compileString(readFileSync(join(STYLES, '_breakpoints.scss'), 'utf8'));

    expect(partial.css.trim()).toBe('');

    // And the forward keeps one home for the value: reading it through
    // tokens.scss still works, which is what R68's "in the COMPONENT METRICS
    // block" asks for.
    expect(sassVariable('breakpoint-md')).toBe('768px');
  });

  it('costs a component nothing to reach', () => {
    const container = compileString(
      readFileSync(
        join(process.cwd(), 'lib', 'ui', 'react', 'Container', 'Container.module.scss'),
        'utf8',
      ),
      { loadPaths: [STYLES, join(process.cwd(), 'lib', 'ui', 'core', 'styles')] },
    );

    expect(container.css).not.toContain(':root');
  });

  it('is the number every media query in the product uses', () => {
    // One switch point, not one per stylesheet. A second value would put the
    // header and the container on different sides of the same viewport.
    const modules = [
      join(process.cwd(), 'lib', 'ui', 'react', 'Container', 'Container.module.scss'),
    ];

    for (const path of modules) {
      const source = readFileSync(path, 'utf8');

      for (const query of source.match(/@media[^{]+/g) ?? []) {
        // Either it interpolates the Sass variable, or it is a raw value that
        // must match it. Both are legible; a THIRD number is not.
        expect(query, `${dirname(path)} uses a breakpoint that is not the token`).toMatch(
          /breakpoint-md|768px/,
        );
      }
    }
  });
});

describe('the icon-tile square (H9)', () => {
  // H9: "May I add --size-icon-tile: 44px?" -> "Add --size-icon-tile
  // (Recommended)". The home page's destination cards (FW34) and GuideCta each
  // draw a 44 x 44 info-soft square holding a brand glyph. GuideCta's own note
  // forecast this: "If a second appears, it needs a token rather than a third
  // alias" of --size-icon-button, which is a TOUCH TARGET and not this.
  it('exists and is 44 px', () => {
    expect(pixels(TOKENS['--size-icon-tile'])).toBe(44);
  });

  it('is distinct from --size-icon-button, whose value it shares (R68)', () => {
    // Equal in value today, separate in name: an icon tile is not an icon
    // button. Coupling them means resizing the touch target silently resizes
    // every destination-card square, which is the alias abuse R62/R68 remove.
    expect(pixels(TOKENS['--size-icon-tile'])).toBe(pixels(TOKENS['--size-icon-button']));

    for (const name of ['--size-icon-tile', '--size-icon-button']) {
      expect(TOKENS[name], `${name} is not defined`).toBeDefined();
    }
  });
});

describe('the hairline rule (R69)', () => {
  it('exists and is one pixel', () => {
    expect(pixels(TOKENS['--size-rule'])).toBe(1);
  });

  it('is distinct from the three borders that share its value', () => {
    // A card border, an input border, a button border and a rule between two
    // table rows are four decisions that happen to be 1 px today.
    for (const name of [
      '--size-rule',
      '--size-card-border',
      '--size-input-border',
      '--size-button-border',
    ]) {
      expect(TOKENS[name], `${name} is not defined`).toBeDefined();
      expect(pixels(TOKENS[name])).toBe(1);
    }
  });
});
