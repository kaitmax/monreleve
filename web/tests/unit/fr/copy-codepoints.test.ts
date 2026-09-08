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

  it('contains none of the watched codepoints, and that is the CURRENT state rather than a rule', () => {
    // WHEN THIS FAILS, IT IS PROBABLY NOT A BUG. A no-break space before a
    // colon is correct French. What the failure means is that R66's hazard has
    // become live for whichever string gained it, so:
    //
    //   1. add the codepoint to this test's expectation, deliberately;
    //   2. find every assertion that compares against that string, and make
    //      sure it reads textContent and compares exactly - a Testing Library
    //      text query, jest-dom's toHaveTextContent, Playwright's toHaveText
    //      or innerText will all either go red against correct copy or match
    //      either codepoint silently;
    //   3. say so in the session report.
    //
    // The eslint fence on @testing-library/jest-dom covers one route in; the
    // others are conventions, and this is what makes them visible.
    const summary = occurrences.map((o) => `${o.file}: ${o.codepoint} near "${o.context}"`);

    expect(summary, summary.join(' | ')).toEqual([]);
  });
});
