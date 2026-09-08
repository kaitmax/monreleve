// web/tests/unit/tokens/contrast.test.ts
//
// FW8 AC2: "The contrast audit passes across every foreground/background
// pair." Computed from the REAL tokens - tokens.scss is compiled here, the
// same way radius.test.ts does it - so the audit and the design system cannot
// drift. A hardcoded table of hex values would be a second copy of the
// palette that keeps passing after the palette changes.
//
// RULING R59: TWO GATES, NOT ONE.
//
//   4,5:1  normal text
//   3,0:1  large text (WCAG: 24 px, or 18,66 px bold) and non-text
//
// One gate would be wrong in both directions. At 4,5 everywhere, the Display
// rate in the warning band fails - and it is 48 px, which nobody has trouble
// reading. At 3,0 everywhere, the ZoneBadge label passes at 15 px, where the
// same colour genuinely is hard to read. The size is part of the claim, so it
// is part of the table.
//
// WEIGHT 600 IS TREATED AS NOT BOLD. WCAG says "bold" without naming a
// weight, and the conventional reading is 700. The H3 rate at 20/600 could be
// argued into the large-text gate; it is held to 4,5 instead, which it passes
// anyway. Where the standard is ambiguous the audit takes the stricter branch.
//
// THE TABLE CANNOT GO STALE. The last describe block scans the five
// components' stylesheets and the rail's renderer for every foreground they
// paint, and fails if one is missing from the table below. Without it the
// audit would only ever check what someone remembered to add - which is the
// same silent-coverage failure ruling R63 addresses for the test globs.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';
import { STATUS_VISUAL, ZONE_BAND_TOKEN } from '@/lib/ui/core';

const root = process.cwd();

const NORMAL_TEXT = 4.5;
const LARGE_TEXT = 3;
const NON_TEXT = 3;

/** Every custom property the compiled token layer actually defines. */
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

function channel(hex: string, index: number): number {
  const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;

  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance. */
function luminance(token: string): number {
  const hex = TOKENS[token];

  if (hex === undefined || !/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`${token} is not a six-digit hex token: ${String(hex)}`);
  }

  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);

  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

interface Pair {
  readonly what: string;
  readonly fg: string;
  readonly bg: string;
  readonly gate: number;
}

// The two surfaces anything can sit on. DESIGN-SYSTEM.md section 4: the
// canvas is grey and cards are white, so every component is audited against
// both rather than against whichever one it happens to be shown on today.
const SURFACES = ['--colour-canvas', '--colour-surface'];

const on = (what: string, fg: string, gate: number): Pair[] =>
  SURFACES.map((bg) => ({ what: `${what} on ${bg}`, fg, bg, gate }));

const AUDIT: readonly Pair[] = [
  // ZoneBadge. RULING R57: the label is text-primary on the soft fill, not
  // the status colour - #B7791F on #FFF7E6 is 3,42:1 and fails here, which is
  // what produced the ruling. The icon keeps the status colour, where the
  // non-text bar applies.
  ...Object.values(STATUS_VISUAL).flatMap((visual) => [
    {
      what: `badge label on ${visual.softColourToken}`,
      fg: '--colour-text-primary',
      bg: visual.softColourToken,
      gate: NORMAL_TEXT,
    },
    {
      what: `badge icon ${visual.colourToken} on its own fill`,
      fg: visual.colourToken,
      bg: visual.softColourToken,
      gate: NON_TEXT,
    },
  ]),
  ...on('badge explanation', '--colour-text-primary', NORMAL_TEXT),

  // RateDisplay. The band colour at Display 48/600 is R57's one exception:
  // large text, so the 3,0 bar. Every other figure on this component is
  // normal text.
  ...Object.values(ZONE_BAND_TOKEN).flatMap((token) =>
    on(`rate ${token} at Display`, token, LARGE_TEXT),
  ),
  ...on('rate caption', '--colour-text-secondary', NORMAL_TEXT),
  ...on('second rate at H3 20/600', '--colour-text-secondary', NORMAL_TEXT),
  ...on('divergence sentence', '--colour-text-primary', NORMAL_TEXT),

  // MetricTile. The negative figure is H2 24/700, which IS large text by the
  // letter of WCAG - held to the normal bar anyway, and it clears it.
  ...on('metric label', '--colour-text-secondary', NORMAL_TEXT),
  ...on('metric figure', '--colour-text-primary', NORMAL_TEXT),
  ...on('metric figure, negative', '--colour-error', NORMAL_TEXT),

  // LegalNote. RULING R58 over the FW8 prompt: secondary, because tertiary is
  // 2,42:1 here and fails at BOTH bars.
  ...on('legal note', '--colour-text-secondary', NORMAL_TEXT),

  // ThresholdRail. The band fill and the tick marks are the parts of the
  // graphic that carry meaning, so they take the non-text bar; the legend and
  // the tick labels are text.
  ...Object.values(ZONE_BAND_TOKEN).flatMap((token) =>
    on(`rail fill ${token}`, token, NON_TEXT),
  ),
  ...on('rail ticks', '--colour-text-primary', NON_TEXT),
  ...on('rail tick labels', '--colour-text-primary', NORMAL_TEXT),
  ...on('rail legend', '--colour-text-secondary', NORMAL_TEXT),
  ...on('rail unavailable text', '--colour-text-secondary', NORMAL_TEXT),
];

