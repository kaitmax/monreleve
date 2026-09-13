// web/lib/guides/reading-time.ts
//
// FD13's third metadata chip: "8 min de lecture".
//
// COMPUTED, NEVER AUTHORED, and the brief says so. An authored number is a
// number that was true once: a reviewer adds three sections in FW18, the chip
// still says 8 minutes, and a page whose entire register is "you can believe
// this document" carries a small lie in its furniture.
//
// 200 WORDS PER MINUTE, and the figure is a judgement rather than a
// measurement. Published estimates for French prose sit between 180 and 250;
// 200 is inside that range and round. What the tests pin is the SHAPE - more
// words is more minutes, rounded up, never zero - so revising the constant
// does not rewrite the suite.
//
// MDX SYNTAX IS NOT PROSE. An article body carries comment blocks, JSX
// components and their props; counting those would inflate the estimate for
// exactly the articles that use the component kit most, which is backwards.
// Headings ARE prose - a reader reads them.

/** Words a reader gets through in a minute. See the header. */
const WORDS_PER_MINUTE = 200;

/**
 * Strip what a reader does not read.
 *
 * Order matters: comment blocks first (they can contain anything, including
 * angle brackets), then JSX tags, then the markdown punctuation that hangs
 * off words rather than standing as words.
 */
function prose(body: string): string {
  return body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/[#*_`>|[\]()-]/g, ' ');
}

/**
 * Minutes, rounded up and never zero.
 *
 * An empty article is still a page somebody opened, and "0 min de lecture"
 * reads as a defect rather than as a short article.
 */
export function readingMinutes(body: string): number {
  const words = prose(body)
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
