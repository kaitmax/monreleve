// web/tests/unit/fr/dossier-reachable.test.ts
//
// R238: every exported copy string is reachable, or declared unreachable.
//
// ============================================================================
// WHY THIS EXISTS, AND WHY IT IS NOT "SOMEBODY FORGOT"
// ============================================================================
//
// `lib/fr/dossier.ts` has held four strings that no surface reached:
//
//   tiles.workedDaysNote   found by FW24, asserted at the surface by R225
//   annex.notRecorded      found by FW25b's read-through - SPEC 12 item 5's
//                          unlogged-day row, written and never rendered
//   header.name            SPEC 12 item 1's first field, written and never
//                          rendered, so the document named nobody
//   header.fromDate        written for a part-year period, never rendered -
//                          and this one made the document state something
//                          FALSE, because the header then claimed "année
//                          entière" over figures the engine had prorated
//
// Four instances in one file is not forgetfulness. It is that a copy module
// can hold a string no surface reaches and NOTHING NOTICES - the string is
// well-formed French, it passes every typography guard, and the only thing
// that would catch it is somebody reading the module against the page.
//
// R225 asserted ONE such string at the surface that raises its question. This
// generalises it: the orphan is a failing test rather than a discovery four
// tasks later.
//
// ============================================================================
// THE ALLOW-LIST HAS TO ARGUE FOR ITSELF
// ============================================================================
//
// Same shape as `NOT_PERSONAL` asserted empty (R206's corollary): an entry is
// permitted only when it NAMES THE STATE IT WAITS FOR. "Unused for now" is the
// sentence that turns this guard back into the situation it was written for.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOSSIER_COPY } from '@/lib/fr/dossier';

/**
 * The only surface that renders this module.
 *
 * If a second one appears, it belongs in this list - and a reachability test
 * that read only one of two renderers would report orphans that are not.
 */
const SURFACES = ['app/releve/print/page.tsx'];

const RENDERED = SURFACES.map((path) => readFileSync(join(process.cwd(), path), 'utf8')).join('\n');

/**
 * Strings that no surface reaches TODAY, each naming the state it waits for.
 *
 * An entry without a stated state is refused by the test below, because
 * "unused for now" is exactly the note the four orphans above would have
 * carried.
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

describe('R238: every string in DOSSIER_COPY reaches a surface', () => {
  it('finds a copy tree to check, so the census is not vacuous', () => {
    // R133. A walker that returned [] would pass every assertion below, and
    // "no unreachable strings" would be true of nothing at all.
    expect(leaves(DOSSIER_COPY).length).toBeGreaterThan(30);
    expect(RENDERED.length).toBeGreaterThan(1000);
    expect(RENDERED).toContain('DOSSIER_COPY');
  });

  it('reaches every string, or declares it unreachable with its reason', () => {
    const orphans = leaves(DOSSIER_COPY).filter(
      (path) => !RENDERED.includes(`COPY.${path}`) && UNREACHABLE[path] === undefined,
    );

    expect(orphans, `no surface renders: ${orphans.join(', ')}`).toEqual([]);
  });

  it('refuses an allow-list entry that does not name the state it waits for', () => {
    // "Unused for now" is precisely the note the four orphans would have
    // carried, and it is what turns this guard back into the situation it was
    // written for. An exemption argues for itself or it is not one.
    for (const [path, reason] of Object.entries(UNREACHABLE)) {
      expect(reason.length, `${path} has no stated reason`).toBeGreaterThan(40);
      expect(leaves(DOSSIER_COPY), `${path} is not in the copy tree`).toContain(path);
    }
  });

  it('can tell an orphan from a surface that failed to load', () => {
    // R133's positive half: the filter above returns [] both when every string
    // is reachable and when RENDERED is empty. This asserts the mechanism
    // distinguishes them rather than reporting silence as success.
    expect(RENDERED.includes('COPY.header.thisIsNotRenderedAnywhere')).toBe(false);
    expect(RENDERED.includes('COPY.header.name')).toBe(true);
  });
});
