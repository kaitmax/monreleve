// web/lib/guides/mesh.ts
//
// SPEC 9.5's linking mesh, encoded.
//
// SPEC's own sentence about it: "Linking mesh - THIS DETERMINES WHETHER THE
// SEO STRATEGY WORKS: pillar to every cluster, bidirectional, non-negotiable.
// Cluster to cluster only where genuinely related (49.9 to missions: yes;
// 49.9 to LAMal/CMU: no - forced cross-links dilute the signal). Every guide
// to a calculator, twice."
//
// WHY A CHECKER AND NOT A REVIEW. Those are exactly the rules that get broken
// while writing the sixth article at speed, and every breakage is invisible
// in the article itself: the page renders, the prose reads, the links work.
// What is wrong is a PROPERTY OF THE SET, and nobody sees a set. FW17 and
// FW18 write seven of these; this is the thing that refuses the wrong one.
//
// A PURE FUNCTION OVER THE GUIDES, which is what makes it testable at all: a
// violation is planted by constructing a set rather than by writing a broken
// article to disk and hoping the cleanup runs.
//
// IT REPORTS EVERYTHING IT FINDS. A checker that stopped at the first fault
// would turn FW18 into fix, re-run, discover the next - seven articles deep.
//
// FIXTURES ARE NOT SUBJECT TO IT. The caller passes publishedGuides(), so a
// fixture carries no obligation to link a pillar that does not exist. Its
// hrefs are still resolved, by the template, at build - a fixture with a
// broken link teaches nobody anything.

import { CALCULATOR_PATH } from '@/lib/content/routes';
import { internalHrefs, pathOf, resolves } from './links';
import { GUIDES_PATH } from './registry';
import type { Guide } from './registry';

/** Where the footer's regulatory link points. SPEC 9.5, every guide. */
const SOURCES_PATH = '/sources';

export interface MeshViolation {
  /** A stable id, so a test can assert the RULE rather than its wording. */
  readonly rule: string;
  /** The article at fault, by slug. */
  readonly guide: string;
  /** What is wrong and what to do, in a sentence somebody can act on. */
  readonly detail: string;
}

/** The slug an internal guide href points at, or null. */
function slugOf(href: string): string | null {
  const path = pathOf(href);

  return path.startsWith(`${GUIDES_PATH}/`) ? path.slice(GUIDES_PATH.length + 1) : null;
}

/**
 * Every guide slug an article links to, deduplicated.
 *
 * FROM THE BODY, because that is where an author writes links. The template's
 * own links - the end CTA, the /sources footer, the related list - are the
 * same on every article and are not what the mesh is about: the mesh is the
 * EDITORIAL graph.
 */
function linkedGuides(guide: Guide): ReadonlySet<string> {
  const found = new Set<string>();

  for (const href of internalHrefs(guide.body)) {
    const slug = slugOf(href);

    if (slug !== null) found.add(slug);
  }

  return found;
}

/**
 * SPEC 9.5's mesh, checked.
 *
 * @param guides the PUBLISHED guides; fixtures carry no obligations
 * @param hub the slugs the hub actually lists
 */