describe('every foreground the five components paint clears its gate (AC2)', () => {
  it('compiled the token layer, so nothing below passes vacuously', () => {
    expect(Object.keys(TOKENS).length).toBeGreaterThan(0);
    expect(AUDIT.length).toBeGreaterThan(20);
  });

  for (const pair of AUDIT) {
    it(`${pair.what} clears ${pair.gate}:1`, () => {
      const ratio = contrast(pair.fg, pair.bg);

      expect(
        ratio,
        `${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}:1, below ${pair.gate}:1`,
      ).toBeGreaterThanOrEqual(pair.gate);
    });
  }
});

describe('the rulings the audit produced, pinned as measurements', () => {
  it('R57: the warning colour fails as normal text and passes as large', () => {
    // Both halves, because the ruling is a distinction rather than a
    // preference. If either stopped being true the ruling would need redoing,
    // and this is what would say so.
    const onFill = contrast('--colour-warning', '--colour-warning-soft');
    const onCanvas = contrast('--colour-warning', '--colour-canvas');

    expect(onFill).toBeLessThan(NORMAL_TEXT);
    expect(onCanvas).toBeLessThan(NORMAL_TEXT);
    expect(onCanvas).toBeGreaterThanOrEqual(LARGE_TEXT);
  });

  it('R58: tertiary fails at BOTH bars, so it is not a text colour', () => {
    for (const surface of SURFACES) {
      expect(contrast('--colour-text-tertiary', surface)).toBeLessThan(LARGE_TEXT);
    }
  });
});

// ---------------------------------------------------------------------------
// The derived half.
//
// The table above is written by hand, and a hand-written audit only ever
// checks what someone remembered to add. THE FIRST VERSION OF THIS FILE PROVED
// IT: planting --colour-warning as LegalNote's body text left all 49 tests
// green, because the check at the time asked only WHICH tokens a component
// paints - and warning was already in the table, legitimately, as a Display
// figure and a rail fill. A colour that is legal at 48 px is not thereby legal
// at 13 px, and nothing noticed the difference.
//
// So the gate is derived from the RULE rather than assumed from the token:
// every block in the five stylesheets that sets a colour is paired with the
// font-size and weight in that same block, and audited at the bar those imply.
// Planting warning as body text now fails with its measured ratio.
// ---------------------------------------------------------------------------

/**
 * READ FROM THE DIRECTORY, not written out. A hardcoded list was the first
 * version's second mistake: the first was auditing tokens without their
 * sizes, and this is the same shape of error one level up - a new component
 * ships, nobody adds it here, and the audit keeps passing while covering a
 * shrinking fraction of the product. FW9 added four components in one task,
 * which is exactly when a list like that goes stale.
 *
 * Every directory under lib/ui/react holding a <Name>.module.scss is a
 * component, and every one of them is audited.
 */
