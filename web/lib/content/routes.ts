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

import { LAST_REGULATORY_REVIEW } from './regulatory';

/** Whether the page exists yet. Only a `live` route can reach the sitemap. */
export type RouteStatus = 'live' | 'planned';

/**
 * A condition beyond existence that a route must satisfy to be SEEN.
 *
 * RULING R54: the calculator is invisible to the public until the Checkpoint A
 * human gate is recorded, and the mechanism is the same constant that drives
 * the footer - LAST_REGULATORY_REVIEW. One value, three surfaces: robots
 * noindex, exclusion from the sitemap, absence from the nav and footer. A
 * route that were noindex but still in the sitemap would tell a crawler two
 * different things.
 *
 * Only one gate exists and it is a union rather than a boolean so that a
 * second one - if it ever arrives - has to be named rather than sharing a
 * flag with this one.
 */
export type RouteGate = 'regulatory-review';

export interface PublicRoute {
  /** Absolute path, leading slash, no trailing slash (see TRAILING SLASH). */
  readonly path: string;
  readonly status: RouteStatus;
  /**
   * Absent for almost every route. Present means: the page exists, and may
   * still not be shown - see RouteGate.
   */
  readonly gate?: RouteGate;
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

/**
 * The calculator's slug, exported because it appears in the registry, the
 * route directory, the nav, the page's metadata and three test files - and
 * SPEC 14 makes it permanent once published, so it is the last string in this
 * product that should be typed twice.
 */
export const CALCULATOR_PATH = '/calculateur-teletravail-frontalier';

export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  // ---- live today -------------------------------------------------------
  { path: '/', status: 'live', task: 'FW10 placeholder, FW20 real', changeFrequency: 'weekly', priority: 1 },
  { path: '/mentions-legales', status: 'live', task: 'FW10', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/confidentialite', status: 'live', task: 'FW10', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/cgu', status: 'live', task: 'FW10', changeFrequency: 'yearly', priority: 0.3 },

