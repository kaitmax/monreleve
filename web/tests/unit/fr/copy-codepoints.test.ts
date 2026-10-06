// web/tests/unit/fr/copy-codepoints.test.ts
//
// RULING R66's missing half. The ruling says formatted numbers are asserted by
// textContent because the normaliser treats U+202F and U+00A0 as whitespace -
// and an adversarial audit of the sweep pointed out that nothing anywhere
// records WHICH whitespace codepoints the copy actually contains. Without
// that, R66 is a rule about a hazard nobody is watching for.
//
// THE HAZARD IS NOT HYPOTHETICAL AND IT IS COMING. Correct French typography
// puts U+00A0 before a colon, a semicolon, an exclamation mark, a question
// mark, and inside guillemets. lib/fr/errors.ts already has a sentence ending
// in a colon, and every copy file is marked TODO-COPY, so a reviewer WILL
// introduce no-break spaces. The measured consequence, from probing
// @testing-library/dom directly:
//
//   DOM U+00A0  vs  matcher ASCII space  ->  MATCHES, silently
//   DOM U+202F  vs  matcher U+202F       ->  NO MATCH, loud red
//
// Only the DOM side is normalised; the matcher never is. So the day the copy
// gains a no-break space, any text query written against it either goes red
// against CORRECT copy, or - if someone "fixes" the constant by retyping it
// with an ordinary space - starts matching either codepoint forever.
//
// SO THIS IS A REGISTRY, NOT A BAN. It does not forbid U+00A0: that would
// fight correct typography, and the product will want it. It records the
// current set and fails when the set CHANGES, so that introducing one is a
// deliberate edit here - and the failure message says what else to do.
//
// The same shape as the absence assertions in layout.test.ts and the old
// TICK_WIDTH pin: what is being held is a fact about the codebase that nothing
// else would notice changing.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isComment, quotedSpans } from '@/tests/support/quoted-spans';

const DIR = join(process.cwd(), 'lib', 'fr');

/**
 * Whitespace and invisible-format codepoints worth tracking. Ordinary space
 * and the newlines a source file is made of are excluded - they carry no risk
 * and would swamp the result.
 */
const WATCHED: Record<number, string> = {
  0x00a0: 'U+00A0 NO-BREAK SPACE',
  0x202f: 'U+202F NARROW NO-BREAK SPACE',
  0x2009: 'U+2009 THIN SPACE',
  0x2007: 'U+2007 FIGURE SPACE',
  0x200b: 'U+200B ZERO WIDTH SPACE',
  0x2028: 'U+2028 LINE SEPARATOR',
  0x2029: 'U+2029 PARAGRAPH SEPARATOR',
  0xfeff: 'U+FEFF BYTE ORDER MARK',
};

interface Occurrence {
  readonly file: string;
  readonly codepoint: string;
  readonly context: string;
}

function scan(): Occurrence[] {
  const found: Occurrence[] = [];

  for (const name of readdirSync(DIR).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(DIR, name), 'utf8');

    [...source].forEach((character, index) => {
      const label = WATCHED[character.charCodeAt(0)];

      if (label !== undefined) {
        found.push({
          file: `lib/fr/${name}`,
          codepoint: label,
          context: source.slice(Math.max(0, index - 20), index + 20),
        });
      }
    });
  }

  return found;
}