const COMPONENTS = readdirSync(join(root, 'lib', 'ui', 'react'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => existsSync(join(root, 'lib', 'ui', 'react', name, `${name}.module.scss`)))
  .sort();

/** WCAG: 24 px, or 18,66 px at bold. 600 is not bold - see the header. */
const BOLD = 700;
const LARGE_PX = 24;
const LARGE_BOLD_PX = 18.66;

const pixels = (token: string | undefined): number | undefined =>
  token === undefined ? undefined : Number.parseFloat(TOKENS[token] ?? '');

interface Painted {
  readonly where: string;
  readonly fg: string;
  readonly gate: number;
  /**
   * The background DECLARED IN THE SAME BLOCK, when there is one.
   *
   * Without this the audit was wrong about any element that paints its own
   * background - and it would have blocked the PublicShell header before a
   * line of it was written. The CTA is "brand fill, white label", so its
   * rule sets colour: var(--colour-surface) over background:
   * var(--colour-brand). Audited against the two page surfaces, that
   * measures white on white - 1,00:1 - and fails a 4,5 gate on a component
   * that is not merely fine but has the highest contrast in the product.
   *
   * Measured before the fix, with a probe stylesheet: "--colour-surface on
   * --colour-surface is 1.00:1, below 4.5:1". A green audit that fails on
   * correct work is worse than no audit, because the fix people reach for
   * is an exemption.
   */
  readonly bg: string | undefined;
  /** Every background this rule is audited against, per ruling R76. */
  readonly backgrounds: readonly string[];
  readonly resolvedFrom: 'own' | 'ancestor' | 'page';
}

/**
 * The EFFECTIVE background for selectors whose ancestor paints one that this
 * stylesheet cannot see - ruling R76: "resolves the EFFECTIVE background, the
 * nearest self-painted ancestor, never the page surface. No exemption list
 * exists."
 *
 * THIS REPLACED AN EXEMPTION LIST, and the difference is the whole point. The
 * previous version held `['.chip', '.icon']` and SKIPPED those rules, on the
 * ground that the hand table audits them against the right background. That
 * reasoning was true and the mechanism was still wrong: a skip is invisible
 * once written, so the day someone adds a third rule inside the chip it is
 * exempt too, silently, and nobody re-reads the comment explaining why.
 *
 * Redirecting instead of skipping means every rule is audited, just against
 * the correct background. ZoneBadge's chip takes its fill inline from
 * STATUS_VISUAL - keyed by Status, so the stylesheet genuinely cannot know it -
 * and `.icon` inherits that same fill from the chip, which is what "nearest
 * self-painted ancestor" resolves to. Four statuses, so four backgrounds each.
 *
 * An entry here ADDS assertions. A test below asserts that no rule is dropped,
 * so this cannot decay back into an exemption list by another name.
 */
const ANCESTOR_BACKGROUND: Record<string, readonly string[]> = {
  // The chip paints itself from STATUS_VISUAL; the icon sits inside it.
  '.chip': Object.values(STATUS_VISUAL).map((visual) => visual.softColourToken),
  '.icon': Object.values(STATUS_VISUAL).map((visual) => visual.softColourToken),
};

function paintedRules(): Painted[] {
  const found: Painted[] = [];

  for (const name of COMPONENTS) {
    const sheet = join(root, 'lib', 'ui', 'react', name, `${name}.module.scss`);
    const source = readFileSync(sheet, 'utf8');

    // Block-level, because the gate depends on the font-size DECLARED BESIDE
    // the colour. Splitting on the closing brace is enough here: these files
    // have no nested rules, and a stray nesting would show up as a block with
    // two colours, which fails loudly rather than silently.
    for (const block of source.split('}')) {
      const colour = /(?:^|\s)color:\s*var\((--colour-[a-z-]+)\)/m.exec(block);

      if (colour?.[1] === undefined) continue;

      const selector = block.slice(0, block.indexOf('{')).trim().split(/\s+/).pop() ?? '';

      // No `continue` here any more, and that is R76: nothing is skipped.

      // The background declared in this same block, if any. Either shorthand,
      // and only a token is usable - a gradient or an image has no single
      // colour to take a ratio against, and stylelint forbids a raw colour
      // here regardless.
      const declared = /background(?:-color)?:\s*var\((--colour-[a-z-]+)\)/.exec(block)?.[1];

      const size = pixels(/font-size:\s*var\((--type-[a-z0-9-]+)\)/.exec(block)?.[1]);
      const weight = pixels(/font-weight:\s*var\((--type-[a-z0-9-]+)\)/.exec(block)?.[1]);

      // No size in the block means the rule inherits one, so the strictest
      // bar applies rather than a guess.
      const large =
        size !== undefined &&
        (size >= LARGE_PX || (size >= LARGE_BOLD_PX && (weight ?? 0) >= BOLD));

      // The effective background, in the order R76 specifies: what this rule
      // paints itself, else what its nearest self-painted ancestor paints,
      // else the page - which is the only case where "either surface" is the
      // honest answer, because the component genuinely could sit on both.
      const inherited = ANCESTOR_BACKGROUND[selector];
      const backgrounds =
        declared !== undefined ? [declared] : (inherited ?? SURFACES);

      found.push({
        where: `${name} ${selector}`,
        fg: colour[1],
        gate: large ? LARGE_TEXT : NORMAL_TEXT,
        bg: declared,
        backgrounds,
        resolvedFrom:
          declared !== undefined ? 'own' : inherited !== undefined ? 'ancestor' : 'page',
      });
    }
  }

  return found;
}

describe('every colour rule in the five stylesheets, at the bar its size implies', () => {
  const rules = paintedRules();

  it('discovers EVERY component directory, not just the ones it can name', () => {
    // The discovery filter keeps directories holding a <Name>.module.scss,
    // which means a directory WITHOUT one is silently skipped rather than
    // reported. That is the same shape of hole as the hardcoded list it
    // replaced: a component whose styles live in a differently-named file
    // would never be audited and nothing would say so.
    //
    // So every directory must either be discovered or be listed here with a
    // reason. STYLE_FREE is expected to stay empty; it exists so that the day
    // a component genuinely has no stylesheet, saying so is a deliberate edit
    // rather than an absence nobody notices.
    const STYLE_FREE: readonly string[] = [];

    const directories = readdirSync(join(root, 'lib', 'ui', 'react'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const undiscovered = directories.filter(
      (name) => !COMPONENTS.includes(name) && !STYLE_FREE.includes(name),
    );

    expect(
      undiscovered,
      `component directories with no <Name>.module.scss, so never audited: ${undiscovered.join(', ')}`,
    ).toEqual([]);
  });

  it('found colour rules at all, so nothing below passes vacuously', () => {
    // The component list is read from disk, so it can silently become empty
    // or lose an entry. Both are asserted before anything depends on it.
    expect(COMPONENTS.length).toBeGreaterThanOrEqual(5);
    expect(COMPONENTS).toContain('ZoneBadge');

    // Five components, each painting at least a label and a figure.
    expect(rules.length).toBeGreaterThanOrEqual(8);
    expect(rules.map((rule) => rule.fg)).toContain('--colour-text-secondary');
  });

  // A rule that paints its own background is audited against THAT, once.
  // Anything else is audited against both page surfaces, because it could sit
  // on either.
  //
  // This distinction is not a refinement, it is a correctness fix, and it was
  // found by inventorying the work still to come rather than by a failing
  // build: PublicShell's CTA is "brand fill, white label", and the version of
  // this audit without it measured white on white and reported 1,00:1 against
  // a 4,5 gate. It would have blocked a correct component, and the natural
  // response to that - adding the CTA to an exemption list - would have
  // removed the highest-contrast element in the product from the audit
  // entirely, which is the opposite of what an exemption should ever buy.
  for (const rule of rules) {
    for (const background of rule.backgrounds) {
      it(`${rule.where} (${rule.fg}) on ${background} clears ${rule.gate}:1`, () => {
        const ratio = contrast(rule.fg, background);

        expect(
          ratio,
          `${rule.where}: ${rule.fg} on ${background} is ${ratio.toFixed(2)}:1, below ${rule.gate}:1`,
        ).toBeGreaterThanOrEqual(rule.gate);
      });
    }
  }

  it('resolves every rule to a background, and SKIPS NOTHING (R76)', () => {
    // The guard against the exemption list coming back. R76: "resolves the
    // EFFECTIVE background - the nearest self-painted ancestor - never the
    // page surface. No exemption list exists."
    //
    // Before R76 this scan held ['.chip', '.icon'] and `continue`d past them.
    // The reasoning was sound - the hand table covers those pairs - but a skip
    // is invisible once written, so a third rule added inside the chip would
    // have been exempt too, silently. Redirecting keeps every rule audited.
    for (const rule of rules) {
      expect(
        rule.backgrounds.length,
        `${rule.where} resolved to no background at all`,
      ).toBeGreaterThan(0);

      for (const background of rule.backgrounds) {
        expect(background, `${rule.where} -> ${background}`).toMatch(/^--colour-/);
      }
    }
  });

  it('exercises all THREE resolutions, so none is dead code that looks alive', () => {
    // own      the rule paints its own background - PublicShell's CTA, and
    //          FieldGroup's input, which correctly declares --colour-surface
    // ancestor the nearest self-painted ancestor paints it, and this
    //          stylesheet cannot see it - ZoneBadge's chip takes its fill
    //          inline from STATUS_VISUAL, and .icon inherits it
    // page     nothing above paints one, so the component could sit on either
    //          surface and both are audited
    //
    // If any of the three were empty, that branch would be untested and the
    // audit would silently revert to its old behaviour the next time a
    // component used it.
    const counted = { own: 0, ancestor: 0, page: 0 };

    for (const rule of rules) counted[rule.resolvedFrom] += 1;

    expect(counted.own, 'no rule paints its own background').toBeGreaterThan(0);
    expect(counted.ancestor, 'no rule inherits an ancestor background').toBeGreaterThan(0);
    expect(counted.page, 'no rule falls through to the page surfaces').toBeGreaterThan(0);
  });
});
