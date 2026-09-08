// web/tests/unit/tokens/layout.test.ts
//
// RULING R64, pinned. Compiled from the real token layer, the way
// radius.test.ts and rail-tokens.test.ts are, so the tokens and
// DESIGN-SYSTEM.md cannot drift apart.
//
// WHY THESE THREE EXIST. FW9 stopped dead at Container because its three named
// widths - 'public', 'narrow', 'article' - had no tokens, and stylelint refuses
// a raw length for max-width. The values were never in doubt: FD1, FD11 and
// FD13 all specify content max 1200, FD1 specifies the 720 px calculator
// column five times, and FD13 caps the prose measure at 680 px for a ~70
// character line. What was in doubt was whether 1200 or DESIGN-SYSTEM.md's
// 1440 was the public content bound. R64 settled it: 1200, with 1440 reserved
// as Frontier's dashboard bound and deliberately NOT tokenised until something
// consumes it.
//
// THE ABSENCE ASSERTION IS THE POINT OF THE SECOND BLOCK. R64 removes
// $layout-content-max, and an absence is exactly what a test has to hold,
// because nothing else would notice its return. A reinstated 1440 would give
// Container a fourth option that no design brief asks for and that
// DESIGN-SYSTEM.md now explicitly reserves.
//
// The same shape as the TICK_WIDTH assertion in rail-tokens.test.ts, which
// pinned that 1,5 px belonged to no family until R62 gave it one - except this
// one is expected to stay an absence rather than to graduate into a mirror.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

/** Every custom property the compiled token layer actually defines. */
function tokens(): Record<string, string> {
  const source = join(root, 'lib', 'ui', 'core', 'styles', 'tokens.scss');
  const { css } = compileString(readFileSync(source, 'utf8'));
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

describe('the layout width family (R64)', () => {
  it('compiled the token layer, so nothing below passes vacuously', () => {
    expect(Object.keys(TOKENS).length).toBeGreaterThan(0);
    expect(TOKENS['--layout-gutter-desktop']).toBeDefined();
  });

  it('carries the three documented widths and no others', () => {
    // 1200: FD1:15, FD11:15, FD13:17 - "content max width 1200, centred".
    // 720:  FD1:41, :46, :67, :97, :103 - the calculator column.
    // 680:  FD13:23 - "cap the prose block at 680 px", the ~70ch measure.
    expect(pixels(TOKENS['--layout-public'])).toBe(1200);
    expect(pixels(TOKENS['--layout-narrow'])).toBe(720);
    expect(pixels(TOKENS['--layout-article'])).toBe(680);
  });

  it('keeps the two gutters, which R64 does not touch', () => {
    expect(pixels(TOKENS['--layout-gutter-mobile'])).toBe(20);
    expect(pixels(TOKENS['--layout-gutter-desktop'])).toBe(32);
  });

  it('orders the three widths as article < narrow < public', () => {
    // Not decoration: Container's union is meaningless if two of them collide,
    // and a prose measure wider than the calculator column would put the most
    // text on the widest line, which is the opposite of what 680 is for.
    const article = pixels(TOKENS['--layout-article']);
    const narrow = pixels(TOKENS['--layout-narrow']);
    const wide = pixels(TOKENS['--layout-public']);

    expect(article).toBeLessThan(narrow);
    expect(narrow).toBeLessThan(wide);
  });
});

describe('1440 is reserved, not tokenised (R64)', () => {
  it('defines no --layout-content-max', () => {
    // R64 removed it. DESIGN-SYSTEM.md section 1 now reserves 1440 as
    // Frontier's dashboard bound and says it is not tokenised until a consumer
    // exists, so its reappearance would be a silent fourth width for
    // Container and a second answer to "how wide is the content".
    expect(TOKENS['--layout-content-max']).toBeUndefined();
  });

  it('leaves no token carrying 1440 under another name', () => {
    // The absence above is defeated by renaming rather than removing, which is
    // the easy accident when a build breaks and the value is still wanted.
    const carriers = Object.entries(TOKENS)
      .filter(([, value]) => /(^|\s)1440px(\s|$)/.test(value))
      .map(([name]) => name);

    expect(carriers, `1440 reappeared as: ${carriers.join(', ')}`).toEqual([]);
  });
});
