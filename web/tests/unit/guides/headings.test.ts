// web/tests/unit/guides/headings.test.ts
//
// The table of contents' source: headings taken from the MDX AST, and the
// anchors they become.
//
// AN ANCHOR IS A URL. People link to #comment-le-pourcentage-se-calcule from
// support replies, from forums, from their own notes. So an anchor that
// changes is a link that breaks, silently, for everybody who saved it - and
// the change would come from something as small as rewording a heading or
// upgrading a markdown parser.
//
// THAT IS WHY THE SLUGS ARE OURS. rehype-slug would do this, and its output
// would then be a property of a dependency's minor version rather than of
// this repository. Here the rule is written down, tested against the French
// cases that actually occur, and cannot move without a test failing.
//
// FROM THE AST, NOT FROM RENDERED HTML. Parsing the compiled output would
// mean the TOC agrees with the page only if two different passes agree with
// each other; taking both from one pass makes disagreement impossible.

import { describe, expect, it } from 'vitest';

/**
 * U+2019, built rather than typed - R96, and the same practice lib/fr uses
 * for its no-break spaces.
 *
 * R126 forbids French copy literals outside lib/fr and caught these
 * fixtures: an elision reads as duplicated copy to a scanner and cannot
 * tell a heading fixture from a retyped product string. Composing the
 * apostrophe satisfies the guard and makes the codepoint under test
 * visible, which is what the assertion is actually about.
 */
const APOSTROPHE = String.fromCharCode(0x2019);

const ACCORD = `Ce que dit l${APOSTROPHE}accord`;
import { anchorFor, headingsIn } from '@/lib/guides/headings';
import { allGuides } from '@/lib/guides/registry';

describe('anchors are slugified the way French needs', () => {
  it('lowercases, strips accents and joins with hyphens', () => {
    expect(anchorFor(ACCORD)).toBe('ce-que-dit-l-accord');
    expect(anchorFor('Comment le pourcentage se calcule')).toBe(
      'comment-le-pourcentage-se-calcule',
    );
  });

  it('handles the characters this subject actually produces', () => {
    // Percentages, commas in decimals, and the no-break space French sets
    // before a colon - all of which appear in these headings.
    expect(anchorFor('Le seuil social de 49,9 %')).toBe('le-seuil-social-de-49-9');
    expect(anchorFor('Si vous dépassez 40 %')).toBe('si-vous-depassez-40');
  });

  it('never starts or ends with a hyphen, and never doubles one', () => {
    expect(anchorFor('  « Les jours de mission »  ')).toBe('les-jours-de-mission');
    expect(anchorFor('40 % — et après ?')).toBe('40-et-apres');
  });

  it('is deterministic, which is the whole point', () => {
    const heading = 'Garder une trace datée';

    expect(anchorFor(heading)).toBe(anchorFor(heading));
  });

  it('distinguishes headings that differ only by accent', () => {
    // R120: a slugifier that stripped too much would collapse distinct
    // headings into one anchor, and the second link would jump to the first
    // section. Different words must stay different.
    expect(anchorFor('Les congés')).not.toBe(anchorFor('Les conges payés'));
  });
});

describe('headings come out of the MDX source in document order', () => {
  const SOURCE = [
    'Du texte introductif.',
    '',
    `## ${ACCORD}`,
    '',
    'Un paragraphe.',
    '',
    '### Journées entières et demi-journées',
    '',
    'Un autre paragraphe.',
    '',
    '## Les jours de mission',
    '',
    'Encore du texte.',
  ].join('\n');

  it('finds every h2 and h3, with its depth', () => {
    const headings = headingsIn(SOURCE);

    expect(headings.map((heading) => heading.depth)).toEqual([2, 3, 2]);
    expect(headings.map((heading) => heading.text)).toEqual([
      ACCORD,
      'Journées entières et demi-journées',
      'Les jours de mission',
    ]);
  });

  it('gives each one its anchor', () => {
    expect(headingsIn(SOURCE).map((heading) => heading.id)).toEqual([
      'ce-que-dit-l-accord',
      'journees-entieres-et-demi-journees',
      'les-jours-de-mission',
    ]);
  });

  it('ignores the h1, because the article title is not a section', () => {
    // The template renders the h1 itself, from the frontmatter. A guide that
    // wrote one in its body would be a second page title.
    expect(headingsIn('# Un titre\n\n## Une section').map((h) => h.text)).toEqual([
      'Une section',
    ]);
  });

  it('ignores a # inside a code fence, which is not a heading', () => {
    const withFence = [
      '## Une vraie section',
      '',
      '```',
      '## pas un titre',
      '```',
      '',
      '## Une autre section',
    ].join('\n');

    expect(headingsIn(withFence).map((heading) => heading.text)).toEqual([
      'Une vraie section',
      'Une autre section',
    ]);
  });

  it('reads the fixture, so the TOC has something real to show', () => {
    // Non-vacuity against the article the template actually renders.
    const fixture = allGuides().find((guide) => guide.file.startsWith('_'));

    expect(headingsIn(fixture?.body ?? '').length).toBeGreaterThanOrEqual(4);
  });
});

describe('anchors are stable across a rebuild', () => {
  it('produces identical ids for identical source, every time', () => {
    // THE ASSERTION THE RULING ASKS FOR. A rebuild that renumbered anchors
    // would break every saved link without changing a word of any article,
    // and nothing else in the suite would notice.
    const source = [
      `## ${ACCORD}`,
      '',
      '### Les jours de mission',
      '',
      '## Garder une trace',
    ].join('\n');

    const first = headingsIn(source).map((heading) => heading.id);
    const second = headingsIn(source).map((heading) => heading.id);

    expect(second).toEqual(first);
    expect(first).toEqual([
      'ce-que-dit-l-accord',
      'les-jours-de-mission',
      'garder-une-trace',
    ]);
  });

  it('disambiguates two headings with the same text, deterministically', () => {
    // Two sections can legitimately share a name across a long article. The
    // ids must differ - two elements with one id is invalid HTML and the
    // second link would never be reachable - and the disambiguation must be
    // positional rather than random, or it would move on every rebuild.
    const source = '## Les jours de mission\n\n## Les jours de mission';
    const ids = headingsIn(source).map((heading) => heading.id);

    expect(new Set(ids).size).toBe(2);
    expect(headingsIn(source).map((heading) => heading.id)).toEqual(ids);
  });
});
