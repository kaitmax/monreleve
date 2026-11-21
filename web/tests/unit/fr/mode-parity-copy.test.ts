// web/tests/unit/fr/mode-parity-copy.test.ts
//
// AN-COPY-TRUTH-2 (R1230, Android Ruling 20 Q3). WHAT A6 PROVED, AND NOT MORE.
// docs/release-audit-android.md section 3 proved the two modes' documents
// byte-identical ONCE THE PROVENANCE STRINGS ARE MASKED: the same figures, and
// a different origin printed for each day. /application said the two modes
// produce « exactement le même document », which claims the origin column too.
//
// Asserted as concepts, never by quoting the copy (R181), in BOTH product
// states - the sentence is a function of appExists (R138's tense), and a
// correction made to one branch only is the half-fix R267 names.
//
// And a census over every web copy file and guide, so the claim cannot come
// back in another place. Presence first (R154): the files are found, and the
// matcher is shown to fire on the old wording, including split across a `+`.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APPLICATION_COPY } from '@/lib/fr/application';
import { PRODUCT_STATE, type ProductState } from '@/lib/content/product-state';

const STATES: readonly ProductState[] = [
  { ...PRODUCT_STATE, appExists: false },
  { ...PRODUCT_STATE, appExists: true },
];

describe('R1230: /application says the two modes differ only in the origin of each day', () => {
  it.each(STATES.map((state) => [state.appExists, state] as const))(
    'appExists=%s: the same document, the same figures, the origin named, no « exactement »',
    (_exists, state) => {
      const intro = APPLICATION_COPY.modesIntro(state);

      expect(intro).toContain('même document');
      expect(intro).toContain('mêmes chiffres');
      expect(intro).toContain('origine');
      expect(intro).not.toContain('exactement');
    },
  );

  it('keeps the two tenses apart (R138)', () => {
    const [future, present] = STATES.map((state) => APPLICATION_COPY.modesIntro(state));

    expect(future).not.toBe(present);
  });
});

// --- the census ------------------------------------------------------------

const WEB_ROOT = path.resolve(__dirname, '../../..');
const ROOTS = [path.join(WEB_ROOT, 'lib/fr'), path.join(WEB_ROOT, 'content/guides')];

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return /\.(ts|tsx|mdx)$/.test(entry.name) ? [full] : [];
  });

/** A literal continued on the next line (`'... ' +` newline `'...'`) is one sentence to a reader. */
const CONTINUATION = /['`]\s*\+\s*['`]/g;
const OVERCLAIM = /exactement\s+l[ea]\s+même\s+(relevé|document)/gi;

const overclaimsIn = (source: string): string[] => source.replace(CONTINUATION, '').match(OVERCLAIM) ?? [];

describe('R1230: no web copy says the modes give exactly the same document', () => {
  it('finds the copy it scans', () => {
    const files = ROOTS.flatMap(filesUnder);

    expect(files.length).toBeGreaterThanOrEqual(20);
    expect(files.some((file) => file.endsWith(path.join('lib', 'fr', 'application.ts')))).toBe(true);
  });

  it('and none of it makes the claim', () => {
    const hits = ROOTS.flatMap(filesUnder).flatMap((file) =>
      overclaimsIn(readFileSync(file, 'utf8')).map((hit) => `${path.relative(WEB_ROOT, file)}: ${hit}`),
    );

    expect(hits).toEqual([]);
  });

  it('and the matcher fires on the old wording, on one line and split across two (R133)', () => {
    expect(overclaimsIn("'Les deux modes produisent exactement le même document.'")).toHaveLength(1);
    expect(overclaimsIn("'Les deux modes produiront exactement ' +\n        'le même document.'")).toHaveLength(1);
    expect(overclaimsIn("'Les deux modes produisent le même document et les mêmes chiffres.'")).toHaveLength(0);
  });
});
