// web/tests/unit/guides/nav-links.test.ts
//
// FW33, approved as H10: the footer's Guides column lists every published
// article, and SPEC 9.2's "full sitemap" is the reason. Each link is labelled
// with the article's OWN breadcrumbLabel (R181) - the footer names the page
// the way the page names itself, and a label typed in lib/fr/shell.ts would be
// a transcription that drifts the day a label is edited.
//
// DERIVED FROM THE REGISTRY, so the assertions read the registry too (R171).
// A literal list of seven labels here would be the same transcription one
// file over.

import { describe, expect, it } from 'vitest';
import { CLUSTERS } from '@/lib/guides/frontmatter';
import { GUIDES_PATH, guideNavLinks, publishedGuides } from '@/lib/guides/registry';
import { isLive } from '@/lib/content/routes';

describe('guideNavLinks', () => {
  it('offers every published guide, and no fixture', () => {
    const links = guideNavLinks();

    expect(links).toHaveLength(publishedGuides().length);
    // NON-VACUITY: an empty registry would satisfy the length check above.
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((link) => link.href.includes('/_'))).toBe(false);
  });

  it("labels each link with the article's own breadcrumbLabel and links its URL", () => {
    const bySlug = new Map(
      guideNavLinks().map((link) => [link.href.slice(GUIDES_PATH.length + 1), link.label]),
    );

    for (const guide of publishedGuides()) {
      expect(bySlug.get(guide.frontmatter.slug), guide.frontmatter.slug).toBe(
        guide.frontmatter.breadcrumbLabel,
      );
    }
  });

  it('links only live routes, so the footer cannot link a 404 (R85)', () => {
    for (const link of guideNavLinks()) {
      expect(isLive(link.href), link.href).toBe(true);
    }
  });

  it("puts the pillar first, then the clusters, then the canton pages - the hub's order", () => {
    const clusterOf = new Map(
      publishedGuides().map((guide) => [
        `${GUIDES_PATH}/${guide.frontmatter.slug}`,
        guide.frontmatter.cluster,
      ]),
    );
    const order = guideNavLinks().map((link) => CLUSTERS.indexOf(clusterOf.get(link.href) ?? 'canton'));

    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(clusterOf.get(guideNavLinks()[0]?.href ?? '')).toBe('pillar');
  });
});
