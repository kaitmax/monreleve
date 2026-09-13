// web/tests/unit/guides/frontmatter.test.ts
//
// The frontmatter contract: what an article must declare, and what happens
// when it does not.
//
// THE FAILURE MODE THIS EXISTS FOR. FW17 and FW18 write seven articles at
// speed. The defects that arrive with content are not exotic - a missing
// review date, a cluster typo, a FAQ entry with a question and no answer, a
// slug that disagrees with the file it is in - and every one of them produces
// a page that RENDERS. A guide with no derniere verification date
// contradicts SPEC 9.5 while looking finished; a slug mismatch changes a URL
// under the readers who bookmarked it.
//
// SO THE CONTRACT THROWS, and the registry calls it while `next build`
// collects page data. The build stops with the file named. These tests are
// the proof that each refusal actually happens, because a validator nobody
// has seen reject anything is a validator nobody can trust.

import { describe, expect, it } from 'vitest';
import { CLUSTERS, parseFrontmatter } from '@/lib/guides/frontmatter';

/** A valid article's frontmatter, as the fixture declares it. */
const VALID = {
  title: 'Un titre assez long pour passer',
  description:
    'Une description assez longue pour etre utile dans un resultat de recherche, avec du contexte.',
  slug: 'un-guide-de-demonstration',
  cluster: 'cluster',
  related: ['un-autre-guide'],
  lastReviewed: '2026-09-09',
  reviewer: 'FW16',
  faq: [
    {
      question: 'Une question posee',
      answer: 'Une reponse assez longue pour etre une reponse et pas un mot.',
    },
  ],
};

const parse = (patch: Record<string, unknown>): unknown =>
  parseFrontmatter({ ...VALID, ...patch }, 'un-guide-de-demonstration.mdx');

describe('a complete frontmatter is accepted', () => {
  it('returns the parsed contract', () => {
    const parsed = parseFrontmatter(VALID, 'x.mdx');

    expect(parsed.slug).toBe('un-guide-de-demonstration');
    expect(parsed.cluster).toBe('cluster');
    expect(parsed.faq.length).toBe(1);
  });

  it('defaults related and faq to empty rather than demanding them', () => {
    // A canton page may relate to nothing and a short guide may have no FAQ.
    // Absent is a legitimate state; EMPTY STRINGS are not, which is what the
    // minimums below are for.
    const parsed = parseFrontmatter(
      { ...VALID, related: undefined, faq: undefined },
      'x.mdx',
    );

    expect(parsed.related).toEqual([]);
    expect(parsed.faq).toEqual([]);
  });
});

describe('an incomplete frontmatter fails, with the file named', () => {
  it('names the file, because the build has seven candidates', () => {
    // zod says WHICH FIELD is wrong and nothing about which article. A build
    // failing on "expected string" with seven guides in the tree is a hunt.
    expect(() => parse({ reviewer: undefined })).toThrow(
      /un-guide-de-demonstration\.mdx/,
    );
  });

  it.each([
    ['title', { title: 'court' }],
    ['description', { description: 'trop court' }],
    ['reviewer', { reviewer: undefined }],
    ['lastReviewed', { lastReviewed: undefined }],
  ])('refuses a missing or too-short %s', (_field, patch) => {
    expect(() => parse(patch)).toThrow();
  });

  it('refuses a cluster outside SPEC 9.5s three roles', () => {
    // The mesh checker keys every rule on this value: a pillar must link
    // every cluster, a cluster must link back, a canton page answers to
    // neither. A typo here would silently exempt an article from the mesh.
    expect(() => parse({ cluster: 'piller' })).toThrow();

    for (const cluster of CLUSTERS) {
      expect(() => parse({ cluster })).not.toThrow();
    }
  });

  it('refuses a lastReviewed that is not an ISO day (R28)', () => {
    for (const bad of ['09/09/2026', '2026-9-9', 'septembre 2026', '2026-09-09T10:00:00Z']) {
      expect(() => parse({ lastReviewed: bad }), bad).toThrow();
    }

    expect(() => parse({ lastReviewed: '2026-09-09' })).not.toThrow();
  });

  it('refuses a slug that is not lowercase words joined by hyphens', () => {
    // SPEC 14: slugs are permanent and carry the search term. An uppercase
    // or accented slug is a URL somebody will have to live with.
    for (const bad of ['Un-Guide', 'un_guide', 'un guide', 'un-guide-', 'teletravail-40%']) {
      expect(() => parse({ slug: bad }), bad).toThrow();
    }
  });

  it('refuses a FAQ entry with a question and no real answer', () => {
    // THE ONE THAT MATTERS FOR STRUCTURED DATA. FW15's rule is that a claim
    // in JSON-LD must be visible on the page; an empty answer publishes a
    // FAQPage entry that answers nothing, which is worse than omitting it.
    expect(() => parse({ faq: [{ question: 'Une question posee', answer: 'non' }] })).toThrow();
    expect(() => parse({ faq: [{ question: 'court', answer: VALID.faq[0]?.answer }] })).toThrow();
  });
});