  // ---- the tools --------------------------------------------------------
  {
    // LIVE AND GATED, which are two different facts. FW11 built the page, so
    // it exists; R54 gates it on the Checkpoint A review, so whether it is
    // SEEN depends on LAST_REGULATORY_REVIEW. Both had to be true before it
    // could reach a sitemap, and conflating them would have published a page
    // that did not exist yet.
    //
    // The review was recorded on 09.09.2026, so today it is visible. The
    // closed branch is the one that no longer occurs and is therefore
    // asserted explicitly in tests/unit/content/regulatory-gate.test.ts.
    path: CALCULATOR_PATH,
    status: 'live',
    task: 'FW11',
    gate: 'regulatory-review',
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

/** The routes that exist, whether or not a gate currently hides them. */
export function liveRoutes(): readonly PublicRoute[] {
  return PUBLIC_ROUTES.filter((route) => route.status === 'live');
}

/** Whether a route carries the regulatory gate at all. */
export function isGated(route: PublicRoute): boolean {
  return route.gate === 'regulatory-review';
}

/**
 * Whether a route may be shown: it must EXIST, and its gate must be open.
 *
 * `review` is the value of LAST_REGULATORY_REVIEW, passed rather than read, so
 * both branches are ordinary function calls. A mocked module would prove
 * things about the mock - the reasoning R84 records for the legal pages'
 * entity prop, applied to a constant that is now non-null and whose closed
 * branch would otherwise never be exercised again.
 */
export function isVisible(route: PublicRoute, review: string | null = LAST_REGULATORY_REVIEW): boolean {
  if (route.status !== 'live') return false;

  return isGated(route) ? review !== null : true;
}

/** Every route a reader may reach, in declaration order. */
export function visibleRoutes(
  routes: readonly PublicRoute[] = PUBLIC_ROUTES,
  review: string | null = LAST_REGULATORY_REVIEW,
): readonly PublicRoute[] {
  return routes.filter((route) => isVisible(route, review));
}

/**
 * The paths the sitemap should carry.
 *
 * Gated-and-closed routes are excluded for the same reason planned ones are:
 * a sitemap is a claim, and listing a page a crawler must not index is the
 * one thing R54 exists to prevent.
 */
export function sitemapPaths(
  routes: readonly PublicRoute[] = PUBLIC_ROUTES,
  review: string | null = LAST_REGULATORY_REVIEW,
): readonly string[] {
  return visibleRoutes(routes, review).map((route) => route.path);
}

/**
 * Whether a link to this href must be withheld.
 *
 * TRUE ONLY FOR A ROUTE THAT ASKED TO BE HIDDEN. An href this registry does
 * not know returns false - the conservative direction for navigation, and the
 * opposite of ctaHrefIfLive's. An unregistered href is a bug that
 * tests/unit/content/routes.test.ts already fails on; deleting links because
 * of it would hide the evidence and break navigation over a typo. A CTA is
 * different: there, showing a button to a page that does not exist is the
 * worse outcome, so unknown means hidden.
 */
export function isHrefHidden(
  href: string,
  review: string | null = LAST_REGULATORY_REVIEW,
): boolean {
  const route = PUBLIC_ROUTES.find((entry) => entry.path === href);

  if (route === undefined) return false;

  return isGated(route) && review === null;
}

/**
 * RULING R54's first surface: the robots directive a gated route needs, or
 * null when it may be indexed.
 *
 * A PLAIN OBJECT, not Next's Metadata type, so lib/content stays free of
 * framework types and this stays testable in both directions - the page reads
 * the constant, which means only one branch would ever be reachable there.
 *
 * follow STAYS TRUE. noindex is the narrower instruction: it asks not to be
 * listed, not to be unread. A crawler that reaches the page anyway should
 * still be able to leave by its links, and nofollow would also strand the
 * legal pages it links to.
 */
export function gateRobotsDirective(
  review: string | null = LAST_REGULATORY_REVIEW,
): { readonly index: boolean; readonly follow: boolean } | null {
  return review === null ? { index: false, follow: true } : null;
}

/** A nav leaf, structurally - lib/fr/shell.ts owns the labels. */
interface GateableLink {
  readonly label: string;
  readonly href: string;
}

interface GateableEntry {
  readonly label: string;
  readonly href?: string;
  readonly children?: readonly GateableLink[];
}

/**
 * RULING R54's third surface: the nav with gated-and-closed links removed.
 *
 * A DISCLOSURE THAT LOSES EVERY CHILD IS DROPPED WHOLE, because a menu button
 * that opens onto nothing is worse than an absent menu - it looks broken
 * rather than deliberate. One that keeps a child stays, with fewer children:
 * the Calculateurs menu holds the calculator and the comparator, and only the
 * first is gated.
 *
 * Structural types rather than importing NavEntry, so lib/content does not
 * depend on lib/fr for a shape it only filters.
 */
export function visibleNav<T extends GateableEntry>(
  entries: readonly T[],
  review: string | null = LAST_REGULATORY_REVIEW,
): readonly T[] {
  return entries
    .map((entry) => {
      if (entry.children === undefined) return entry;

      const children = entry.children.filter((child) => !isHrefHidden(child.href, review));

      return { ...entry, children };
    })
    .filter((entry) => {
      if (entry.href !== undefined && isHrefHidden(entry.href, review)) return false;

      // A disclosure with no children left has nothing to disclose.
      return entry.children === undefined || entry.children.length > 0;
    });
}

/**
 * The footer's columns with gated-and-closed links removed.
 *
 * EVERY COLUMN SURVIVES, even one that loses a link, because a column heading
 * is not itself a link and the other entries under it are still wanted. The
 * Outils column holds the calculator and the comparator; dropping the column
 * would take the comparator with it.
 */
export function visibleFooterColumns<T extends { readonly links: readonly GateableLink[] }>(
  columns: readonly T[],
  review: string | null = LAST_REGULATORY_REVIEW,
): readonly T[] {
  return columns.map((column) => ({
    ...column,
    links: column.links.filter((link) => !isHrefHidden(link.href, review)),
  }));
}

/** Paths no task in tasks/todo.md builds. Expected to be one; see above. */
export const UNASSIGNED: readonly string[] = PUBLIC_ROUTES.filter(
  (route) => route.task === UNASSIGNED_TASK,
).map((route) => route.path);
