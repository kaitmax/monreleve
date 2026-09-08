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

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const ROOTS = ['app', 'lib', 'public'];
const SKIP = new Set(['node_modules', '.next', 'test-results', 'playwright-report']);

/** Anything that could hold SVG markup: a file, or a source that emits one. */
const SCANNED = /\.(svg|tsx?|mts|cts)$/;

const GRADIENT = /<(linearGradient|radialGradient)\b/i;

const norm = (path: string): string => relative(root, path).split(sep).join('/');

function sources(): string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) walk(full);
      else if (SCANNED.test(entry.name)) found.push(full);
    }
  };

  for (const dir of ROOTS) walk(join(root, dir));

  return found;
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
    // WOULD scan nothing if it looked only for .svg files, because this
    // product has none. Both known inline SVGs are named.
    const files = svgs.map((entry) => entry.file);

    expect(files).toContain('lib/ui/react/PublicShell/Wordmark.tsx');
    expect(files).toContain('lib/ui/core/rail/renderRailSvg.ts');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
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
