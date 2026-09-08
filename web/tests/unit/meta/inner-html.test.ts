// web/tests/unit/meta/inner-html.test.ts
//
// FW8 increment 6: exactly one dangerouslySetInnerHTML, in ThresholdRail,
// with a comment naming its input.
//
// WHY IT IS WORTH A TEST AND NOT JUST A REVIEW. The injection is acceptable
// for one specific reason - the input is renderRailSvg's return value, a pure
// function over a number, a Zone, two ceilings, a variant and a width, with
// every text node escaped by lib/ui/core/rail/xml.ts. There is no prop
// through which a caller-supplied string could arrive. None of that is
// visible at a second call site written six months later by someone who saw
// this one and copied it, which is exactly how a sanctioned exception becomes
// a pattern. So the count is pinned, and a second site is a failing test
// rather than something a reviewer has to notice.
//
// RULING R60 SETS THE SCOPE: lib/ and app/(public)/. app/(public)/ does not
// exist yet - the public routes today are app/layout.tsx and app/page.tsx at
// the root - so the scope is read as "lib/, and app/ except the dev routes",
// which covers what exists now and picks up app/(public)/ on the day it
// appears. Reading it literally as a path that does not exist would make the
// app half of the rule vacuous, which is the opposite of what a scope is for.
//
// app/dev/rail-gallery is deliberately outside it: a screenshot harness
// rendering a string this suite has already proved is escaped, not product
// code. It is not therefore unaccounted for - the last test in this file
// requires every occurrence in the WHOLE repository, dev included, to carry
// an eslint-disable with a written reason.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

/** The JSX attribute, not the word. Every comment here mentions it by name. */
const USE = /dangerouslySetInnerHTML\s*=\s*\{/g;

const SKIP = new Set(['node_modules', '.next', 'dist-parity', 'test-results', 'playwright-report']);

const norm = (path: string): string => relative(root, path).split(sep).join('/');

function sources(from: string): string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) found.push(full);
    }
  };

  walk(join(root, from));

  return found;
}

interface Site {
  readonly file: string;
  readonly count: number;
}

function sitesIn(paths: readonly string[]): Site[] {
  return paths
    .map((path) => ({
      file: norm(path),
      count: [...readFileSync(path, 'utf8').matchAll(USE)].length,
    }))
    .filter((site) => site.count > 0);
}

describe('exactly one injection site in the product (R60 scope)', () => {
  const scanned = [...sources('lib'), ...sources('app')].filter(
    (path) => !norm(path).startsWith('app/dev/'),
  );

  it('scanned a real file set, so the count below is not vacuous', () => {
    // Without this, a walk that silently returned nothing would report "one
    // site" as "zero sites" and pass the strict reading of the rule while
    // covering nothing at all.
    expect(scanned.length).toBeGreaterThan(10);
    expect(scanned.map(norm)).toContain('lib/ui/react/ThresholdRail/ThresholdRail.tsx');
    expect(scanned.map(norm)).toContain('app/page.tsx');
  });

  it('finds it once, and only in ThresholdRail', () => {
    const sites = sitesIn(scanned);

    expect(sites).toEqual([{ file: 'lib/ui/react/ThresholdRail/ThresholdRail.tsx', count: 1 }]);
  });

  it('carries the comment naming its input', () => {
    // The comment is the reason the exception is acceptable, so it is part of
    // the thing being pinned rather than decoration around it. A future
    // author who changes the input has to change this text too, and that is
    // the moment to notice that the reason no longer holds.
    const source = readFileSync(
      join(root, 'lib', 'ui', 'react', 'ThresholdRail', 'ThresholdRail.tsx'),
      'utf8',
    );

    expect(source).toContain('THE ONLY dangerouslySetInnerHTML IN THE PRODUCT');
    expect(source).toContain("renderRailSvg's return value and nothing else");
    expect(source).toContain('validated numbers');
    expect(source).toContain('xml.ts');
  });

  it('has no prop through which a caller could supply a string', () => {
    // The structural half of the claim above. Every prop is a number, a
    // union, a pair of ceilings or a width; if a string prop is ever added,
    // the comment's central sentence stops being true and this says so.
    const source = readFileSync(
      join(root, 'lib', 'ui', 'react', 'ThresholdRail', 'ThresholdRail.tsx'),
      'utf8',
    );
    const props = source.slice(
      source.indexOf('export interface ThresholdRailProps'),
      source.indexOf('}', source.indexOf('export interface ThresholdRailProps')),
    );

    expect(props).not.toMatch(/:\s*string\b/);
  });
});

describe('every occurrence in the repository is accounted for', () => {
  it('carries an eslint-disable with a written reason, dev routes included', () => {
    // The dev harness is outside R60's scope but not outside review. This
    // makes "outside the scope" mean "justified elsewhere" rather than
    // "unexamined", so the whole repository is covered by one of the two.
    const everywhere = [...sources('lib'), ...sources('app')];
    const unjustified: string[] = [];

    for (const path of everywhere) {
      const lines = readFileSync(path, 'utf8').split('\n');

      lines.forEach((line, index) => {
        if (!/dangerouslySetInnerHTML\s*=\s*\{/.test(line)) return;

        const above = lines[index - 1] ?? '';

        // The `--` reason is required, not just the directive: a bare disable
        // silences the rule without recording why it was acceptable.
        if (!/eslint-disable-next-line react\/no-danger\s+--\s+\S/.test(above)) {
          unjustified.push(`${norm(path)}:${index + 1}`);
        }
      });
    }

    expect(unjustified, `unjustified injection sites: ${unjustified.join(', ')}`).toEqual([]);
  });

  it('counts the two known sites and no others', () => {
    // Named rather than merely counted, so that removing one and adding
    // another somewhere else is a failure rather than a wash.
    const all = sitesIn([...sources('lib'), ...sources('app')]);

    expect(all.map((site) => site.file).sort()).toEqual([
      'app/dev/rail-gallery/page.tsx',
      'lib/ui/react/ThresholdRail/ThresholdRail.tsx',
    ]);
  });
});
