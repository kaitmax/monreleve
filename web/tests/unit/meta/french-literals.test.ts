// web/tests/unit/meta/french-literals.test.ts
//
// RULING R126's other half: after the sweep, keep the copy in one place.
//
// WHAT THE SWEEP FOUND. Moving lib/fr's 139 elisions to U+2019 broke exactly
// ONE assertion out of 1722 - e2e/not-found.spec.ts, which asserted a link's
// accessible name against the hand-typed literal "Revenir a l'accueil". Every
// other assertion in the suite imports its string, which is why a change to
// 139 strings cost one line.
//
// THAT RATIO IS THE ARGUMENT FOR THIS TEST. The discipline held almost
// everywhere, and the one place it lapsed went red against CORRECT copy - the
// most expensive kind of failure, because the obvious fix is to retype the
// literal with the new character and carry on, leaving the second copy of the
// words in place for the next sweep to break again.
//
// getByRole IS WHY IT MATTERS MOST THERE. It matches an accessible name
// exactly on codepoints, BOTH sides (R66), so it is the one matcher where a
// typographic apostrophe cannot be normalised away. A literal in a getByRole
// name is a codepoint-exact duplicate of a string that lives somewhere else.
//
// SO: no French elision outside lib/fr, written either way. U+0027 is
// stale-in-waiting; U+2019 is a duplicate that merely happens to be current.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isComment, quotedSpans } from '@/tests/support/quoted-spans';

const ROOT = process.cwd();
const SEARCHED = ['app', 'e2e', 'lib', 'scripts', 'tests'];

const ASCII_APOSTROPHE = String.fromCharCode(0x27);
const RIGHT_SINGLE = String.fromCharCode(0x2019);

/**
 * A FRENCH ELISION, not any apostrophe between two letters.
 *
 * THE FIRST VERSION MATCHED letter-APOSTROPHE-letter AND WAS WRONG ABOUT
 * ENGLISH. It reported `"renderRailSvg's return value and nothing else"` -
 * an English possessive inside an assertion string - as duplicated French
 * copy. This project writes its own prose in English, so "the engine's", "the
 * panel's" and "Next's" would all have been reported. A guard that cries wolf
 * gets an exemption list instead of a fix, which is how FW10's audit nearly
 * lost its teeth.
 *
 * French elision is a CLOSED SET of particles: the articles, pronouns and
 * conjunctions that drop their vowel before another one. An English
 * possessive puts the apostrophe after a whole word, so the character before
 * it is preceded by more letters and fails the word boundary - "engine's" has
 * an "e" preceded by "n", so there is no boundary and no match.
 */
const ELISION_SOURCE = "\\b(?:[cdjlmnst]|qu|jusqu|lorsqu|puisqu|quelqu)['\u2019](?=\\p{L})";
const ELISION = new RegExp(ELISION_SOURCE, 'iu');

/** The same, restricted to the ASCII apostrophe, for the message. */
const STRAIGHT_ELISION = new RegExp(
  "\\b(?:[cdjlmnst]|qu|jusqu|lorsqu|puisqu|quelqu)'(?=\\p{L})",
  'iu',
);

/**
 * Files allowed to contain an elision, each for a stated reason.
 *
 * A LIST WITH REASONS, not a pattern, because every entry is a place where a
 * French string is the SUBJECT of the test rather than an expectation about
 * the product. If this list grows past a handful, the discipline has drifted
 * and the entries are the record of how.
 */
const ALLOWED: ReadonlyArray<readonly [string, string]> = [
  [
    'tests/support/vocabulary.ts',
    'PERMITTED_NOUNS and FORBIDDEN_CLAIMS are synthetic inputs for the SPEC 20 ' +
      'guard self-test - phrases it must and must not flag. They are not copy, ' +
      'never reach a page, and the patterns themselves carry no apostrophe.',
  ],
  [
    'tests/unit/fr/vocabulary.test.ts',
    'Feeds sentences to the vocabulary guard, including one built to look like ' +
      'real copy. Asserting a detector requires inputs for it.',
  ],
  [
    'tests/unit/fr/french-typography.test.ts',
    'The quoted-span extractor is tested on synthetic source LINES, several of ' +
      'which contain an apostrophe on purpose - that is the case it exists to ' +
      'get right.',
  ],
  [
    'tests/unit/ui-core/rail-xml.test.ts',
    'escapeXml is fed a French sentence to prove it leaves a typographic ' +
      'apostrophe alone rather than entity-encoding it. The string is the ' +
      'escaper input, not a claim about any page.',
  ],
  [
    'tests/unit/meta/french-literals.test.ts',
    'This file. It names both characters and several particles in order to ' +
      'forbid them everywhere else.',
  ],
  [
    'tests/unit/content/product-state.test.ts',
    'Synthetic sentences fed to the R172 claim detector - four it must flag ' +
      'and four it must not. Same case as tests/support/vocabulary.ts: a ' +
      'detector cannot be asserted without inputs, and an absence assertion ' +
      'with a broken detector passes forever. None of them reaches a page.',
  ],
];

