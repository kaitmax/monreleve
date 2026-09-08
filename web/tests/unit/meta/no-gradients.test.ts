// web/tests/unit/meta/no-gradients.test.ts
//
// RULING R82: "no <linearGradient>/<radialGradient> in any SVG under app/,
// lib/, public/."
//
// WHY IT SCANS INLINE MARKUP AND NOT JUST .svg FILES. Read literally as "SVG
// files", this test would scan ZERO files - there is not one .svg under app/,
// lib/ or public/, and there never has been. Every SVG this product draws is
// inline: the wordmark in a .tsx, and the threshold rail as a string built by
// lib/ui/core/rail/renderRailSvg.ts.
//
// A test that protects nothing is worse than no test, because it reports a
// pass. So this scans both, and the non-vacuity block below names the inline
// SVGs it expects to have found - if the scan stops seeing them, that is a
// failure rather than a smaller number nobody compares.
//
// WHAT IT IS ACTUALLY GUARDING. docs/brand/rejected/frontier-logo-symbol.svg
// is a full-colour mark built from three linearGradients, including an
// frBlue/frRed pair that reads as the French tricolour. It sat in the
// repository ROOT, named like the product's logo, while the header needed a
// mark - a plausible filename in an obvious place is reached for before anyone
// checks whether it is allowed. R82 moved it out and asked for this.
//
// "Never draw ... a gradient" and "never a flag" are both on the never-draw
// list in every FD brief, and Frontier 79 carries country identity in dots and
// chips rather than flag imagery: a product about two countries cannot lean on
// one country's flag.
//
// docs/ IS DELIBERATELY OUTSIDE THE SCAN. The rejected asset is kept as a
// record of a decision, and a record that failed the build would simply be
// deleted - which would lose the reason along with the file.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const ROOTS = ['app', 'lib', 'public'];
const SKIP = new Set(['node_modules', '.next', 'test-results', 'playwright-report']);

/** Anything that could hold SVG markup: a file, or a source that emits one. */
const SCANNED = /\.(svg|tsx?|mts|cts)$/;

const GRADIENT = /<(linearGradient|radialGradient)\b/i;

const norm = (path: string): string => relative(root, path).split(sep).join('/');

const scanned: string[] = [];

function sources(): string[] {
  const found: string[] = [];

  scanned.length = 0;

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) walk(full);
      else if (SCANNED.test(entry.name)) found.push(full);
    }
  };

  for (const dir of ROOTS) {
    const path = join(root, dir);

    // A MISSING ROOT IS SKIPPED, AND THIS KEPT CI RED FOR FIVE COMMITS.
    // web/public is NOT tracked by git - scripts/copy-fonts.mjs creates it and
    // puts two woff2 files in it - so in a clean checkout it does not exist
    // until something builds. readdirSync then threw ENOENT while the module
    // was being evaluated, so the file reported "0 test" and the whole run
    // failed to load. Locally it passed every time, because a build had
    // already made the directory.
    //
    // Skipping is right rather than merely convenient: the roots are a
    // statement about where SVGs may live, and one of them is generated. What
    // would be wrong is skipping SILENTLY, so scannedRoots() is asserted
    // below - app and lib must always be walked, and they are the only roots
    // that hold committed SVG markup.
    if (!existsSync(path)) continue;

    scanned.push(dir);
    walk(path);
  }

  return found;
}

/**
 * Which roots the last sources() call actually walked.
 *
 * Exists so that "a root was skipped" is a visible fact rather than a silent
 * one - the same reason the contrast audit asserts its own discovery.
 */
export function scannedRoots(): readonly string[] {
  return [...scanned];
}

/** Files that actually contain SVG markup, file or inline. */
function withSvg(): { file: string; source: string }[] {
  return sources()
    .map((path) => ({ file: norm(path), source: readFileSync(path, 'utf8') }))
    .filter((entry) => entry.file.endsWith('.svg') || /<svg\b/i.test(entry.source));
}

describe('no SVG in the product uses a gradient (R82)', () => {
  const svgs = withSvg();

  it('found the SVGs it expects to have found', () => {
    // Without this the assertion below passes by scanning nothing - and it
    // would have scanned nothing when this test was written, because the
    // product then had no .svg FILES at all and both its SVGs were inline.
    // app/icon.svg is the first standalone one (FW10 increment 6, the favicon
    // 404), and it is named here so the scan is proved to reach files as well
    // as inline markup.
    const files = svgs.map((entry) => entry.file);

    expect(files).toContain('lib/ui/react/PublicShell/Wordmark.tsx');
    expect(files).toContain('lib/ui/core/rail/renderRailSvg.ts');
    expect(files).toContain('app/icon.svg');
    expect(svgs.length).toBeGreaterThanOrEqual(3);

    // The two roots that hold committed SVG markup must have been walked. A
    // skipped root is legitimate only for the generated one; a skipped app/ or
    // lib/ would make everything above pass over a shrinking scan.
    expect(scannedRoots()).toContain('app');
    expect(scannedRoots()).toContain('lib');
  });

  it('carries no linearGradient or radialGradient anywhere', () => {
    const offenders = svgs
      .filter((entry) => GRADIENT.test(entry.source))
      .map((entry) => entry.file);

    expect(
      offenders,
      `gradients found in: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('does not reach into docs/, where the rejected mark is kept on purpose', () => {
    // The rejected asset is a RECORD. Scanning it would fail the build, and
    // the obvious repair would be deleting the file - losing the reason with
    // it. So the scan roots are asserted, and docs/ is not among them.
    expect(ROOTS).toEqual(['app', 'lib', 'public']);
    expect(ROOTS).not.toContain('docs');

    // And the record is still there, with its explanation beside it.
    const rejected = join(root, '..', 'docs', 'brand', 'rejected');

    expect(readdirSync(rejected)).toContain('frontier-logo-symbol.svg');
    expect(readdirSync(rejected)).toContain('README.md');
  });

  it('the rejected mark really is what the ruling says it is', () => {
    // Asserted rather than asserted-about. If someone ever "fixes" the
    // rejected file to remove its gradients, the reason recorded beside it
    // stops matching the file and this says so - which matters because the
    // README is the only place the decision lives.
    const source = readFileSync(
      join(root, '..', 'docs', 'brand', 'rejected', 'frontier-logo-symbol.svg'),
      'utf8',
    );

    expect(GRADIENT.test(source), 'the rejected mark no longer has gradients').toBe(true);
    expect(source).toMatch(/#[0-9a-f]{6}/i);
  });
});
