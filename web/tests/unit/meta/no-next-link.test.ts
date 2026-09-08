// web/tests/unit/meta/no-next-link.test.ts
//
// RULING R87: plain anchors on the public surface, never next/link.
//
// THE REASON, so that this file is not read as arbitrary tidiness. Public
// routes are statically rendered and hold no client state, so a client-side
// transition buys nothing a browser navigation does not already give.
// next/link would add prefetch JavaScript to every page for transitions nobody
// asked for - a GATE B cost on the acquisition surface - and it would PREFETCH
// HIDDEN ROUTES, which is the worse half: the calculator is deliberately
// invisible until the Checkpoint A gate is recorded (R54), and a prefetching
// nav would fetch it anyway.
//
// WHY A TEST RATHER THAN A COMMENT. next/link is what everyone reaches for in
// a Next codebase; it is in every tutorial and every generated file. A comment
// in PublicShell.tsx tells the person who opens PublicShell.tsx. This tells
// the person who adds a link anywhere else, which is where it will actually
// happen - the calculator's link to the guides, a guide's link to the
// calculator, the result panel's link to /releve-annuel.
//
// THE SCAN SKIPS A MISSING ROOT, and that is not a convenience. The identical
// walker in no-gradients.test.ts threw ENOENT on web/public - which git does
// not track, because scripts/copy-fonts.mjs creates it - and reported "0 test"
// while CI went red for five commits. Here the roots are all tracked, so the
// guard is belt and braces; scannedRoots() is asserted regardless, because a
// scan that silently found nothing passes every assertion below.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

/** R74's reading of R60's scope: app/ except app/dev/, and lib/. */
const ROOTS = ['app', 'lib'];
const SKIP = new Set(['node_modules', '.next', 'dev', 'test-results', 'playwright-report']);

const IMPORTS_NEXT_LINK = /from\s+['"]next\/link['"]|require\(\s*['"]next\/link['"]\s*\)/;

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
      else if (/\.tsx?$/.test(entry.name)) found.push(full);
    }
  };

  for (const dir of ROOTS) {
    const path = join(root, dir);

    if (!existsSync(path)) continue;

    scanned.push(dir);
    walk(path);
  }

  return found;
}

const FILES = sources();

describe('no public-surface file imports next/link (R87)', () => {
  it('scanned both roots and a plausible number of files', () => {
    // Without this the assertion below passes over an empty list, which is the
    // silent-coverage failure ruling R63 exists for and the one that actually
    // happened in no-gradients.test.ts.
    expect(scanned).toEqual(['app', 'lib']);
    expect(FILES.length).toBeGreaterThan(20);
    expect(FILES.map(norm)).toContain('lib/ui/react/PublicShell/PublicShell.tsx');
  });

  it('finds no import of next/link anywhere in app/ or lib/', () => {
    const offenders = FILES.filter((file) => IMPORTS_NEXT_LINK.test(readFileSync(file, 'utf8'))).map(
      norm,
    );

    expect(
      offenders,
      `next/link imported in: ${offenders.join(', ')} - see ruling R87 and the comment in PublicShell.tsx`,
    ).toEqual([]);
  });

  it('and the pattern it looks for would actually match one', () => {
    // The assertion above is an ABSENCE, and an absence assertion with a
    // broken pattern passes forever. This is the pattern tested against the
    // two shapes an import takes, and against a near miss that must NOT match.
    expect(IMPORTS_NEXT_LINK.test("import Link from 'next/link';")).toBe(true);
    expect(IMPORTS_NEXT_LINK.test('import Link from "next/link";')).toBe(true);
    expect(IMPORTS_NEXT_LINK.test("const Link = require('next/link');")).toBe(true);

    // Not a false positive on the word appearing in prose or another module.
    expect(IMPORTS_NEXT_LINK.test('// never import next/link here')).toBe(false);
    expect(IMPORTS_NEXT_LINK.test("import { redirect } from 'next/navigation';")).toBe(false);
  });

  it('the anchors that exist are real anchors', () => {
    // The other half of R87: it is not enough that next/link is absent, the
    // links have to exist. PublicShell is the file that carries them.
    const shell = readFileSync(join(root, 'lib', 'ui', 'react', 'PublicShell', 'PublicShell.tsx'), 'utf8');

    expect(shell.match(/<a\s/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(shell).toContain('R87');
  });
});
