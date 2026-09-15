// web/tests/unit/tokens/var-references.test.ts
//
// FW13 increment 6: every var(--token) names a token that exists.
//
// THE DEFECT THAT CAUSED THIS FILE. The share row FW13 added styled its two
// buttons like this:
//
//   height: var(--size-control-height);
//   border: var(--size-input-border) solid var(--colour-border);
//
// Neither name exists. The tokens are --size-button-height and
// --colour-border-default, and CSS does not complain about either mistake: a
// declaration whose value contains an unresolvable var() is thrown away at
// COMPUTED-VALUE time, silently. So the button had no height and no border.
// It fell back to its content box - about 22 px against FD1's 48 - which is
// below every touch-target minimum this product asserts elsewhere, on the one
// control the growth mechanic depends on.
//
// WHAT DID NOT CATCH IT, which is the reason a whole test exists for one
// regex. stylelint passed: the syntax is valid CSS and the names are
// well-formed. tsc passed: it is a stylesheet. Every unit test passed, because
// jsdom has no layout and cannot measure a height. The e2e suite passed. axe
// passed. And a VISUAL BASELINE was regenerated over it with
// --update-snapshots and committed, which is the part worth sitting with: the
// picture was correct, it showed a button that was obviously too small, and it
// was accepted automatically. It was found by cropping that baseline and
// looking at it next to the Calculer button.
//
// WHY A SCAN RATHER THAN A CAREFUL REVIEW. The failure mode is a typo, and
// typos are not prevented by intending not to make them. There are 147 custom
// properties across 21 stylesheets; nobody holds that list in their head, and
// the cost of getting one wrong is invisible.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['app', 'lib'];

const stylesheets = (dir: string): string[] => {
  const found: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) found.push(...stylesheets(full));
    else if (full.endsWith('.scss') || full.endsWith('.css')) found.push(full);
  }

  return found;
};

/**
 * Comments out, and this is not a detail.
 *
 * tokens.scss and _breakpoints.scss both contain PROSE about custom properties
 * that must never exist - "`@media (width >= var(--breakpoint-md))` does not
 * merely look odd, it never matches" - and a scan that read those as
 * references would report two failures that are two correct decisions. The
 * first version of this did exactly that.
 */
const withoutComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const FILES = ROOTS.flatMap(stylesheets);

const SOURCES = FILES.map((file) => ({
  file,
  text: withoutComments(readFileSync(file, 'utf8')),
}));

/** Every custom property this product defines anywhere. */
const defined = new Set<string>();

for (const { text } of SOURCES) {
  for (const match of text.matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
    defined.add(String(match[1]));
  }
}

/** Every custom property this product reads, and where. */
const references: { readonly name: string; readonly file: string }[] = [];

for (const { file, text } of SOURCES) {
  for (const match of text.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
    references.push({ name: String(match[1]), file });
  }
}

describe('every var() resolves to a token that exists', () => {
  it('finds no reference without a definition', () => {
    const unresolved = references.filter((reference) => !defined.has(reference.name));

    // The message carries the file, because "some token is missing" in a
    // 21-stylesheet product is a search rather than a finding.
    expect(
      unresolved.map((reference) => `${reference.name} in ${reference.file}`),
    ).toEqual([]);
  });

  it('actually scanned this product, rather than an empty list', () => {
    // R63: without this the whole file passes when a path is wrong, a glob
    // stops matching, or somebody moves the stylesheets - and it passes
    // LOUDLY, with a green tick against the words above.
    expect(FILES.length).toBeGreaterThan(15);
    expect(defined.size).toBeGreaterThan(100);
    expect(references.length).toBeGreaterThan(100);

    // And it is reading real files: the token block is where the definitions
    // live, and the calculator is the heaviest consumer.
    expect(FILES).toContain(join('lib', 'ui', 'core', 'styles', 'tokens.scss'));
    expect(defined.has('--size-button-height')).toBe(true);
    expect(defined.has('--colour-border-default')).toBe(true);
  });

  it('would catch the exact typo that produced it', () => {
    // NON-VACUITY, STATED AS THE ORIGINAL DEFECT. The two names the share row
    // used are close enough to real ones to read as correct, which is why
    // they survived review: --size-control-height next to --size-button-height
    // and --colour-border next to --colour-border-default.
    expect(defined.has('--size-control-height')).toBe(false);
    expect(defined.has('--colour-border')).toBe(false);

    // The scanner, run over a stylesheet that uses them, must object.
    const sample = '.x { height: var(--size-control-height); }';
    const names = [...withoutComments(sample).matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(
      (match) => String(match[1]),
    );

    expect(names).toEqual(['--size-control-height']);
    expect(names.filter((name) => !defined.has(name))).toEqual(['--size-control-height']);
  });

  it('draws every notice accent from its own token, not the input one (R150)', () => {
    // RULING R150, AND THE CENSUS IS THE ENFORCEMENT. Six stylesheets drew a
    // banner's left accent with --size-input-border-focus - an input focus
    // ring at 2 px - while FD1, FD13 and DESIGN-SYSTEM.md section 2 all
    // specify 4 px. Both the value and the name were wrong, and they hid each
    // other: six sites agreeing looks deliberate.
    //
    // THIS IS WHAT STOPS IT COMING BACK. The token exists now; nothing would
    // stop a seventh notice reaching for the input token again, because the
    // result renders and stylelint has no opinion. R69's --size-rule has the
    // same shape and the same problem.
    const offenders = FILES.filter((file) => {
      const source = withoutComments(readFileSync(file, 'utf8'));

      return /border-left:\s*var\(\s*--size-input-border-focus/.test(source);
    });

    expect(
      offenders,
      `a left accent drawn from the input focus token (R150):\n${offenders.join('\n')}`,
    ).toEqual([]);

    // NON-VACUITY: the token exists, it is 4 px, and it is actually used.
    expect(defined.has('--size-notice-accent')).toBe(true);
    expect(readFileSync(join('lib', 'ui', 'core', 'styles', 'tokens.scss'), 'utf8')).toContain(
      '$size-notice-accent: 4px;',
    );

    // SIX SITES, FOUR FILES - the calculator form carries three of them - so
    // the count is of USES rather than of files, which is what Q42's census
    // counted.
    const uses = FILES.reduce(
      (total, file) =>
        total +
        withoutComments(readFileSync(file, 'utf8')).split('var(--size-notice-accent)').length -
        1,
      0,
    );

    expect(uses, 'the token is defined and nothing uses it').toBe(6);
  });

  it('does not read prose about tokens as a reference to one', () => {
    // The false positive that made the first run of this report two failures
    // for two correct decisions.
    const prose = [
      '// `@media (width >= var(--breakpoint-md))` never matches.',
      '/* and neither does var(--bp) */',
      '.y { color: var(--colour-text-primary); }',
    ].join('\n');

    const names = [...withoutComments(prose).matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(
      (match) => String(match[1]),
    );

    expect(names).toEqual(['--colour-text-primary']);
  });
});
