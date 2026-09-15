// web/tests/unit/guides/typography.test.ts
//
// FRENCH TYPOGRAPHY IN THE GUIDES, which nothing checked until FW17.
//
// THE GAP, FOUND BY READING THE PROMPT AGAINST THE TREE. FW17's protocol says
// "R91's typography guard applies to every string; the registry will refuse
// an ASCII space before a colon". It does not, and did not: the guard scans
// lib/fr/*.ts and nothing else. The FIXTURE PROVES IT - its own title reads
//
//   "Article de demonstration : tout ce que le gabarit sait rendre"
//
// with an ASCII space before the colon, and every suite has been green since
// FW16. A claim that reads as enforced and is not is the exact shape this
// repository keeps finding, and it would have shipped three articles of
// wrong French typography in this task.
//
// WHY IT MATTERS ON THIS SURFACE MORE THAN ANY OTHER. A guide is a reference
// document a stranger is asked to trust. French sets a no-break space before
// : ; ? ! and %, and an ordinary space there is the typographic equivalent of
// a spelling mistake - it reads as a page written by somebody who does not
// write French, on a page about French tax rules.
//
// AND THE NO-BREAK SPACE DOES A SECOND JOB: it stops a line breaking between
// the figure and its percent sign, so "40" never ends a line with "%"
// starting the next one.

import { describe, expect, it } from 'vitest';
import { allGuides } from '@/lib/guides/registry';

/** The five marks French sets off with a no-break space. Same list as R91's. */
const MARKS = [':', ';', '?', '!', '%'];

const SPACE = String.fromCharCode(32);
const NBSP = String.fromCharCode(0x00a0);

/**
 * Every offending position in one string.
 *
 * The same detector R91 uses on lib/fr, applied to content. Kept as a copy
 * rather than imported because that test builds it around a TypeScript-source
 * extractor - quoted spans, comment lines, template literals - and none of
 * that applies to an MDX file, where the prose IS the text.
 */
function offences(value: string): string[] {
  const found: string[] = [];

  for (let index = 1; index < value.length; index += 1) {
    if (value[index - 1] === SPACE && MARKS.includes(value[index] ?? '')) {
      const from = Math.max(0, index - 28);

      found.push(`"...${value.slice(from, index + 1)}" (ASCII space before ${value[index]})`);
    }
  }

  return found;
}

/**
 * Frontmatter and body: a reader meets both.
 *
 * MDX COMMENTS ARE STRIPPED, which is R91's own treatment of TypeScript
 * comments and not a convenience. A {/* ... *\/} block is commentary for
 * whoever maintains the article, it is written in English in this repository,
 * and English does not set a space before a colon. Scanning it would force
 * French typography onto text no reader ever sees - and the first thing it
 * caught was exactly that: an English sentence inside the fixture's header.
 */
const textOf = (guide: { frontmatter: unknown; body: string }): string =>
  [
    ...Object.values(guide.frontmatter as Record<string, unknown>).map((value) =>
      typeof value === 'string' ? value : JSON.stringify(value),
    ),
    guide.body.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' '),
  ].join('\n');

describe('the detector works, so the absence below means something', () => {
  it('finds an ASCII space before each of the five marks', () => {
    for (const mark of MARKS) {
      expect(offences(`Un texte ${mark} suite`), mark).toHaveLength(1);
    }
  });

  it('accepts the no-break space, which is the correct form', () => {
    for (const mark of MARKS) {
      expect(offences(`Un texte${NBSP}${mark} suite`), mark).toEqual([]);
    }
  });

  it('ignores a mark with no space before it, which is not the defect', () => {
    // "40%" is a different question - R147 owns whether the figure is typed
    // at all - and a colon closing a word is correct French for a URL or a
    // ratio.
    expect(offences('Un texte: suite')).toEqual([]);
  });
});

describe('every guide is written in French typography', () => {
  it('reads the articles on disk, so nothing below passes vacuously', () => {
    const guides = allGuides();

    expect(guides.length).toBeGreaterThan(0);
    expect(textOf(guides[0] as never).length).toBeGreaterThan(200);
  });

  it('puts no ASCII space before : ; ? ! or %', () => {
    const found = allGuides().flatMap((guide) =>
      offences(textOf(guide)).map((offence) => `${guide.file} ${offence}`),
    );

    expect(
      found,
      `French sets a no-break space before these marks (R91).\n${found.join('\n')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RULING R126 REACHES CONTENT, AND IT DID NOT.
//
// FW17's protocol says "R126's apostrophe rule applies" to this task's French.
// It is enforced on lib/fr/*.ts by tests/unit/fr/copy-codepoints.test.ts and
// nowhere else - so the fixture writes "n'est", "l'oeil", "d'import" with the
// typewriter apostrophe and every suite has been green since FW16. The same
// shape as the no-break space above: a rule that reads as enforced, on the one
// surface where the French is the product.
//
// THE RULE IS POSITIONAL, and copied from R126's own reasoning rather than
// restated: U+0027 is also the string delimiter, in an MDX file as much as in
// a TypeScript one - `cells={{ seuil: 'x' }}` is a JSX attribute expression
// and its quotes are code. The only place the two characters are confusable is
// BETWEEN TWO LETTERS, which is exactly where French elides and exactly where
// a delimiter never appears.
// ---------------------------------------------------------------------------

const RIGHT_SINGLE = String.fromCharCode(0x2019);
const ASCII_APOSTROPHE = String.fromCharCode(0x27);

/** Every elision written with `character`, with its context. */
function elisions(value: string, character: string): string[] {
  const found: string[] = [];

  for (let index = 1; index < value.length - 1; index += 1) {
    const before = value[index - 1] ?? '';
    const after = value[index + 1] ?? '';

    if (value[index] === character && /\p{L}/u.test(before) && /\p{L}/u.test(after)) {
      found.push(`"${value.slice(Math.max(0, index - 18), index + 8)}"`);
    }
  }

  return found;
}

describe('the elision detector works, so the absence below means something', () => {
  it('finds an ASCII apostrophe between two letters', () => {
    expect(elisions(`Ce n${ASCII_APOSTROPHE}est pas un guide.`, ASCII_APOSTROPHE)).toHaveLength(1);
  });

  it('ignores one that is not between letters, which is a delimiter', () => {
    // The position a JSX attribute expression puts it in. Left legal on
    // purpose: banning it outright would make the component kit unusable
    // from an article.
    expect(elisions(`{ key: ${ASCII_APOSTROPHE}seuil${ASCII_APOSTROPHE} }`, ASCII_APOSTROPHE)).toEqual(
      [],
    );
  });

  it('does not mistake the typographic one for it', () => {
    expect(elisions(`Ce n${RIGHT_SINGLE}est pas un guide.`, ASCII_APOSTROPHE)).toEqual([]);
  });
});

describe('every guide elides with U+2019 (R126)', () => {
  it('uses the typographic apostrophe, and uses it often', () => {
    // NON-VACUITY FIRST. A broken scanner reports none of either character,
    // and the absence assertion below then passes forever.
    const total = allGuides().reduce(
      (sum, guide) => sum + elisions(textOf(guide), RIGHT_SINGLE).length,
      0,
    );

    expect(total, 'no typographic apostrophe in any guide').toBeGreaterThan(5);
  });

  it('uses NO ASCII apostrophe in an elision position', () => {
    const found = allGuides().flatMap((guide) =>
      elisions(textOf(guide), ASCII_APOSTROPHE).map((where) => `${guide.file} ${where}`),
    );

    expect(
      found,
      `French elides with U+2019, not U+0027 (R126).\n${found.join('\n')}`,
    ).toEqual([]);
  });
});
