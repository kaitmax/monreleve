// web/tests/unit/meta/no-js-coverage.test.ts
//
// RULING R346: A "WORKS WITHOUT JAVASCRIPT" CLAIM IS BACKED BY A TEST.
//
// ============================================================================
// WHY A CENSUS AND NOT A LIST
// ============================================================================
//
// Before FW-FORECAST's increment 0, no-JS coverage was seven blocks scattered
// across four spec files, each turning scripting off for itself. Nothing said
// which SURFACES made the claim, so a surface could make it and have no test
// at all - and one did: FW34 built the home page's calculator as a real
// `<form method="get">` precisely so a reader with no script could use it,
// tests/unit/pages/home.test.tsx asserted the markup was a GET form, and
// nothing ever submitted it. "It is a GET form" and "submitting it lands a
// reader on the calculator with their answers" are different claims.
//
// A HAND-KEPT LIST OF JOURNEYS WOULD HAVE THE SAME HOLE, one level up: it is
// wrong the day somebody adds a surface and does not add a line. So the list
// is DISCOVERED from the product (R246's mechanism, the one that makes
// `app/**` self-enumerating) and the classification is what a human maintains
// - and a surface that is discovered but unclassified FAILS until somebody
// says which it is.
//
// ============================================================================
// WHAT MAKES A SURFACE "NO-JS"
// ============================================================================
//
// Two mechanisms, and they are the only two this product uses:
//
//   <form>     the browser serialises the fields and navigates or posts. No
//              script is involved, so the journey either works from the
//              markup or it does not work at all.
//   <details>  the browser's own disclosure: open state, keyboard operation
//              and the expanded state it reports are all native.
//
// Anything else - a button with an onClick, an island that hydrates - makes
// no such claim and is not discovered here.
//
// THE SCAN IS DELIBERATELY CRUDE, and that is the safe direction: it reads
// source text rather than parsing JSX, so it over-discovers rather than
// under-discovers. A false positive costs one classification line; a false
// negative is a surface claiming no-JS support with nothing driving it, which
// is the state this exists to end.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = process.cwd();
const E2E = join(WEB, 'e2e');

/** Where a reader-facing surface can live. */
const ROOTS = ['app', 'lib/ui/react', 'lib/guides'];

/** The two mechanisms that work without scripting. */
const MECHANISMS = ['<form', '<details'];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) return walk(full);

    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

/** Every file that renders a form or a disclosure, as a repo-relative path. */
function discovered(): string[] {
  return ROOTS.flatMap((root) => {
    const dir = join(WEB, root);

    try {
      statSync(dir);
    } catch {
      return [];
    }

    return walk(dir)
      .filter((file) => {
        const source = readFileSync(file, 'utf8');

        return MECHANISMS.some((mechanism) => source.includes(mechanism));
      })
      .map((file) => relative(WEB, file).split('\\').join('/'));
  }).sort();
}

/**
 * Every discovered surface, and what answers for it.
 *
 * A string names the .nojs.spec.ts that drives it. A `{ why }` says the
 * surface needs none, and has to argue for itself - R206's corollary, the
 * same shape as the reachability censuses' allow-lists: an exemption that
 * says "not needed" is the note the hole would have carried.
 */
const COVERAGE: Readonly<Record<string, string | { readonly why: string }>> = {
  // app/(public)/page.tsx LEFT THIS MAP in FW-HOME-A2: the home page no
  // longer renders a <form> itself - its no-JS form is the counter's, and the
  // HomeCounter entry below names the same spec. The census found the stale
  // line, which is what its other direction is for.

  // THE CENSUS HAS NOW CORRECTED ITS AUTHOR TWICE, IN OPPOSITE DIRECTIONS,
  // AND THAT IS THE WHOLE ARGUMENT FOR DISCOVERING SURFACES RATHER THAN
  // LISTING THEM.
  //
  // The first time, this entry existed and the file did not match: it had
  // been classified on the assumption that the calculator has a form, and
  // the run reported it classified-but-not-discovered. The note that
  // replaced it read "It has none: the calculator is a client island", which
  // was true, and explained that SPEC 9.3 asks the PAGE to be meaningful
  // without scripting rather than the calculation to run.
  //
  // The second time is R351. The island is now wrapped in a real GET form
  // that submits to /calculateur-teletravail-frontalier/resultat, so the
  // file matches on its own merits and a no-JS reader has a journey through
  // it that ends in a figure. A hand-kept list would have gone on saying the
  // calculator has no form, in a comment that was accurate when written.
  //
  // TWO SPECS ANSWER FOR IT and the string names the one that drives the
  // FORM. calculateur.nojs.spec.ts still asserts the other half - that this
  // route itself renders no result, which FW13 made a ruling and R351 did
  // not touch.
  'app/(public)/calculateur-teletravail-frontalier/CalculatorForm.tsx': 'resultat.nojs.spec.ts',

  // FW-COMPARATEUR. The comparator's form deliberately has NO no-JS journey
  // to a figure: the arithmetic runs in the browser so that nothing typed is
  // ever sent (R658). What a no-JS reader must get is the page's explanation
  // and the irrevocability banner, and a native submission that carries NO
  // income - its controls have no `name`. That spec drives exactly this.
  'app/(public)/calculateur-lamal-cmu/ComparatorForm.tsx': 'comparateur.nojs.spec.ts',

  // The alert sign-up: the calculator's POST form, and the journey the
  // operator named.
  'lib/ui/react/AlertCapture/AlertCapture.tsx': 'calculateur.nojs.spec.ts',
  'lib/ui/react/PublicShell/PublicShell.tsx': 'burger.nojs.spec.ts',
  'lib/ui/react/Faq/Faq.tsx': 'faq.nojs.spec.ts',
  'lib/guides/mdx-components.tsx': 'guides.nojs.spec.ts',
  // FW-HOME-A2 (R711): the home counter's GET form, the A2 page's no-JS
  // journey - home.nojs.spec.ts submits it with scripting off.
  'lib/ui/react/HomeCounter/HomeCounter.tsx': 'home.nojs.spec.ts',
  'app/releve/print/page.tsx': {
    why:
      'The print document is rendered by Chromium to a PDF on the server and ' +
      'is never navigated by a reader, so there is no no-JS journey through ' +
      'it. tests/db/export-pdf.test.ts drives the render it does have.',
  },
};