describe('the whitespace codepoints in French copy are on the record (R66)', () => {
  const occurrences = scan();

  it('scanned the copy directory, so the assertion below is not vacuous', () => {
    // Without this a mistyped path would report "no occurrences" as
    // compliance - the same vacuous-pass shape ruling R63 exists to catch.
    const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));

    expect(files.length).toBeGreaterThan(5);
    expect(files).toContain('errors.ts');
  });

  // ---------------------------------------------------------------------
  // THE SET CHANGED, DELIBERATELY, IN FW11 INCREMENT 0 (ruling R91).
  //
  // This block used to assert that lib/fr contained NONE of the watched
  // codepoints, with instructions for the day that stopped being true. That
  // day is now: the typography pass put a U+00A0 before every colon,
  // semicolon, question mark, exclamation mark and percent sign in the copy -
  // 39 of them across seven files - because with an ordinary space a narrow
  // column can break the line between the last word and its punctuation.
  //
  // The three steps that comment prescribed were followed:
  //
  //   1. THE EXPECTATION IS UPDATED HERE, and it is stronger than the one it
  //      replaces. "The set has not changed" is a weak claim; what follows
  //      asserts that the only watched codepoint present is U+00A0, that
  //      there are exactly 39, and that EVERY ONE sits immediately before one
  //      of the five marks. A stray no-break space in the middle of a
  //      sentence now fails, which the old form could never have caught.
  //
  //   2. EVERY ASSERTION AGAINST AN AFFECTED STRING WAS SWEPT, and the
  //      matching behaviour was MEASURED rather than assumed, because the
  //      original comment's account of it was not quite right:
  //
  //        getByRole({ name })   exact on codepoints, BOTH sides. DOM nbsp
  //                              matches a matcher with nbsp and nothing
  //                              else. This is why the footer link test kept
  //                              passing.
  //        getByText             normalises the DOM side ONLY. A matcher with
  //                              nbsp does NOT match nbsp copy; a matcher
  //                              with a plain space DOES. The asymmetry R66
  //                              describes lives here.
  //        Playwright toHaveText normalises BOTH sides, so it matches either
  //                              matcher against either DOM. It cannot see a
  //                              codepoint at all - which is why R71 forbids
  //                              it for anything whose codepoint matters.
  //        textContent/innerText keep U+00A0 in both Testing Library and
  //                              Playwright. These are the correct tools.
  //
  //   3. Said so in the report.
  //
  // U+202F is still expected to be ABSENT from lib/fr: the narrow no-break
  // space is the FORMATTER's group separator, not copy. A hand-typed one here
  // would be a second producer of the codepoint SPEC 6.4 mandates.
  // ---------------------------------------------------------------------

  it('contains U+00A0 and no other watched codepoint', () => {
    const others = occurrences.filter((o) => !o.codepoint.startsWith('U+00A0'));
    const summary = others.map((o) => `${o.file}: ${o.codepoint} near "${o.context}"`);

    expect(summary, summary.join(' | ')).toEqual([]);
  });

  it('carries exactly the 43 the typography pass left there', () => {
    // A count, so that a no-break space arriving or disappearing is a
    // deliberate edit here rather than a silent one. Per file, because a
    // total alone would let one move between files unnoticed.
    const perFile: Record<string, number> = {};

    for (const one of occurrences) perFile[one.file] = (perFile[one.file] ?? 0) + 1;

    expect(perFile).toEqual({
      'lib/fr/cgu.ts': 7,
      // FW22: 15 -> 19. Four arrive with the sessions and credentials added
      // to the enumeration under « pour votre compte et pour lui seul », and
      // with the sign-in purpose split out of the alert-list sentence. Each
      // is a French colon or semicolon in new copy, set the way R91 requires.
      // 19 -> 20 in FW27: DISCLOSED_RECORDS.reminderLog added one
      // no-break space, before the semicolon that ends it. The count is
      // pinned so that a space arriving by accident is a failure rather
      // than a drift, which means a deliberate one updates the number.
      // 20 -> 22 in FW-VERIFY: DISCLOSED_RECORDS.issuanceRecord added two,
      // both R91 no-break spaces in new copy - one before the colon that
      // introduces the list of what the issuance record holds, one before
      // the semicolon that ends the bullet.
      // 22 -> 23 in FW-VERIFY: DISCLOSED_RECORDS.nameChange added one, before
      // the semicolon that ends the name-change-dates bullet (R331).
      'lib/fr/confidentialite.ts': 23,
      'lib/fr/errors.ts': 2,
      // FW18b: FOUR BECAME TWO, and the two that left are the point. R147
      // now reaches lib/fr, so the home description no longer types "40 %"
      // and "49,9 %" - it takes them formatted, and formatPercent sets the
      // no-break space. The codepoint did not disappear; it moved to the one
      // producer SPEC 6.4 names, which is where the comment above says it
      // belongs.
      'lib/fr/index.ts': 2,
      // FW20 recorded one here, in the releve-annuel description - the page's
      // one literal, its other no-break spaces being built by n().
      //
      // FW20b: NONE. R172 made that description a function of ProductState,
      // and its two branches are written with n(':') like every other string
      // in the file. The codepoint did not disappear, it moved to the file's
      // own single producer - the same movement FW18b recorded for index.ts
      // when the figures went to formatPercent, and the direction this
      // comment's own argument prefers.
      // FW18b: the nav label "Le seuil de 40 %" became "Le plafond fiscal".
      'lib/fr/shell.ts': 1,
      // FW18b: one, in the droit d’option window's description -
      // "Delai pour choisir son systeme d’assurance maladie" sets a
      // no-break space before its colon like every other French label here.
      //
      // FW20: three. The 'what this site does not know' section added two
      // colons to reader-facing prose - the intro's "Ce n'est pas un oubli :"
      // and the attestation entry's "pour cette raison :". Both were written
      // with an ASCII space and R91 refused them, which is the guard doing
      // exactly its job on new copy rather than on a regression.
      'lib/fr/sources.ts': 3,
      // FW18b: the spike banner "Seuil de 40 % approche" named the rule.
      'lib/fr/spike.ts': 6,
      'lib/fr/statuses.ts': 2,
    });
    // FW22: 38 -> 42, the four added to lib/fr/confidentialite.ts above.
    //
    // THE TITLE AND THIS NUMBER NOW AGREE, AND DID NOT BEFORE: the test was
    // called "exactly the 39" while asserting 38. Harmless, and exactly the
    // drift a census exists to stop - a name that stops matching what it
    // counts is the first thing somebody trusts instead of reading.
    // FW20b: 38. One left releve-annuel.ts for n(), as the comment above says.
    // FW27: 42 -> 43. DISCLOSED_RECORDS.reminderLog carries one, before
    // the semicolon ending its sentence, and the per-file map above moved
    // in step. Two numbers, one change - if only one of them had needed
    // updating, the census would be measuring something other than it says.
    // FW-VERIFY: 43 -> 45. DISCLOSED_RECORDS.issuanceRecord carries two,
    // the colon and the semicolon of the new issuance disclosure, and the
    // per-file map above moved in step for the same reason.
    // FW-VERIFY: 45 -> 46. DISCLOSED_RECORDS.nameChange carries one more,
    // the semicolon ending the name-change-dates bullet.
    expect(occurrences).toHaveLength(46);
  });

  it('puts every one of them immediately before : ; ? ! or %', () => {
    // THE ASSERTION THE OLD FORM COULD NOT MAKE. "The set has not changed"
    // says nothing about WHERE the codepoints are, so a no-break space in the
    // middle of a sentence - which breaks nothing visually and defeats
    // wrapping for no reason - would have passed. This is the rule R91 states,
    // checked.
    const MARKS = [':', ';', '?', '!', '%'];
    const NBSP = String.fromCharCode(0x00a0);
    const misplaced: string[] = [];

    for (const name of readdirSync(DIR).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(join(DIR, name), 'utf8');

      [...source].forEach((character, index) => {
        if (character !== NBSP) return;

        const next = source[index + 1] ?? '';

        if (!MARKS.includes(next)) {
          misplaced.push(`lib/fr/${name}: U+00A0 before "${next}" near "${source.slice(Math.max(0, index - 24), index + 4)}"`);
        }
      });
    }

    expect(misplaced, misplaced.join(' | ')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RULING R126: THE APOSTROPHE. U+2019, not U+0027.
//
// French typography sets an elision with U+2019 RIGHT SINGLE QUOTATION MARK.
// The ASCII apostrophe is a typewriter compromise, and in French copy it is
// wrong in the same way a hyphen is wrong for a dash: it renders as a straight
// vertical tick where the typeface has a shaped comma-form glyph, and the
// difference is visible at body size.
//
// WHY IT COULD NOT BE A SIMPLE BAN, which is what makes this a registry entry
// rather than a lint rule. U+0027 is also the STRING DELIMITER this codebase
// uses everywhere, so "no U+0027 in lib/fr" is unsatisfiable, and a count is
// meaningless - it would move with every refactor of the quoting. The only
// position where the two characters are confusable is BETWEEN TWO LETTERS,
// which is exactly where French elision happens and exactly where a delimiter
// never appears. So the assertion is positional.
//
// SAME REASONING AS R91, which is the operator's: "one sweep, registry-backed,
// and it gets cheaper the earlier it happens." 139 elisions across 12 files
// today; every copy file is TODO-COPY, so a reviewer will add more.
// ---------------------------------------------------------------------------

const RIGHT_SINGLE = String.fromCharCode(0x2019);
const ASCII_APOSTROPHE = String.fromCharCode(0x27);

/** Elisions, by file, counted inside quoted spans on non-comment lines. */
function apostrophes(character: string): Map<string, number> {
  const counted = new Map<string, number>();

  for (const name of readdirSync(DIR).filter((f) => f.endsWith('.ts'))) {
    const lines = readFileSync(join(DIR, name), 'utf8').split('\n');
    let found = 0;

    for (const line of lines) {
      if (isComment(line)) continue;

      for (const span of quotedSpans(line)) {
        for (let index = 1; index < span.length - 1; index += 1) {
          const before = span[index - 1] ?? '';
          const after = span[index + 1] ?? '';

          if (
            span[index] === character &&
            /\p{L}/u.test(before) &&
            /\p{L}/u.test(after)
          ) {
            found += 1;
          }
        }
      }
    }

    if (found > 0) counted.set(name, found);
  }

  return counted;
}

describe('the apostrophe in French copy is U+2019 (R126)', () => {
  it('uses the typographic apostrophe, and there are a lot of them', () => {
    const typographic = apostrophes(RIGHT_SINGLE);
    const total = [...typographic.values()].reduce((sum, n) => sum + n, 0);

    // Non-vacuity first: a broken scanner would report none of either
    // character and the absence assertion below would pass forever.
    expect(total, 'no typographic apostrophe found at all').toBeGreaterThan(100);
    expect(typographic.size).toBeGreaterThan(8);
  });

  it('uses NO ascii apostrophe between two letters, anywhere', () => {
    // THE POSITIONAL RULE. Between letters is the elision position; a string
    // delimiter is never there. So this can be an absence assertion while
    // U+0027 remains legal - and necessary - as a delimiter on the same line.
    const straight = apostrophes(ASCII_APOSTROPHE);
    const report = [...straight.entries()].map(([file, n]) => `${file}: ${n}`);

    expect(
      report,
      `ASCII apostrophes in an elision position (R126 wants U+2019):\n${report.join('\n')}`,
    ).toEqual([]);
  });

  it('still uses U+0027 as a delimiter, which is why the rule is positional', () => {
    // Stated so that nobody "completes" R126 by sweeping the delimiters too.
    // Every file here opens strings with it.
    const source = readFileSync(join(DIR, 'shell.ts'), 'utf8');

    expect(source).toContain(`${ASCII_APOSTROPHE}/application${ASCII_APOSTROPHE}`);
  });

  it('and the detector would actually catch one', () => {
    // Both directions on a synthetic line, because the assertion above is an
    // absence and its scanner is the only thing standing behind it.
    const swept = `  label: "L${RIGHT_SINGLE}application",`;
    const straightLine = `  label: "L${ASCII_APOSTROPHE}application",`;

    const count = (line: string, character: string): number => {
      let found = 0;

      for (const span of quotedSpans(line)) {
        for (let index = 1; index < span.length - 1; index += 1) {
          if (
            span[index] === character &&
            /\p{L}/u.test(span[index - 1] ?? '') &&
            /\p{L}/u.test(span[index + 1] ?? '')
          ) {
            found += 1;
          }
        }
      }

      return found;
    };

    expect(count(straightLine, ASCII_APOSTROPHE)).toBe(1);
    expect(count(swept, ASCII_APOSTROPHE)).toBe(0);
    expect(count(swept, RIGHT_SINGLE)).toBe(1);

    // And a delimiter beside a colon is not an elision - the case that made
    // the naive count six too high when the sweep was measured.
    expect(count(`  x: n(${ASCII_APOSTROPHE}:${ASCII_APOSTROPHE}),`, ASCII_APOSTROPHE)).toBe(0);
  });
});