export function checkMesh(
  guides: readonly Guide[],
  hub: readonly string[],
): readonly MeshViolation[] {
  const violations: MeshViolation[] = [];
  const add = (rule: string, guide: string, detail: string): void => {
    violations.push({ rule, guide, detail });
  };

  const bySlug = new Map(guides.map((guide) => [guide.frontmatter.slug, guide]));
  const pillars = guides.filter((guide) => guide.frontmatter.cluster === 'pillar');
  const clusters = guides.filter((guide) => guide.frontmatter.cluster === 'cluster');
  const hubSet = new Set(hub);

  for (const guide of guides) {
    const { slug, related } = guide.frontmatter;
    const links = linkedGuides(guide);

    // EVERY INTERNAL HREF RESOLVES. The template enforces this at build for
    // the article it renders; here it is a property of the SET, reported
    // beside the mesh faults rather than as a separate build failure, so one
    // run tells an author everything.
    //
    // A GUIDE LINK RESOLVES AGAINST THE SET THIS WAS GIVEN, not against the
    // disk - and the first version got that wrong, which its own test caught:
    // it called resolves(), which reads content/guides, so a synthetic set
    // could never pass and the checker was asserting against global state
    // while claiming to be a function of its argument. The mesh is a property
    // of the set; everything else - product routes, external links - is not,
    // and still goes to the registry.
    for (const href of internalHrefs(guide.body)) {
      const target = slugOf(href);
      const ok = target === null ? resolves(href) : bySlug.has(target);

      if (!ok) {
        add(
          'href-resolves',
          slug,
          `links "${href}", which resolves to no route. A slug one character ` +
            'off renders perfectly and 404s.',
        );
      }
    }

    // SPEC 9.5: "every guide to a calculator, TWICE: inline at the moment the
    // reader realises they cannot do the math, and the end Tile."
    //
    // THE END TILE IS THE TEMPLATE'S and every article gets it; what an
    // author must supply is the INLINE one. Counting only what the body
    // carries is therefore the honest half of the rule - and the rendered
    // page's two links, in order, are asserted in e2e where position can be
    // seen (R119).
    const calculatorLinks = internalHrefs(guide.body).filter(
      (href) => pathOf(href) === CALCULATOR_PATH,
    );

    if (calculatorLinks.length < 1) {
      add(
        'calculator-link-inline',
        slug,
        'carries no inline link to the calculator. SPEC 9.5 wants two per ' +
          'guide: the end card is the template, the inline one is yours.',
      );
    }

    // SPEC 9.5: "every guide carries a derniere verification date and links
    // /sources in its footer."
    if (!internalHrefs(guide.body).some((href) => pathOf(href) === SOURCES_PATH)) {
      add(
        'links-sources',
        slug,
        `does not link ${SOURCES_PATH}. Every rule cited in a guide has to ` +
          'reach its source.',
      );
    }

    // "A guide cannot exist and be absent from the hub."
    if (!hubSet.has(slug)) {
      add('in-hub', slug, 'is not listed on the hub, so nothing links to it from the site.');
    }

    // BIDIRECTIONAL, NON-NEGOTIABLE - the cluster's half.
    if (guide.frontmatter.cluster === 'cluster') {
      const linksAPillar = pillars.some((pillar) => links.has(pillar.frontmatter.slug));

      if (pillars.length > 0 && !linksAPillar) {
        add(
          'cluster-links-pillar',
          slug,
          'does not link back to the pillar. SPEC 9.5 calls the pillar-cluster ' +
            'link bidirectional and non-negotiable.',
        );
      }
    }

    // CLUSTER TO CLUSTER ONLY WHERE DECLARED ON BOTH SIDES. This is the rule
    // that turns "forced cross-links dilute the signal" from an editorial
    // opinion into something a machine can refuse.
    if (guide.frontmatter.cluster !== 'pillar') {
      for (const target of links) {
        const other = bySlug.get(target);

        if (other === undefined) continue;
        if (other.frontmatter.cluster === 'pillar') continue;
        if (target === slug) continue;

        const declaredHere = related.includes(target);
        const declaredThere = other.frontmatter.related.includes(slug);

        if (!declaredHere || !declaredThere) {
          add(
            'undeclared-cross-link',
            slug,
            `links ${target} without both sides declaring it in \`related\`. ` +
              (declaredHere
                ? `${target} does not list ${slug}.`
                : `${slug} does not list ${target}.`),
          );
        }
      }
    }
  }

  // BIDIRECTIONAL, NON-NEGOTIABLE - the pillar's half.
  for (const pillar of pillars) {
    for (const cluster of clusters) {
      const links = linkedGuides(pillar);

      if (!links.has(cluster.frontmatter.slug)) {
        add(
          'pillar-links-every-cluster',
          pillar.frontmatter.slug,
          `does not link the cluster ${cluster.frontmatter.slug}. The pillar ` +
            'links every cluster - that is what makes it the pillar.',
        );
      }
    }
  }

  return violations;
}

/** Every violation, as a message a build or a test can print. */
export function describeMesh(violations: readonly MeshViolation[]): string {
  if (violations.length === 0) return 'mesh: no violations (SPEC 9.5).';

  return [
    `mesh: ${String(violations.length)} violation(s) of SPEC 9.5:`,
    ...violations.map((violation) => `  [${violation.rule}] ${violation.guide} ${violation.detail}`),
  ].join('\n');
}
