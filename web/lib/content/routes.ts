// web/lib/content/routes.ts
//
// EVERY PUBLIC URL, DECLARED ONCE. The sitemap is generated from this, robots
// takes its disallow list from this, and tests/unit/content/routes.test.ts
// asserts that every href PublicShell's nav and footer render is a path
// declared here. A URL written in one of those places and not here is what
// fails.
//
// WHY A REGISTRY RATHER THAN A SITEMAP FUNCTION. Before this, the URL set
// existed in three places - the nav, the four footer columns, and a sitemap
// that listed one route - and the SPEC. Three lists agree until one of them is
// edited. Which is not hypothetical:
//
//   FW9's shell shipped THREE slugs SPEC does not name
//     /comparateur-lamal-cmu          SPEC 9.1 and 9.6: /calculateur-lamal-cmu
//     /releve                         SPEC 9.1 and 9.7: /releve-annuel
//     /guides/seuil-40-pourcent       SPEC 9.5: /guides/teletravail-frontalier-40-pourcent
//
//   Corrected in the shell as part of this increment, and pinned as absences
//   in the test so they cannot return. SPEC 14: "Guide slugs and URL params
//   are permanent once published; renaming requires a 301 forever" - so this
//   is the last cheap moment to fix them.
//
// STATUS IS NOT DECORATION. A sitemap listing thirteen URLs of which nine are
// 404s is worse than a sitemap listing four: it tells a crawler the pages
// exist, it is well-formed XML, and no other gate objects. Only `live` routes
// reach the sitemap. The nav and footer still link planned ones, which is the
// state FW9 shipped and which FW11 onward resolve - and every one of those
// links is a 404 today.

/** Whether the page exists yet. Only `live` reaches the sitemap. */
export type RouteStatus = 'live' | 'planned';

export interface PublicRoute {
  /** Absolute path, leading slash, no trailing slash (see TRAILING SLASH). */
  readonly path: string;
  readonly status: RouteStatus;
  /**
   * The task that builds it - or `UNASSIGNED_TASK` when no task in
   * tasks/todo.md does, which is a gap rather than a value.
   */
  readonly task: string;
  readonly changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  /** Relative weight within our own sitemap. Crawlers treat it as a hint. */
  readonly priority: number;
}

/**
 * No task in tasks/todo.md builds this route.
 *
 * It exists so that "nobody owns this page" is a value the test can assert on
 * rather than a blank that reads as filled in - the same reasoning as ruling
 * R52's placeholders, one directory over.
 */
export const UNASSIGNED_TASK = 'UNASSIGNED';

