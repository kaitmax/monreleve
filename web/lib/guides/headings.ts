// web/lib/guides/headings.ts
//
// The table of contents' source, and the anchors it links to.
//
// AN ANCHOR IS A URL, AND THAT IS THE WHOLE REASON THIS FILE EXISTS. People
// link to #comment-le-pourcentage-se-calcule from support replies, from
// forums, from their own notes. An anchor that changes is a link that breaks
// silently for everybody who saved it - and the change could come from
// something as small as a dependency's minor version deciding to slugify
// differently.
//
// SO THE RULE IS OURS AND IT IS WRITTEN DOWN. rehype-slug would do this job;
// its output would then be a property of somebody else's release notes.
// Here the rule is tested against the cases this subject actually produces -
// accents, percentages, decimal commas - and cannot move without a test
// failing.
//
// ONE PASS, NOT TWO. The headings and their ids come from the same read, and
// the page gives those ids to the rendered headings, so the TOC cannot
// disagree with the document it indexes. Parsing the COMPILED HTML for
// headings would mean the two agree only if two passes agree with each other.

export interface Heading {
  /** 2 or 3. The h1 is the article title and is not a section. */
  readonly depth: 2 | 3;
  readonly text: string;
  /** The anchor, slugified. Unique within the article. */
  readonly id: string;
}

/**
 * A heading's anchor.
 *
 * FRENCH FIRST: accents are decomposed and their marks dropped, so "dépassez"
 * and "depassez" reach the same ascii - which is what a URL wants - while
 * distinct WORDS stay distinct. Everything that is not a letter or a digit
 * becomes a separator, runs collapse, and the ends are trimmed.
 */
export function anchorFor(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Lines inside a fenced code block are not markdown. */
function withoutFences(source: string): string[] {
  const lines = source.split('\n');
  const kept: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (!inFence) kept.push(line);
  }

  return kept;
}

/**
 * Every h2 and h3 in an article, in document order.
 *
 * THE h1 IS SKIPPED DELIBERATELY. The template renders the title from the
 * frontmatter, so a body h1 would be a second page title - and it is not a
 * section of the article either way.
 *
 * IDENTICAL HEADINGS ARE DISAMBIGUATED BY POSITION, not by a counter that
 * could restart differently: two sections may legitimately share a name
 * across a long article, two elements cannot share an id, and a random
 * suffix would move on every rebuild - which is the one thing an anchor must
 * never do.
 */
export function headingsIn(source: string): readonly Heading[] {
  const seen = new Map<string, number>();
  const headings: Heading[] = [];

  for (const line of withoutFences(source)) {
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);

    if (match === null) continue;

    const depth = match[1]?.length === 3 ? 3 : 2;
    const text = (match[2] ?? '').trim();
    const base = anchorFor(text);
    const taken = seen.get(base) ?? 0;

    seen.set(base, taken + 1);

    headings.push({
      depth,
      text,
      id: taken === 0 ? base : `${base}-${String(taken + 1)}`,
    });
  }

  return headings;
}
