// web/lib/guides/links.ts
//
// Every internal href an article carries, resolved against the route registry
// at build time.
//
// THE DEFECT THIS REFUSES. A guide links /guides/seuil-social-49-9-percent -
// one character off the real slug - and the page renders perfectly. The link
// 404s, the mesh SPEC 9.5 describes has a hole in it, and nothing objects
// until a reader clicks or a crawler reports it months later. Seven articles
// cross-linking each other is exactly the shape where this happens.
//
// SO AN UNKNOWN INTERNAL HREF THROWS, and because the article renders during
// static generation, the throw stops `next build`. The message names the
// article and the href, because "invalid link" in a build log with seven
// candidates is a hunt.
//
// WHAT COUNTS AS INTERNAL: anything starting with a single slash. An external
// link is left alone - this product links to admin.ch and impots.gouv.fr, and
// validating those would mean a network call at build, which is a different
// and much worse idea.
//
// FRAGMENTS AND QUERIES ARE STRIPPED BEFORE THE LOOKUP. A link to
// /sources#avenant-2023 is a link to /sources; the fragment is the page's
// business and no registry can know it.

import { isRegistered } from '@/lib/content/routes';
import { allGuides } from './registry';
import { GUIDES_PATH } from './registry';

/** Internal means "this site": one leading slash, no scheme, no //host. */
export const isInternal = (href: string): boolean =>
  href.startsWith('/') && !href.startsWith('//');

/** The path a href points at, with the fragment and query removed. */
export const pathOf = (href: string): string => href.split('#')[0]?.split('?')[0] ?? '';

/**
 * Every path an article may legitimately link to.
 *
 * TWO SOURCES, DELIBERATELY: the route registry for the product's pages, and
 * the guides directory for the articles - because a guide is a route that
 * lib/content/routes.ts does not enumerate one-by-one. A guide linking a
 * sibling guide is the commonest link in the mesh and must resolve.
 */
export function resolves(href: string): boolean {
  const path = pathOf(href);

  if (path === '') return true; // a bare fragment: same page.
  if (!isInternal(path)) return true; // external, not ours to check.

  if (isRegistered(path)) return true;

  const slug = path.startsWith(`${GUIDES_PATH}/`)
    ? path.slice(GUIDES_PATH.length + 1)
    : null;

  return slug !== null && allGuides().some((guide) => guide.frontmatter.slug === slug);
}

/**
 * Throw unless the href resolves. Called from the MDX link component, which
 * runs during static generation - so this is a build failure, not a runtime
 * one.
 */
export function assertResolves(href: string, article: string): void {
  if (resolves(href)) return;

  throw new Error(
    `Broken internal link in ${article}: "${href}" resolves to no route.\n` +
      '  A guide may link any path in lib/content/routes.ts, or any article in ' +
      'content/guides.\n' +
      '  Check the slug: a link one character off renders perfectly and 404s.',
  );
}

/** Every internal href in an MDX body, in document order. */
export function internalHrefs(body: string): readonly string[] {
  const found: string[] = [];

  // Markdown links, [text](/path), which is how a guide links in prose.
  for (const match of body.matchAll(/\]\((\/[^)\s]*)\)/g)) {
    const href = match[1];

    if (href !== undefined) found.push(href);
  }

  // JSX hrefs, href="/path", which is how the component kit links.
  for (const match of body.matchAll(/href=["'](\/[^"']*)["']/g)) {
    const href = match[1];

    if (href !== undefined) found.push(href);
  }

  return found;
}
