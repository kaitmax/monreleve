// web/tests/unit/guides/mesh.test.ts
//
// SPEC 9.5's linking mesh, made mechanical.
//
// "THIS DETERMINES WHETHER THE SEO STRATEGY WORKS" is SPEC's own sentence
// about the mesh, and the rules it states are the kind that get broken at
// 2 a.m. in FW18 by somebody writing the sixth article: pillar to every
// cluster and back, cross-links only where both sides declare them, two
// calculator links per guide, /sources in every footer. A rule that lives
// only in a document is a rule that will be broken.
//
// THE CHECKER IS A PURE FUNCTION OVER THE GUIDE SET, which is what makes
// these tests possible: a violation is PLANTED by constructing a set, not by
// writing a broken article to disk and hoping the cleanup runs. Each of AC2's
// five is planted, captured and shown to be reported.
//
// IT REPORTS EVERY VIOLATION, NOT THE FIRST. A checker that stops at one
// turns FW18 into a guessing game: fix, re-run, discover the next, seven
// times over. Asserted directly - a set with three faults reports three.

import { describe, expect, it } from 'vitest';
import { checkMesh } from '@/lib/guides/mesh';
import type { Guide } from '@/lib/guides/registry';
import { CALCULATOR_PATH } from '@/lib/content/routes';

/** A guide, as the registry would hand it over. */
const guide = (
  slug: string,
  cluster: 'pillar' | 'cluster' | 'canton',
  patch: Partial<{ related: string[]; body: string }> = {},
): Guide => ({
  file: `${slug}.mdx`,
  frontmatter: {
    title: `Un titre pour ${slug}`,
    description: 'Une description assez longue pour passer le contrat de frontmatter.',
    slug,
    cluster,
    related: patch.related ?? [],
    lastReviewed: '2026-09-09',
    reviewer: 'FW16',
    faq: [],
    claims: [],
  },
  body:
    patch.body ??
    [`Un lien vers [le calculateur](${CALCULATOR_PATH}).`, 'Et vers [les sources](/sources).'].join(
      '\n\n',
    ),
});

/** The pillar links every cluster; each cluster links back. A valid mesh. */
const VALID: readonly Guide[] = [
  guide('le-pilier', 'pillar', {
    body: [
      `Le [calculateur](${CALCULATOR_PATH}).`,
      'Les [sources](/sources).',
      'Voir [le premier](/guides/premier-cluster) et [le second](/guides/second-cluster).',
    ].join('\n\n'),
  }),
  guide('premier-cluster', 'cluster', {
    body: [
      `Le [calculateur](${CALCULATOR_PATH}).`,
      'Les [sources](/sources).',
      'Retour au [pilier](/guides/le-pilier).',
    ].join('\n\n'),
  }),
  guide('second-cluster', 'cluster', {
    body: [
      `Le [calculateur](${CALCULATOR_PATH}).`,
      'Les [sources](/sources).',
      'Retour au [pilier](/guides/le-pilier).',
    ].join('\n\n'),
  }),
];

const hubOf = (guides: readonly Guide[]): string[] =>
  guides.map((entry) => entry.frontmatter.slug);

const rules = (violations: readonly { rule: string }[]): string[] =>
  violations.map((violation) => violation.rule);

describe('a correct mesh reports nothing', () => {
  it('passes the valid set, so every planted failure below means something', () => {
    // R120's shape. If the checker reported violations for a correct mesh,
    // every "it catches X" test would pass for the wrong reason.
    expect(checkMesh(VALID, hubOf(VALID))).toEqual([]);
  });
});

describe('AC2: each planted violation is caught', () => {
  it('1. a cluster missing its pillar backlink', () => {
    // SPEC 9.5: "pillar to every cluster, bidirectional, NON-NEGOTIABLE".
    // A cluster that does not link back is the half nobody notices, because
    // the pillar's own links all work.
    const broken = VALID.map((entry) =>
      entry.frontmatter.slug === 'second-cluster'
        ? guide('second-cluster', 'cluster', {
            body: `Le [calculateur](${CALCULATOR_PATH}). Les [sources](/sources).`,
          })
        : entry,
    );

    expect(rules(checkMesh(broken, hubOf(broken)))).toContain('cluster-links-pillar');
  });

  it('2. a guide with fewer than two calculator links', () => {
    // SPEC 9.5: "every guide to a calculator, TWICE". One of them is the
    // template's end card, which every article gets; the other is the inline
    // link the AUTHOR places "at the moment the reader realises they cannot
    // do the math". A guide with none is a guide that never offers the tool.
    const broken = VALID.map((entry) =>
      entry.frontmatter.slug === 'premier-cluster'
        ? guide('premier-cluster', 'cluster', {
            body: 'Les [sources](/sources). Retour au [pilier](/guides/le-pilier).',
          })
        : entry,
    );

    expect(rules(checkMesh(broken, hubOf(broken)))).toContain('calculator-link-inline');
  });

  it('3. a guide absent from the hub', () => {
    // "A guide cannot exist and be absent from the hub." The hub is generated
    // from the registry, so this cannot happen by accident today - and the
    // rule is what keeps it impossible if the hub ever gains a hand-written
    // list.
    const hub = hubOf(VALID).filter((slug) => slug !== 'second-cluster');

    expect(rules(checkMesh(VALID, hub))).toContain('in-hub');
  });

  it('4. a link to a route not in the registry', () => {
    const broken = VALID.map((entry) =>
      entry.frontmatter.slug === 'le-pilier'
        ? guide('le-pilier', 'pillar', {
            body: [
              `Le [calculateur](${CALCULATOR_PATH}).`,
              'Les [sources](/sources).',
              'Voir [le premier](/guides/premier-cluster) et [le second](/guides/second-cluster).',
              'Et [une page qui nexiste pas](/guides/pas-un-guide).',
            ].join('\n\n'),
          })
        : entry,
    );

    expect(rules(checkMesh(broken, hubOf(broken)))).toContain('href-resolves');
  });

  it('5. an undeclared cross-link between clusters', () => {
    // SPEC 9.5: "cluster to cluster only where genuinely related (49.9 to
    // missions: yes; 49.9 to LAMal/CMU: no - forced cross-links dilute the
    // signal)". Declared on BOTH sides or it is not a relationship, which is
    // how an editorial judgement becomes mechanical.
    const broken = VALID.map((entry) =>
      entry.frontmatter.slug === 'premier-cluster'
        ? guide('premier-cluster', 'cluster', {
            body: [
              `Le [calculateur](${CALCULATOR_PATH}).`,
              'Les [sources](/sources).',
              'Retour au [pilier](/guides/le-pilier).',
              'Et [le second](/guides/second-cluster), sans le declarer.',
            ].join('\n\n'),
          })
        : entry,
    );

    expect(rules(checkMesh(broken, hubOf(broken)))).toContain('undeclared-cross-link');
  });
});

