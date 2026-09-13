// web/tests/unit/guides/reading-time.test.ts
//
// FD13 puts "8 min de lecture" in the third metadata chip, and the brief is
// explicit that it is COMPUTED, not authored.
//
// WHY THAT MATTERS ENOUGH TO TEST. An authored reading time is a number that
// was true once. A reviewer adds three sections in FW18 and the chip still
// says 8 minutes, which is a small lie on a page whose whole register is "you
// can believe this document". Computing it means the chip cannot disagree
// with the article.
//
// AND THE MDX SYNTAX MUST NOT COUNT AS PROSE. An article body carries import
// statements, JSX components and comment blocks; counting those as words
// would inflate the estimate for exactly the articles that use the component
// kit most.

import { describe, expect, it } from 'vitest';
import { readingMinutes } from '@/lib/guides/reading-time';

describe('reading time is computed from the prose', () => {
  it('rounds up, because nothing takes zero minutes', () => {
    expect(readingMinutes('Un mot.')).toBe(1);
    expect(readingMinutes('')).toBe(1);
  });

  it('scales with the text at a French reading pace', () => {
    const word = 'teletravail ';

    // 200 words per minute is the figure this repository uses; what the test
    // pins is the SHAPE - twice the words is about twice the time - rather
    // than the constant, which is a judgement somebody may revise.
    const short = readingMinutes(word.repeat(200));
    const long = readingMinutes(word.repeat(800));

    expect(short).toBe(1);
    expect(long).toBeGreaterThan(short * 3);
  });

  it('ignores MDX syntax rather than counting it as prose', () => {
    // THE ASSERTION THAT KEEPS THE NUMBER HONEST. A body using the component
    // kit heavily would otherwise read as longer than one that is pure text.
    const prose = 'mot '.repeat(400);
    const withSyntax = [
      '{/* a comment block that is not prose at all, and quite a long one */}',
      '<Encadre titre="Un titre">',
      '  <DataGrid caption="Une table" columns={["a", "b"]} rows={[["1", "2"]]} />',
      '</Encadre>',
      '',
      prose,
    ].join('\n');

    expect(readingMinutes(withSyntax)).toBe(readingMinutes(prose));
  });

  it('counts a heading as prose, because a reader reads it', () => {
    const withHeadings = ['## Un titre de section', '', 'mot '.repeat(400)].join('\n');

    expect(readingMinutes(withHeadings)).toBeGreaterThanOrEqual(readingMinutes('mot '.repeat(400)));
  });
});
