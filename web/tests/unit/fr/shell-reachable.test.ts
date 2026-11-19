// web/tests/unit/fr/shell-reachable.test.ts
//
// R238 on SHELL_COPY: every exported copy string is reachable, or declared
// unreachable with the state it waits for.
//
// WHY THE SHELL NEEDED ITS OWN. dossier-reachable.test.ts has guarded
// lib/fr/dossier.ts since FW25b, after four strings in that one module turned
// out to reach no surface - one of which made the document state something
// FALSE. The rule was never dossier-shaped; the census just happened to be
// written where the orphans were found.
//
// FW-SHELL-BURGER produced the second module's first orphan.
// SHELL_COPY.menuClose ("Fermer le menu") existed because the old useState
// hamburger renamed itself when open. A details/summary cannot: the browser
// reports expanded/collapsed from the element itself, and renaming would need
// the script the whole change exists to do without. The string survived the
// commit that made it unreachable, and nothing noticed - it is well-formed
// French and passes every typography and accent guard. Exactly the state the
// dossier census was written for, one module over.
//
// THE SURFACES ARE LISTED, AND THAT LIST IS THE LOAD-BEARING PART. A census
// that read only one of two renderers would report orphans that are not:
// reviewPending and reviewDone are rendered by reviewNotice() in
// lib/content/regulatory.ts, not by the shell, and a list naming only
// PublicShell would have called both of them orphans and taught the next
// reader to distrust the test.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHELL_COPY } from '@/lib/fr/shell';

/**
 * Every surface that renders SHELL_COPY.
 *
 * If a third appears it belongs here. `reviewNotice` is a surface in the
 * sense that matters - it is the only thing that turns those two strings into
 * something a reader sees.
 */
const SURFACES = [
  'lib/ui/react/PublicShell/PublicShell.tsx',
  // FW-WEB-ACCOUNT (W12): the header's sign-in link, which PublicShell renders.
  'lib/ui/react/PublicShell/SignInLink.tsx',
  'lib/content/regulatory.ts',
];

const RENDERED = SURFACES.map((path) => readFileSync(join(process.cwd(), path), 'utf8')).join('\n');

/**
 * Strings no surface reaches TODAY, each naming the state it waits for.
 *
 * ASSERTED EMPTY (R206's corollary). The first entry has to argue for itself
 * rather than join an established habit - and "unused for now" is refused
 * below, because that is precisely the note menuClose would have carried.
 */
const UNREACHABLE: Readonly<Record<string, string>> = {};

/** Every leaf of the copy tree, as the dotted path a renderer would write. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string' || typeof node === 'function') return [prefix];

  if (typeof node !== 'object' || node === null) return [];

  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value, prefix === '' ? key : `${prefix}.${key}`),
  );
}

describe('R238: every string in SHELL_COPY reaches a surface', () => {
  it('finds a copy tree and its surfaces, so the census is not vacuous', () => {
    // R133. A walker returning [] would satisfy every assertion below, and
    // "no unreachable strings" would be true of nothing at all.
    expect(leaves(SHELL_COPY).length).toBeGreaterThanOrEqual(8);
    expect(RENDERED.length).toBeGreaterThan(1000);
    expect(RENDERED).toContain('SHELL_COPY');
  });

  it('reaches every string, or declares it unreachable with its reason', () => {
    const orphans = leaves(SHELL_COPY).filter(
      (path) => !RENDERED.includes(`SHELL_COPY.${path}`) && UNREACHABLE[path] === undefined,
    );

    expect(orphans, `no surface renders: ${orphans.join(', ')}`).toEqual([]);
  });

  it('refuses an allow-list entry that does not name the state it waits for', () => {
    for (const [path, reason] of Object.entries(UNREACHABLE)) {
      expect(reason.length, `${path} has no stated reason`).toBeGreaterThan(40);
      expect(leaves(SHELL_COPY), `${path} is not in the copy tree`).toContain(path);
    }
  });

  it('can tell an orphan from a surface that failed to load', () => {
    // R133's positive half: the filter above returns [] both when every
    // string is reachable and when RENDERED is empty. This asserts the
    // mechanism distinguishes the two rather than reporting silence as
    // success.
    expect(RENDERED.includes('SHELL_COPY.thisIsNotRenderedAnywhere')).toBe(false);
    expect(RENDERED.includes('SHELL_COPY.navLabel')).toBe(true);
    expect(RENDERED.includes('SHELL_COPY.reviewPending')).toBe(true);
  });
});
