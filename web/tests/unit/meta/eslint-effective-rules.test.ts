// web/tests/unit/meta/eslint-effective-rules.test.ts
//
// RULING R116, and the reason this test exists rather than a comment.
//
// A FLAT-CONFIG BLOCK THAT SETS A RULE REPLACES THE VALUE FROM EVERY EARLIER
// BLOCK. It does not merge. So declaring R116's selector once, in the block
// that matches app/** and lib/**, did nothing at all for lib/ui/react,
// lib/ui/core or lib/calc-engine - three later blocks set
// no-restricted-syntax for their own reasons and each one silently discarded
// it. The namespace import that cost 207 KiB lint-PASSED with the rule
// nominally in place, and --print-config was the only way to see why.
//
// THIRD OCCURRENCE OF THIS TRAP HERE:
//
//   FW10  eslint `ignores` - a project-level key replaces rather than merges,
//         which is how playwright-report/ came to be linted.
//   FW10  a Playwright project's `testIgnore` - the chromium project's value
//         replaced the root's, and the runtime guard stopped being collected.
//   now   no-restricted-syntax, across four blocks.
//
// Each time the symptom was silence. So this asserts the EFFECTIVE
// configuration - what eslint would actually apply to a given file - rather
// than the shape of the config source, which is what a reader checks and what
// was wrong three times.

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/** R116's selector, verbatim. Compared as text, so a rewrite fails here. */
const NAMESPACE_SELECTOR =
  'ImportDeclaration[source.value!=/^node:/] > ImportNamespaceSpecifier';

interface Restriction {
  readonly selector?: string;
}

/**
 * The rule eslint would really apply to one file.
 *
 * THROUGH THE NODE API, not a subprocess. The first version shelled out to
 * `pnpm exec eslint --print-config` and died with spawnSync ENOENT on
 * Windows, where pnpm is a .cmd shim that execFileSync cannot resolve. Fixing
 * that with shell:true would have worked and cost five eslint startups - and
 * a slow test that crosses vitest's 5 s timeout is exactly how the canton
 * assertion failed under R99's worker cap. calculateConfigForFile resolves
 * the same block ordering in-process.
 *
 * The resolution is the point: it applies every matching block in order,
 * which is what the config SOURCE does not show and what was wrong in three
 * directories at once.
 */
const resolved = new Map<string, readonly Restriction[]>();

async function load(file: string): Promise<void> {
  const eslint = new ESLint({ cwd: process.cwd() });
  const config = (await eslint.calculateConfigForFile(file)) as {
    readonly rules?: Record<string, unknown>;
  };
  const rule = config.rules?.['no-restricted-syntax'];

  // The first element is the severity; the rest are the restrictions.
  resolved.set(file, Array.isArray(rule) ? (rule.slice(1) as readonly Restriction[]) : []);
}

function effectiveRestrictions(file: string): readonly Restriction[] {
  const found = resolved.get(file);

  if (found === undefined) {
    throw new Error(`config for ${file} was not resolved in beforeAll`);
  }

  return found;
}

/**
 * One file per product directory that sets the rule for its own reasons.
 *
 * These are exactly the directories where the rule was inert: each has a
 * later block of its own, so each had to be checked separately. A directory
 * added later without the shared entry fails here.
 */
const SHIPPING_FILES = [
  'lib/ui/react/ZoneBadge/ZoneBadge.tsx',
  'lib/ui/core/zone-tokens.ts',
  'lib/calc-engine/calculate.ts',
  'app/(public)/calculateur-teletravail-frontalier/ResultPanel.tsx',
  'app/(public)/sources/page.tsx',
] as const;

/** Every file any assertion below reads. Resolved once. */
const ALL_FILES = [...SHIPPING_FILES, 'tests/harness.test.ts'] as const;

beforeAll(async () => {
  for (const file of ALL_FILES) {
    await load(file);
  }
}, 60000);

describe('R116 reaches every directory that ships code', () => {
  it.each(SHIPPING_FILES)('%s has the namespace restriction', (file) => {
    const selectors = effectiveRestrictions(file).map((entry) => entry.selector);

    expect(
      selectors,
      `R116 is not in the EFFECTIVE config for ${file}. A later flat-config ` +
        'block that sets no-restricted-syntax replaces the value rather than ' +
        'merging, so the shared entry has to be spread into that block too.',
    ).toContain(NAMESPACE_SELECTOR);
  });

  it('reads a real config, so nothing above passes vacuously', () => {
    // If --print-config ever returned nothing useful, every assertion would
    // be comparing empty arrays and reporting success.
    const selectors = effectiveRestrictions('lib/calc-engine/calculate.ts').map(
      (entry) => entry.selector,
    );

    expect(selectors.length).toBeGreaterThan(1);
  });
});

describe('R116 does not reach code that never ships', () => {
  it('exempts test files, which are not bundled', () => {
    // vitest-axe exports a bag of matchers consumed wholesale by
    // expect.extend, and tests/harness.test.ts imports the engine barrel to
    // assert its public surface. Both are correct, and both were in the R116
    // sweep before the rule existed.
    const selectors = effectiveRestrictions('tests/harness.test.ts').map(
      (entry) => entry.selector,
    );

    expect(selectors).not.toContain(NAMESPACE_SELECTOR);
  });

  it('still forbids importing the FW2 spike from a test', () => {
    // The exemption block sets the whole array, so it had to restate what
    // test files DO still need. Reusing throwaway spike markup is as wrong in
    // a test as anywhere else, and this is what says the restatement did not
    // quietly drop it.
    const selectors = effectiveRestrictions('tests/harness.test.ts')
      .map((entry) => entry.selector ?? '')
      .join(' ');

    expect(selectors).toContain('spike');
  });
});