export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  // ---- live today -------------------------------------------------------
  { path: '/', status: 'live', task: 'FW10 placeholder, FW20 real', changeFrequency: 'weekly', priority: 1 },
  { path: '/mentions-legales', status: 'live', task: 'FW10', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/confidentialite', status: 'live', task: 'FW10', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/cgu', status: 'live', task: 'FW10', changeFrequency: 'yearly', priority: 0.3 },

  // ---- the tools --------------------------------------------------------
  {
    path: '/calculateur-teletravail-frontalier',
    status: 'planned',
    task: 'FW11',
    changeFrequency: 'monthly',
    priority: 0.9,
  },
  {
    // SPEC 9.1 and 9.6 both spell it "calculateur", not "comparateur", even
    // though the page IS a comparator and its LABEL says so. The slug carries
    // the search term (SPEC 14) and the label carries the meaning.
    path: '/calculateur-lamal-cmu',
    status: 'planned',
    task: 'FW19',
    changeFrequency: 'monthly',
    priority: 0.8,
  },

  // ---- guides (SPEC 9.5's launch content, written before release) --------
  { path: '/guides', status: 'planned', task: 'FW16', changeFrequency: 'weekly', priority: 0.7 },
  {
    path: '/guides/teletravail-frontalier-40-pourcent',
    status: 'planned',
    task: 'FW17',
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  {
    path: '/guides/seuil-social-49-9-pourcent',
    status: 'planned',
    task: 'FW17',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    path: '/guides/jours-de-mission-hors-suisse',
    status: 'planned',
    task: 'FW17',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    path: '/guides/attestation-employeur-teletravail',
    status: 'planned',
    task: 'FW18',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    path: '/guides/droit-option-lamal-cmu',
    status: 'planned',
    task: 'FW18',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    path: '/guides/declaration-impots-frontalier',
    status: 'planned',
    task: 'FW18',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  { path: '/guides/geneve', status: 'planned', task: 'FW18', changeFrequency: 'monthly', priority: 0.6 },

  // ---- the product ------------------------------------------------------
  {
    // SPEC 9.1: new in v2, and the target of the header's single primary CTA
    // ("Suivre mes jours"). NO TASK IN tasks/todo.md BUILDS IT - FW20 builds
    // /releve-annuel, /tarifs, /sources and /a-propos and stops there. So the
    // product's only call to action points at a 404 and nothing is scheduled
    // to change that. Raised as a question in REPORT-FW10.txt; the test pins
    // the gap at exactly this one route.
    path: '/application',
    status: 'planned',
    task: UNASSIGNED_TASK,
    changeFrequency: 'monthly',
    priority: 0.9,
  },
  { path: '/releve-annuel', status: 'planned', task: 'FW20', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/tarifs', status: 'planned', task: 'FW20', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/sources', status: 'planned', task: 'FW20', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/a-propos', status: 'planned', task: 'FW20', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/alertes', status: 'planned', task: 'FW14', changeFrequency: 'monthly', priority: 0.5 },
];

/**
 * What robots.txt disallows. RULING R53, verbatim: "robots.txt disallows
 * /dev/, /api/, and /releve/print. There is no /app, /connexion or
 * /inscription to disallow."
 *
 * SPEC 14 still lists the old set - "/app/, /connexion, /inscription, /dev/" -
 * which D14 withdrew when it deleted the signed-in web area. That line is
 * stale rather than authoritative; noted in the report rather than edited
 * here, because SPEC is the operator's document.
 *
 * Sorted, and asserted sorted, so a reader can see the whole set at a glance.
 */
export const NON_INDEXED = ['/api/', '/dev/', '/releve/print'] as const;

/** Registered paths, for the shell cross-check. */
export function isRegistered(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => route.path === path);
}

/**
 * Whether a path is a page that EXISTS, not merely one that is declared.
 *
 * Takes the routes as an argument so both answers are testable. The registry
 * is a module constant, so a decision that read it directly would have exactly
 * one reachable branch - whichever the repository happens to be in - and the
 * other would go unproven until someone looked at a page.
 */
export function isLive(path: string, routes: readonly PublicRoute[] = PUBLIC_ROUTES): boolean {
  return routes.some((route) => route.path === path && route.status === 'live');
}

/**
 * RULING R85: "the header CTA renders only when its target is live in the
 * registry. A CTA to a planned route renders nothing."
 *
 * Returns the href, or NULL when the target does not exist yet. null rather
 * than an empty string on purpose: an empty href resolves to the current page,
 * so a button that "led nowhere" would quietly reload whatever the reader was
 * looking at. null is a value a component can branch on.
 *
 * WHAT THIS PREVENTS, concretely. /application is SPEC 9.1's page and the
 * target of the product's single primary CTA, and no task in tasks/todo.md
 * builds it - so until FW20b exists, every public page carried a prominent
 * button leading to a 404. An absent button is a smaller failure than a broken
 * one, and this makes the choice mechanical rather than a thing to remember.
 */
export function ctaHrefIfLive(
  href: string,
  routes: readonly PublicRoute[] = PUBLIC_ROUTES,
): string | null {
  return isLive(href, routes) ? href : null;
}

/** The routes that exist. */
export function liveRoutes(): readonly PublicRoute[] {
  return PUBLIC_ROUTES.filter((route) => route.status === 'live');
}

/** Just the paths the sitemap should carry. */
export function sitemapPaths(): readonly string[] {
  return liveRoutes().map((route) => route.path);
}

/** Paths no task in tasks/todo.md builds. Expected to be one; see above. */
export const UNASSIGNED: readonly string[] = PUBLIC_ROUTES.filter(
  (route) => route.task === UNASSIGNED_TASK,
).map((route) => route.path);
