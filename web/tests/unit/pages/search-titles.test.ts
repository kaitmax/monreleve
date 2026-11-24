// web/tests/unit/pages/search-titles.test.ts
//
// FW-SEO-TITLES. What a search result shows for this site: the <title> and
// the description of each page a reader can land on.
//
// THE FAILURE MODE THIS EXISTS FOR. Seven weeks of Search Console data showed
// pages printed under queries they did not name: a guide titled without the
// word "frontalier", a page whose whole title was its section label, and TWO
// pages leading their title with the same phrase, so the comparator and the
// guide competed for one query and neither won it. None of that fails a
// build. A title is copy, and copy that renders is copy that passes.
//
// WHAT IS ASSERTED, AND AS VALUES (R345): the limits below are stated, never
// inherited from whatever the strings happen to measure today.

import { describe, expect, it } from 'vitest';
import { APPLICATION_COPY } from '@/lib/fr/application';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { publishedGuides } from '@/lib/guides/registry';

/** A result's title is cut near sixty characters; two of margin. */
const TITLE_MAX = 62;

/** A result's description is cut near one hundred and sixty. */
const DESCRIPTION_MAX = 160;

/** The word every query in this product's subject carries. */
const AUDIENCE = /frontalier/iu;

const guides = publishedGuides().map((guide) => guide.frontmatter);

describe('a guide’s title is written for the reader who searched', () => {
  it('finds the published guides before measuring them (R169)', () => {
    // An empty registry would satisfy every assertion below.
    expect(guides.length).toBeGreaterThanOrEqual(7);
  });

  it.each(guides.map((guide) => [guide.slug, guide] as const))(
    '%s names its audience and fits a result',
    (_slug, guide) => {
      expect(guide.title).toMatch(AUDIENCE);
      expect(guide.title.length).toBeLessThanOrEqual(TITLE_MAX);
      expect(guide.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    },
  );
});

describe('a tool page has a search title of its own', () => {
  // The h1 stays the page's name; the <title> is what a result prints. One
  // string doing both jobs is how /application came to be listed as
  // "L’application" under every query it appeared for.
  const pages = [
    ['calculateur', CALCULATEUR_COPY],
    ['application', APPLICATION_COPY],
    ['comparateur', LAMAL_COPY],
  ] as const;

  it.each(pages)('%s declares a metaTitle that names the audience', (_name, copy) => {
    const metaTitle = (copy as { readonly metaTitle?: string }).metaTitle;

    expect(typeof metaTitle).toBe('string');
    expect(metaTitle).toMatch(AUDIENCE);
    expect(String(metaTitle).length).toBeLessThanOrEqual(TITLE_MAX);
    expect(metaTitle).not.toBe(copy.title);
  });

  it('the calculator’s metadata carries it', async () => {
    const page = await import('@/app/(public)/calculateur-teletravail-frontalier/page');

    expect(page.generateMetadata().title).toBe(
      (CALCULATEUR_COPY as { readonly metaTitle?: string }).metaTitle,
    );
  });

  it('the application page’s metadata carries it', async () => {
    const page = await import('@/app/(public)/application/page');

    expect(page.metadata.title).toBe(
      (APPLICATION_COPY as { readonly metaTitle?: string }).metaTitle,
    );
  });
});

describe('one query, one page', () => {
  it('exactly one title names the right the guide is about', () => {
    // The guide EXPLAINS the right; the comparator ESTIMATES a cost. While
    // both titles opened on the same phrase they were two candidates for one
    // query. The phrase is the first two words of the guide's own title, read
    // from the registry, so this follows a rename and types no French (R181,
    // R126).
    const titles = [
      ...guides.map((guide) => guide.title),
      LAMAL_COPY.metaTitle,
      String((CALCULATEUR_COPY as { readonly metaTitle?: string }).metaTitle),
      String((APPLICATION_COPY as { readonly metaTitle?: string }).metaTitle),
    ];
    const guideTitle = guides.find((guide) => guide.slug === 'droit-option-lamal-cmu')?.title ?? '';
    const phrase = guideTitle.split(' ').slice(0, 2).join(' ').toLowerCase();

    expect(phrase.length).toBeGreaterThan(8);

    const naming = titles.filter((title) => title.toLowerCase().includes(phrase));

    expect(naming).toHaveLength(1);
    expect(naming[0]).toBe(guideTitle);
  });
});