interface Hit {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

function walk(directory: string): string[] {
  return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : walk(path);
    }

    return /\.(?:ts|tsx|mjs)$/u.test(entry.name) ? [path] : [];
  });
}

/** Every elision written outside lib/fr, whichever apostrophe it uses. */
function elisionsOutsideCopy(): Hit[] {
  const hits: Hit[] = [];
  const allowed = new Set(ALLOWED.map(([file]) => file));

  for (const directory of SEARCHED) {
    for (const file of walk(directory)) {
      if (file.startsWith('lib/fr/') || allowed.has(file)) continue;

      readFileSync(join(ROOT, file), 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (isComment(line)) return;

          for (const span of quotedSpans(line)) {
            if (ELISION.test(span)) {
              hits.push({ file, line: index + 1, text: line.trim().slice(0, 90) });

              return;
            }
          }
        });
    }
  }

  return hits;
}

describe('French copy is written once, in lib/fr (R126)', () => {
  it('searched a plausible number of files', () => {
    // The walk is generated, so an empty result would report the property as
    // satisfied. This is the vacuous-pass guard R63 exists for.
    const files = SEARCHED.flatMap((directory) => walk(directory));

    expect(files.length).toBeGreaterThan(80);
    expect(files).toContain('e2e/not-found.spec.ts');
  });

  it('has no elision literal outside the copy modules', () => {
    const hits = elisionsOutsideCopy();
    const report = hits.map((hit) => `${hit.file}:${hit.line}  ${hit.text}`);

    expect(
      report,
      'French copy duplicated outside lib/fr - import the constant instead ' +
        `(R126):\n${report.join('\n')}`,
    ).toEqual([]);
  });

  it('names every exemption with a reason', () => {
    // The list is the record of where the discipline does not apply, and a
    // reason is what stops it becoming a place to put inconvenient failures.
    for (const [file, reason] of ALLOWED) {
      expect(reason.length, file).toBeGreaterThan(40);
    }

    expect(
      ALLOWED.length,
      'the exemption list has grown - has the discipline drifted?',
    ).toBeLessThanOrEqual(6);
  });

  it('and the detector would actually catch one', () => {
    // The exact shape that broke: a French name inside a getByRole matcher.
    const straight = `Revenir a l${ASCII_APOSTROPHE}accueil`;
    const curly = `Revenir a l${RIGHT_SINGLE}accueil`;

    expect(ELISION.test(straight)).toBe(true);
    expect(ELISION.test(curly)).toBe(true);
    expect(STRAIGHT_ELISION.test(straight)).toBe(true);
    expect(STRAIGHT_ELISION.test(curly)).toBe(false);

    // Every particle the copy actually uses.
    for (const particle of ['l', 'd', 'n', 's', 'qu', 'c', 'j', 'm', 't']) {
      expect(ELISION.test(`${particle}${RIGHT_SINGLE}accord`), particle).toBe(true);
    }
  });

  it('and does NOT report an English possessive', () => {
    // THE FALSE POSITIVE THAT PRODUCED THE CLOSED SET. This project writes its
    // own prose in English, in comments and in assertion messages, and every
    // "the engine's" would otherwise be reported as duplicated French copy.
    for (const english of [
      "renderRailSvg's return value and nothing else",
      "the engine's own validation",
      "Next's route announcer",
      "the panel's order",
      "it's the same node",
      "a stylesheet's own fill",
    ]) {
      expect(ELISION.test(english), english).toBe(false);
    }
  });
});
