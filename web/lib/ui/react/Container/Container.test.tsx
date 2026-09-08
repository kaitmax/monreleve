// @vitest-environment jsdom
//
// web/lib/ui/react/Container/Container.test.tsx
//
// FW9 increment 3: "Named widths: 'public' (max 1200, padding 32 desktop /
// 20 mobile), 'article' (the 680 px prose measure), 'narrow' (720 px, the
// calculator column). No arbitrary widths accepted - the prop is a union, and
// a test asserts no other value compiles."
//
// THAT LAST CLAUSE IS THE INTERESTING ONE, and it cannot be tested at
// runtime: there is no value you can pass to prove that a DIFFERENT value
// would have been refused. A runtime test could only check that an invalid
// width is ignored, which is a weaker and different claim - it would still
// let `<Container width="1337px">` compile and ship, silently laid out at
// whatever the fallback is.
//
// So the assertion is a @ts-expect-error, the mechanism ruling R65 established
// for AC1, and it lives in Container.types.ts beside this file. That directive
// fails the build in both directions: if the union is ever widened to `string`,
// the directive becomes unused and tsc reports it. The block at the bottom of
// this file keeps that proof alive, because a deleted type test leaves no red
// run behind it.
//
// WHY THE WIDTHS ARE ASSERTED AS TOKEN NAMES RATHER THAN NUMBERS. jsdom
// computes no layout and resolves no custom property - getComputedStyle here
// returns the literal string "var(--layout-public)". Asserting a PIXEL value
// would therefore require either a real browser or a lie. The numbers are
// pinned once, centrally, in tests/unit/tokens/layout.test.ts against the
// compiled token layer; what this file owes is that each variant reaches for
// the right TOKEN. Ruling R61: assertions belong in the environment that can
// answer them.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Container } from './Container';
import type { ContainerWidth } from './Container';

// Testing Library registers cleanup only under vitest globals, which this repo
// does not set. See FieldGroup.test.tsx.
afterEach(cleanup);

const DIR = join(process.cwd(), 'lib', 'ui', 'react', 'Container');

const WIDTHS: readonly ContainerWidth[] = ['public', 'narrow', 'article'];

const CHILD = 'Contenu de la page';

describe('it wraps its children and nothing else', () => {
  it('renders them', () => {
    render(<Container width="public">{CHILD}</Container>);

    expect(screen.getByText(CHILD)).toBeDefined();
  });

  it('emits a plain div, not a landmark', () => {
    // A container is layout. Emitting <main> or <section> here would put a
    // landmark in the accessibility tree for a purely visual decision, and
    // would fight the page that already has one - SPEC 16 and FW9's protocol
    // item 8 both make the h1 and the landmarks the PAGE's job.
    const { container } = render(<Container width="public">{CHILD}</Container>);
    const root = container.firstElementChild;

    expect(root?.tagName).toBe('DIV');
    expect(root?.hasAttribute('role')).toBe(false);
  });

  it('renders no wrapper of its own around the children', () => {
    // One element deep. A container that nested an inner div would break any
    // caller relying on a direct-child selector, and there is no reason for it.
    const { container } = render(<Container width="narrow">{CHILD}</Container>);

    expect(container.firstElementChild?.childElementCount).toBe(0);
  });
});

describe('each named width is a distinct variant in the markup', () => {
  it('carries its name as a data attribute', () => {
    // The data attribute is what the stylesheet selects on, so it is the
    // contract between the union and the CSS. A class name would be hashed by
    // CSS Modules and unassertable from here.
    for (const width of WIDTHS) {
      cleanup();
      const { container } = render(<Container width={width}>{CHILD}</Container>);

      expect(container.firstElementChild?.getAttribute('data-width')).toBe(width);
    }
  });

  it('gives the three widths three DIFFERENT attribute values', () => {
    // The failure a per-variant test would miss: three variants that all
    // render identically would each pass their own assertion.
    const rendered = WIDTHS.map((width) => {
      cleanup();
      const { container } = render(<Container width={width}>{CHILD}</Container>);

      return container.firstElementChild?.getAttribute('data-width');
    });

    expect(new Set(rendered).size).toBe(WIDTHS.length);
  });
});

describe('the stylesheet maps each variant to its R64 token (R61)', () => {
  // An explicit path, NOT new URL(..., import.meta.url). Under jsdom
  // import.meta.url is an http:// URL, so readFileSync rejects it with "The
  // URL must be of scheme file" - which is how this was found. The FW8
  // component tests use the URL form safely because they run in NODE; this
  // file needs jsdom for render(), and that difference is invisible until it
  // throws. Another instance of R61: the environment is part of the test.
  const scss = readFileSync(join(DIR, 'Container.module.scss'), 'utf8');

  it('uses --layout-public, --layout-narrow and --layout-article', () => {
    expect(scss).toContain('var(--layout-public)');
    expect(scss).toContain('var(--layout-narrow)');
    expect(scss).toContain('var(--layout-article)');
  });

  it('reaches for no other layout token, and for no raw length', () => {
    // R64: Container maps its union "to these three tokens and nothing else".
    // --layout-content-max is gone; a max-width naming any other token, or a
    // raw px value, would be a fourth width by the back door. stylelint
    // rejects the raw case independently; this rejects the token case too.
    const maxWidths = scss.match(/max-width:[^;]+;/g) ?? [];

    expect(maxWidths.length).toBe(WIDTHS.length);
    for (const rule of maxWidths) {
      expect(rule).toMatch(/var\(--layout-(public|narrow|article)\)/);
    }
  });

  it('pads with the two gutter tokens, mobile then desktop', () => {
    // "padding 32 desktop / 20 mobile". Mobile-first, so the desktop gutter
    // arrives in a media query rather than the base rule.
    expect(scss).toContain('var(--layout-gutter-mobile)');
    expect(scss).toContain('var(--layout-gutter-desktop)');
    expect(scss).toMatch(/@media[^{]+\{[^}]*--layout-gutter-desktop/s);
  });

  it('centres itself', () => {
    // A max-width without auto margins is a left-aligned column, which is not
    // what any of the three briefs draw.
    expect(scss).toMatch(/margin(-inline)?:\s*0 auto|margin-inline:\s*auto/);
  });
});

describe('the union cannot be widened without the build noticing (R65)', () => {
  const proof = join(DIR, 'Container.types.ts');

  it('the type-level refusal proof exists', () => {
    expect(existsSync(proof), 'Container.types.ts is missing').toBe(true);
  });

  it('it still carries its @ts-expect-error directives', () => {
    // Directives, not mentions - counting the bare string also counts the
    // prose explaining it. The same correction errors.test.ts needed.
    const source = readFileSync(proof, 'utf8');
    const directives = source.match(/^[ \t]*\/\/ @ts-expect-error/gm) ?? [];

    // Three: an arbitrary pixel string, a plausible-but-wrong name, and a
    // widened variable. The third is the one a caller actually hits, by
    // passing something typed as string.
    expect(directives).toHaveLength(3);
  });
});
