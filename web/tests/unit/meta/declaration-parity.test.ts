// web/tests/unit/meta/declaration-parity.test.ts
//
// RULING R185: A HAND-WRITTEN TYPE DECLARATION FOR A LOCAL MODULE IS
// GENERATED OR ASSERTED, NEVER ARGUED.
//
// THE FILE THIS EXISTS FOR ARGUED, AND ITS ARGUMENT WAS ABOUT THE WRONG
// FAILURE. scripts/gate-selection.d.mts opens by naming its own risk - "a
// hand-written declaration is a second description of one module and can
// disagree with it" - and then reasons the disagreement is safe, because the
// test that imports it exercises the REAL module at runtime, so a declaration
// that drifted would still compile while the assertions failed on behaviour.
//
// That covers a declaration that is WRONG. It does not cover one that is
// INCOMPLETE. An omitted export is not a type that disagrees with reality: it
// is a compile error on correct code, and it lands on whoever adds the NEXT
// export rather than on whoever forgot the last one.
//
// MEASURED COST. `RUNTIME_SUITES` was added to the module when test:runtime
// became selectable and never added here; nothing noticed, because no test
// imported it. When R182 added `LATE_SUITES`, tsc refused a correct test with
// "has no exported member" about a module whose source plainly exports it,
// and the first three diagnoses were all wrong - a stale tsbuildinfo, the `@/`
// path alias, then a duplicate file on disk - because the error names a module
// and the module TypeScript reads is not the one the author is looking at.
//
// SO THE COMMENT BECOMES A TEST. This is R154 one level removed: the
// declaration asserted its own safety and nothing verified delivery. A
// comment reasons; it cannot check. What follows checks.
//
// WHY NOT allowJs. R185 permits either, and R107's header already argued
// against this one: turning allowJs on in the strict project to let one test
// import one script would drag six build scripts into it and produce a wall
// of findings unrelated to any rule. So: assert.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPTS = join(process.cwd(), 'scripts');

/**
 * Every hand-written declaration for a local module, found rather than listed.
 *
 * DERIVED, because a list would be a third description of the same thing and
 * would go stale in exactly the way this file exists to catch. A new .d.mts
 * beside a .mjs is covered on the day it is written.
 */
const DECLARATIONS = readdirSync(SCRIPTS).filter((name) => name.endsWith('.d.mts'));

/**
 * The VALUE exports a declaration file promises.
 *
 * Types are excluded on purpose: `export interface` and `export type` have no
 * runtime counterpart, so comparing them against a module's keys would report
 * every interface as missing. What is being checked is the set of names an
 * importer can bind at runtime.
 */
function declaredValues(source: string): readonly string[] {
  const names = [...source.matchAll(/^export declare (?:const|function|let|var)\s+(\w+)/gmu)].map(
    (match) => match[1] ?? '',
  );

  return [...new Set(names)].sort();
}

describe('R185: a declaration is asserted, not argued', () => {
  it('found the declarations, so nothing below passes vacuously', () => {
    // R63's shape. A glob that matched nothing would report perfect parity.
    expect(DECLARATIONS.length, 'no .d.mts found in scripts/').toBeGreaterThan(0);
    expect(DECLARATIONS).toContain('gate-selection.d.mts');
  });

  for (const declaration of DECLARATIONS) {
    const stem = declaration.replace(/\.d\.mts$/u, '');
    const module = `${stem}.mjs`;

    it(`${declaration} declares exactly what ${module} exports`, async () => {
      const source = readFileSync(join(SCRIPTS, declaration), 'utf8');
      const declared = declaredValues(source);

      // The real module, imported for its keys. Nothing here calls anything:
      // the subject is the SHAPE, and a module whose import has side effects
      // would be a different problem.
      const actual: Record<string, unknown> = await import(`../../../scripts/${stem}.mjs`);
      const exported = Object.keys(actual)
        .filter((name) => name !== 'default')
        .sort();

      expect(
        declared.length,
        `${declaration} declares no values - a declaration that promises ` +
          'nothing cannot disagree with anything, which is not the same as ' +
          'being correct',
      ).toBeGreaterThan(0);

      // BOTH DIRECTIONS, and the first is the one that bit. An export the
      // module has and the declaration lacks is a compile error on correct
      // code; an export the declaration has and the module lacks is a lie a
      // caller will believe until runtime.
      const missing = exported.filter((name) => !declared.includes(name));
      const invented = declared.filter((name) => !exported.includes(name));

      expect(
        missing,
        `${module} exports these and ${declaration} does not declare them. ` +
          'The next test to import one fails to compile, and the error names ' +
          'the module rather than this file.',
      ).toEqual([]);

      expect(
        invented,
        `${declaration} declares these and ${module} does not export them. ` +
          'A caller binds undefined and finds out at runtime.',
      ).toEqual([]);
    });
  }

  it('would catch a missing export, which is how RUNTIME_SUITES survived', () => {
    // THE DETECTOR'S OWN CHECK. The live instances - RUNTIME_SUITES and
    // LATE_SUITES - were both repaired before this file existed, so the
    // assertions above are green on a fixed tree and prove nothing on their
    // own (R178's order: the live instances are the evidence, and they are in
    // the commit message; this is the mechanism check).
    const source = readFileSync(join(SCRIPTS, 'gate-selection.d.mts'), 'utf8');
    const full = declaredValues(source);
    const short = full.filter((name) => name !== 'LATE_SUITES');

    expect(full, 'the parser reads the declaration at all').toContain('LATE_SUITES');
    expect(short, 'and a dropped export is visibly absent').not.toContain('LATE_SUITES');
    expect(full.length - short.length, 'exactly one name removed').toBe(1);
  });
});
