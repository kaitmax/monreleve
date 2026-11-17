// web/tests/unit/content/route-paths.test.ts
//
// R976 (FW-CALC-BYTES): client code takes a path from a LEAF that holds no
// registry, and the registry stays the one place a route is declared (R206) -
// it imports the leaf's constants rather than typing the paths again.
//
// Why it matters, measured: the calculator's form imported RESULT_PATH from
// lib/content/routes.ts, and with it the whole registry reached the browser on
// the page with the least GATE A headroom (REPORT-FW-CALC-BYTES.txt, R975).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as leaf from '@/lib/content/route-paths';
import { PUBLIC_ROUTES } from '@/lib/content/routes';
import * as registry from '@/lib/content/routes';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

/** The code of a module with its comments removed, so prose cannot satisfy or fail a check. */
const code = (path: string): string =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const LEAF = 'lib/content/route-paths.ts';
const REGISTRY = 'lib/content/routes.ts';

describe('the path leaf (R976)', () => {
  it('holds the three paths client code needs, and nothing else', () => {
    expect(Object.keys(leaf).sort()).toEqual(['CALCULATOR_PATH', 'COMPARATOR_PATH', 'RESULT_PATH']);
  });

  it('imports nothing, so importing it cannot bring the registry along', () => {
    expect(code(LEAF)).not.toMatch(/\bimport\b|\brequire\s*\(/);
  });
});

describe('the registry derives from the leaf, never retypes it (R206)', () => {
  it('imports the leaf', () => {
    expect(code(REGISTRY)).toMatch(/from '\.\/route-paths'/);
  });

  it('spells none of the leaf’s paths itself', () => {
    const source = code(REGISTRY);

    for (const [name, path] of Object.entries(leaf)) {
      expect(source.includes(path), `${REGISTRY} retypes ${name} (${path})`).toBe(false);
    }

    // RESULT_PATH is composed in the leaf, so its tail must not be composed again here.
    expect(source, `${REGISTRY} composes the result path again`).not.toMatch(/\/resultat/);
  });

  it('re-exports the same values, so every existing importer is unchanged', () => {
    expect(registry.CALCULATOR_PATH).toBe(leaf.CALCULATOR_PATH);
    expect(registry.RESULT_PATH).toBe(leaf.RESULT_PATH);
    expect(registry.COMPARATOR_PATH).toBe(leaf.COMPARATOR_PATH);
  });

  it('declares its routes with them: the two tools are registered, the result is not', () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);

    expect(paths).toContain(leaf.CALCULATOR_PATH);
    expect(paths).toContain(leaf.COMPARATOR_PATH);
    // DELIBERATELY ABSENT FROM PUBLIC_ROUTES - see RESULT_PATH's comment.
    expect(paths).not.toContain(leaf.RESULT_PATH);
  });
});
