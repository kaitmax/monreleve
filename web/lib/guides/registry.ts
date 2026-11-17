// web/lib/guides/registry.ts
//
// Every guide on disk, with its validated frontmatter. The single source the
// hub, the router, the mesh checker and the sitemap all read.
//
// FILESYSTEM RATHER THAN A HAND-WRITTEN LIST, and SPEC 9.5 is why: "the mesh
// only works complete". A list somebody maintains is a list that will be one
// entry behind after FW18, and the failure is silent - the article exists,
// the route 404s or the hub omits it, and nothing says so. Reading the
// directory makes "a guide that exists" and "a guide the product knows
// about" the same statement.
//
// _-PREFIXED FILES ARE FIXTURES AND ARE EXCLUDED, which is the one exception
// and it is visible in the file name rather than in a list here. FW16 needs a
// sample article to exercise the template and the checker, and that sample
// must never reach the sitemap, the hub or a reader.
//
// READ ONCE PER PROCESS. `next build` collects page data for every route and
// the mesh checker walks the whole set; re-reading seven files per call is
// harmless and re-parsing their YAML is not, so the result is memoised. The
// cache is process-scoped: a dev server picks up an edited article on its
// next restart, which is the same contract MDX compilation already has.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { CLUSTERS, parseFrontmatter } from './frontmatter';
import type { Frontmatter } from './frontmatter';

/** Where the articles live. Outside app/, because they are content. */
export const GUIDES_DIR = join(process.cwd(), 'content', 'guides');

export interface Guide {
  readonly frontmatter: Frontmatter;
  /** The MDX body with the frontmatter block removed. */
  readonly body: string;
  /** The file this came from, for error messages. */
  readonly file: string;
}

/**
 * A fixture is excluded from everything a reader can reach.
 *
 * The underscore is the whole mechanism: it is visible in the file name, in
 * the directory listing and in every import path, so a fixture cannot be
 * mistaken for content by anybody reading the tree. A `fixture: true`
 * frontmatter field would be invisible until you opened the file.
 */
export const isFixture = (file: string): boolean => file.startsWith('_');

const parse = (file: string): Guide => {
  const raw = readFileSync(join(GUIDES_DIR, file), 'utf8');
  const { data, content } = matter(raw);
  const frontmatter = parseFrontmatter(data, file);

  // THE SLUG IS THE FILE NAME. SPEC 14: slugs are permanent, and two sources
  // for one identity is how a URL changes under the readers who bookmarked
  // it. Checked here because this is the only place both halves are in
  // scope.
  const expected = file.replace(/\.mdx$/, '').replace(/^_/, '');

  if (frontmatter.slug !== expected) {
    throw new Error(
      `Slug mismatch in ${file}: frontmatter says "${frontmatter.slug}", the file ` +
        `name says "${expected}". A slug is permanent (SPEC 14) and cannot have two ` +
        'sources - rename the file or correct the frontmatter, deliberately.',
    );
  }

  return { frontmatter, body: content, file };
};

let cache: readonly Guide[] | null = null;

/** Every guide, fixtures included. Ordered by file name, so it is stable. */
export function allGuides(): readonly Guide[] {
  if (cache !== null) return cache;

  const files = readdirSync(GUIDES_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .sort();

  cache = files.map(parse);

  return cache;
}

/** The guides a reader can reach: everything that is not a fixture. */
export function publishedGuides(): readonly Guide[] {
  return allGuides().filter((guide) => !isFixture(guide.file));
}

/** One guide by slug, fixtures included - the route serves them in dev. */
export function guideBySlug(slug: string): Guide | undefined {
  return allGuides().find((guide) => guide.frontmatter.slug === slug);
}

/** Test seam: forget what was read, so a fixture written at runtime is seen. */
export function resetGuideCache(): void {
  cache = null;
}

/**
 * The hub's path, and the prefix every article hangs off.
 *
 * Here rather than in lib/content/routes.ts because the guides registry is
 * what builds article URLs, and a second copy of the string in the module
 * that builds them is the drift this file exists to prevent. The HUB itself
 * is a declared route in lib/content/routes.ts like every other page.
 */
export const GUIDES_PATH = '/guides';

/**
 * Every published article as a link: its own breadcrumbLabel, its URL.
 *
 * THE FOOTER'S GUIDES COLUMN (FW33, H10), and it is derived for R181's reason.
 * SPEC 9.2 makes the footer the full sitemap, and a list of seven labels typed
 * into lib/fr/shell.ts would be seven transcriptions of names each article
 * already gives itself - correct on the day they are typed, and silently wrong
 * the day one is edited. It also means an eighth article reaches the footer on
 * the day it is published, as it reaches the hub.
 *
 * IN THE HUB'S ORDER: CLUSTERS is already ['pillar', 'cluster', 'canton'],
 * which is SPEC 9.5's order, and the sort is stable, so articles within a
 * cluster keep the registry's order exactly as the hub renders them.
 *
 * SERVER-ONLY, like everything in this file: it reads content/ from disk.
 * PublicShell was a client component and could not call it, so the pages that
 * render the shell pass the result in as a prop. It renders on the server
 * since FW-CALC-BYTES (R976) and the prop stays: see PublicShellProps.
 */
export function guideNavLinks(): readonly { readonly label: string; readonly href: string }[] {
  return [...publishedGuides()]
    .sort(
      (a, b) => CLUSTERS.indexOf(a.frontmatter.cluster) - CLUSTERS.indexOf(b.frontmatter.cluster),
    )
    .map((guide) => ({
      label: guide.frontmatter.breadcrumbLabel,
      href: `${GUIDES_PATH}/${guide.frontmatter.slug}`,
    }));
}