describe('the rules SPEC states that the five do not cover', () => {
  it('catches a pillar that does not link every cluster', () => {
    const broken = VALID.map((entry) =>
      entry.frontmatter.slug === 'le-pilier'
        ? guide('le-pilier', 'pillar', {
            body: [
              `Le [calculateur](${CALCULATOR_PATH}).`,
              'Les [sources](/sources).',
              'Voir [le premier](/guides/premier-cluster).',
            ].join('\n\n'),
          })
        : entry,
    );

    expect(rules(checkMesh(broken, hubOf(broken)))).toContain('pillar-links-every-cluster');
  });

  it('catches a guide that does not link /sources', () => {
    const broken = VALID.map((entry) =>
      entry.frontmatter.slug === 'second-cluster'
        ? guide('second-cluster', 'cluster', {
            body: `Le [calculateur](${CALCULATOR_PATH}). Retour au [pilier](/guides/le-pilier).`,
          })
        : entry,
    );

    expect(rules(checkMesh(broken, hubOf(broken)))).toContain('links-sources');
  });

  it('accepts a declared cross-link, so the rule is about the DECLARATION', () => {
    // R120: if the checker refused every cross-link, test 5 above would pass
    // and the mesh would be unbuildable. Declared on both sides is allowed.
    const linked = [
      VALID[0] as Guide,
      guide('premier-cluster', 'cluster', {
        related: ['second-cluster'],
        body: [
          `Le [calculateur](${CALCULATOR_PATH}).`,
          'Les [sources](/sources).',
          'Retour au [pilier](/guides/le-pilier).',
          'Et [le second](/guides/second-cluster).',
        ].join('\n\n'),
      }),
      guide('second-cluster', 'cluster', {
        related: ['premier-cluster'],
        body: [
          `Le [calculateur](${CALCULATOR_PATH}).`,
          'Les [sources](/sources).',
          'Retour au [pilier](/guides/le-pilier).',
        ].join('\n\n'),
      }),
    ];

    expect(checkMesh(linked, hubOf(linked))).toEqual([]);
  });

  it('refuses a cross-link declared on ONE side only', () => {
    // The asymmetric case, which is what "declared on both sides" means and
    // the likeliest way to get it wrong: an author adds the link and the
    // `related` entry to their own article and not to the other one.
    const oneSided = [
      VALID[0] as Guide,
      guide('premier-cluster', 'cluster', {
        related: ['second-cluster'],
        body: [
          `Le [calculateur](${CALCULATOR_PATH}).`,
          'Les [sources](/sources).',
          'Retour au [pilier](/guides/le-pilier).',
          'Et [le second](/guides/second-cluster).',
        ].join('\n\n'),
      }),
      VALID[2] as Guide,
    ];

    expect(rules(checkMesh(oneSided, hubOf(oneSided)))).toContain('undeclared-cross-link');
  });
});

describe('it reports every violation, not the first', () => {
  it('finds three faults in a set that has three', () => {
    // A checker that stopped at one would turn FW18 into fix-rerun-discover,
    // seven articles deep.
    const broken = [
      guide('le-pilier', 'pillar', { body: 'Rien du tout.' }),
      guide('premier-cluster', 'cluster', { body: 'Rien non plus.' }),
      guide('second-cluster', 'cluster', { body: 'Toujours rien.' }),
    ];

    const found = checkMesh(broken, hubOf(broken));

    // Every guide is missing its calculator link and its /sources link, and
    // the mesh links are absent in both directions.
    expect(found.length).toBeGreaterThanOrEqual(6);
    expect(new Set(rules(found)).size).toBeGreaterThanOrEqual(3);
  });

  it('names the guide in every violation it reports', () => {
    // A violation nobody can locate is a violation nobody fixes.
    const broken = [guide('le-pilier', 'pillar', { body: 'Rien.' })];

    for (const violation of checkMesh(broken, hubOf(broken))) {
      expect(violation.guide, violation.rule).toContain('le-pilier');
      expect(violation.detail.length).toBeGreaterThan(20);
    }
  });
});

describe('the real content passes', () => {
  it('reports nothing for what is on disk today', async () => {
    // The fixture is excluded from the mesh's obligations - it is not
    // content - but its LINKS are still resolved, because a fixture with a
    // broken link teaches the checker nothing.
    const { publishedGuides } = await import('@/lib/guides/registry');
    const published = publishedGuides();

    expect(checkMesh(published, published.map((entry) => entry.frontmatter.slug))).toEqual([]);
  });
});