const specs = (): string[] => readdirSync(E2E).filter((name) => name.endsWith('.nojs.spec.ts'));

describe('R346: every no-JS surface is driven by the nojs project', () => {
  it('discovers surfaces and specs, so nothing below passes vacuously', () => {
    // R133. An empty walk would satisfy "every surface is covered" perfectly.
    expect(discovered().length, 'no no-JS surface discovered at all').toBeGreaterThanOrEqual(5);
    expect(specs().length, 'no .nojs.spec.ts found').toBeGreaterThanOrEqual(4);
    expect(discovered()).toContain('lib/ui/react/PublicShell/PublicShell.tsx');
  });

  it('classifies every discovered surface - an unclassified one is the finding', () => {
    const unclassified = discovered().filter((path) => COVERAGE[path] === undefined);

    expect(
      unclassified,
      'these render a form or a disclosure and nothing says whether a no-JS ' +
        `journey drives them: ${unclassified.join(', ')}. Add the ` +
        '.nojs.spec.ts that covers it, or say why it needs none.',
    ).toEqual([]);
  });

  it('classifies nothing that is no longer there', () => {
    // The other direction: a classification outliving its surface is a line
    // that reads as coverage and guards nothing.
    const stale = Object.keys(COVERAGE).filter((path) => !discovered().includes(path));

    expect(stale, `classified but no longer a no-JS surface: ${stale.join(', ')}`).toEqual([]);
  });

  it('names a spec that exists, for every surface that claims one', () => {
    const present = specs();

    for (const [path, cover] of Object.entries(COVERAGE)) {
      if (typeof cover !== 'string') continue;

      expect(present, `${path} names ${cover}, which is not in e2e/`).toContain(cover);
    }
  });

  it('refuses an exemption that does not argue for itself', () => {
    for (const [path, cover] of Object.entries(COVERAGE)) {
      if (typeof cover === 'string') continue;

      expect(cover.why.length, `${path} is exempt with no stated reason`).toBeGreaterThan(60);
    }
  });

  it('is a project some script actually runs - a suite nobody runs is not a suite', async () => {
    // THIS CAUGHT ITSELF. Defining the project and moving the specs into it
    // took 18 working assertions OUT of the gate in one commit: test:e2e runs
    // `--project=chromium`, so nothing collected nojs at all, and the gate
    // went green with less coverage than before. A green gate that covers
    // less than it did is the worst shape a refactor can take.
    //
    // ASSERTED OVER EVERY PROJECT, not just this one (R251: a file that
    // determines what runs belongs to a suite). The next project added to
    // playwright.config.ts fails here until a script runs it.
    const config = (await import('@/playwright.config')).default;
    const scripts = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')).scripts as Record<
      string,
      string
    >;
    // THE HAYSTACK INCLUDES THE SCRIPTS THE SCRIPTS CALL. test:visual is
    // `node scripts/visual.mjs`, and the --project=visual lives inside that
    // file - so reading package.json alone would call the visual project
    // uncovered. The first version of this test instead wrote
    // `|| commands.includes('scripts/visual.mjs')`, which is TRUE for every
    // project the moment any script mentions that file: the assertion passed
    // for nojs while nothing ran it, which is the exact vacuity it exists to
    // catch, in the guard rather than the subject.
    const haystack = [
      Object.values(scripts).join(' '),
      ...readdirSync(join(WEB, 'scripts'))
        .filter((name) => name.endsWith('.mjs'))
        .map((name) => readFileSync(join(WEB, 'scripts', name), 'utf8')),
    ].join('\n');

    const names = (config.projects ?? []).map((project) => project.name ?? '');

    expect(names, 'playwright.config.ts defines no projects').not.toEqual([]);
    expect(haystack, 'the haystack did not load').toContain('--project=');

    for (const name of names) {
      expect(
        haystack.includes(`--project=${name}`),
        `the "${name}" project is defined but no package script runs it`,
      ).toBe(true);
    }
  });

  it('leaves the scripting policy to the project, never to a spec', () => {
    // THE HALF THAT KEEPS THE PROJECT HONEST. A spec that turns scripting off
    // for itself runs its assertions wherever it happens to be collected, and
    // that is how the seven scattered blocks came about. The nojs project
    // owns javaScriptEnabled; a spec that sets it is opting out of the
    // enumeration this file exists to keep.
    const offenders = readdirSync(E2E)
      .filter((name) => name.endsWith('.spec.ts'))
      .filter((name) => {
        const code = readFileSync(join(E2E, name), 'utf8')
          .split('\n')
          .filter((line) => !line.trim().startsWith('//'))
          .join('\n');

        return code.includes('javaScriptEnabled');
      });

    expect(
      offenders,
      `these set javaScriptEnabled themselves: ${offenders.join(', ')}. The ` +
        'nojs project supplies it - move the assertion into a .nojs.spec.ts.',
    ).toEqual([]);
  });
});
