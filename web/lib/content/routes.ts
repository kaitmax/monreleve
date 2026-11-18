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
import { CALCULATOR_PATH, COMPARATOR_PATH, RESULT_PATH } from './route-paths';
import { PRODUCT_STATE } from './product-state';

// THE SLUGS LIVE IN ./route-paths, A LEAF, SINCE FW-CALC-BYTES (R976). This file
// is the registry, and a client module that imported a path from here shipped
// every registered route to the browser. The registry declares its routes with
// the leaf's constants and re-exports them, so it stays the one place a route
// is declared (R206) and every existing importer is unchanged; client code
// imports the leaf directly. Their documentation moved with them.
export { CALCULATOR_PATH, COMPARATOR_PATH, RESULT_PATH };

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
 * FW-WEB-ACCOUNT (R898-R900): the website's read-only account area, and the
 * Path its one cookie is scoped to.
 *
 * DELIBERATELY ABSENT FROM PUBLIC_ROUTES, like RESULT_PATH. That registry feeds
 * the sitemap and every registry-driven "public page" loop, and this area is
 * the one place a public-page guarantee does NOT hold - it sets a cookie. The
 * two sets are asserted disjoint in tests/unit/content/account-path.test.ts.
 *
 * THE PATH IS ALSO THE COOKIE'S SCOPE, and that is why it is pinned. RFC 6265
 * sends a cookie with Path=/mon-releve to /mon-releve and /mon-releve/... and
 * to nothing else - not /mon-relevex, not /releve-annuel, not /releve/print.
 * The same test runs RFC 6265's path-match against every public route and
 * requires none to match. Renaming it is a published URL changing AND every
 * signed-in browser losing its session, so a rename is a failing test first.
 *
 * Not indexed: the pages emit noindex. NOT added to NON_INDEXED, which R53
 * fixes at three prefixes "and no more" - and a robots disallow would stop a
 * crawler reading the noindex anyway.
 */
export const ACCOUNT_PATH = '/mon-releve';

/**
 * Step one of the area's sign-in, and the header link's target.
 *
 * NOT ACCOUNT_PATH ITSELF, measured: the signed-in page answers a signed-out
 * reader - every crawler, and every reader of a public page, since a public
 * page never carries the cookie - with a 307 to this page, and the home page's
 * link walk (R713, e2e/home.spec.ts) rightly counts a link that redirects as
 * one that does not resolve. This page answers 200 to a signed-out reader and
 * sends a signed-in one on to the area.
 */
export const ACCOUNT_SIGN_IN_PATH = `${ACCOUNT_PATH}/connexion`;

/**
 * The account area's own registry entry: a status for R85, and no sitemap fields.
 *
 * NO task FIELD (W12). C9 gave it one; since FW-CALC-BYTES (R976) every literal
 * task string in this file is a probe the client-registry leak check looks
 * for in client chunks, and the probes must be PUBLIC_ROUTES' own
 * (tests/unit/meta/client-registry-leak.test.ts). This entry is not a public
 * route, and nothing read the field.
 */
export interface AccountRoute {
  readonly path: string;
  readonly status: RouteStatus;
}

/**
 * Whether the account area is offered.
 *
 * DERIVED, NOT TYPED (R172). PRODUCT_STATE.webAccountExists is the one fact;
 * this status, the header's sign-in link (R85: it renders only when its target
 * is live) and the privacy notice's cookie sentence all read it, so the link
 * and the sentence that discloses the cookie behind it cannot disagree.
 */
export const ACCOUNT_ROUTE: AccountRoute = {
  path: ACCOUNT_PATH,
  status: PRODUCT_STATE.webAccountExists ? 'live' : 'planned',
};

/** R85 for the header's sign-in link: step one of the sign-in, or null while the area is not live. */
export function accountHrefIfLive(route: AccountRoute = ACCOUNT_ROUTE): string | null {
  return route.status === 'live' ? ACCOUNT_SIGN_IN_PATH : null;
}

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
    //
    // LIVE SINCE FW-COMPARATEUR. FW19 reached R157 option (3) and built
    // nothing (PARK-4); the operator's R664-R673 cleared the premium licence
    // and the French formula, and the page was built on them. Flipping this
    // flag is what puts the Calculateurs menu back (collapseLoneDisclosures),
    // lists the page in the sitemap and lets the guide link it (R85).
    path: COMPARATOR_PATH,
    status: 'live',
    task: 'FW19, built FW-COMPARATEUR',
    changeFrequency: 'monthly',
    priority: 0.8,
  },

  // ---- guides (SPEC 9.5's launch content, written before release) --------
  //
  // FOUR ROUTES FLIPPED TOGETHER IN FW17 INCREMENT 4, and together is the
  // point. The hub and the three articles it lists become live in one change,
  // because a hub in the sitemap whose entries are not tells a crawler half a
  // story, and three articles in the sitemap with no hub leaves them with one
  // way in. FW16 left /guides planned with the comment "FW17 flips the flag
  // when the first article lands"; this is that flip.
  //
  // THE SITEMAP ALSO CHECKS THE DISK. app/sitemap.xml/route.ts lists a live
  // guide route only if its article exists in content/guides, and
  // tests/unit/guides/hub.test.ts refuses a live guide route with no file. So
  // `live` here is a claim that is checked rather than taken.
  { path: '/guides', status: 'live', task: 'FW16, content FW17', changeFrequency: 'weekly', priority: 0.7 },
  {
    path: '/guides/teletravail-frontalier-40-pourcent',
    status: 'live',
    task: 'FW17',
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  {
    path: '/guides/seuil-social-49-9-pourcent',
    status: 'live',
    task: 'FW17',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    path: '/guides/jours-de-mission-hors-suisse',
    status: 'live',
    task: 'FW17',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    path: '/guides/attestation-employeur-teletravail',
    status: 'live',
    task: 'FW18',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    path: '/guides/droit-option-lamal-cmu',
    status: 'live',
    task: 'FW18',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    path: '/guides/declaration-impots-frontalier',
    status: 'live',
    task: 'FW18',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  { path: '/guides/geneve', status: 'live', task: 'FW18', changeFrequency: 'monthly', priority: 0.6 },

  // ---- the product ------------------------------------------------------
  {
    // SPEC 9.1: new in v2, and the target of the header's single primary CTA
    // ("Suivre mes jours").
    //
    // LIVE AT FW20b, AND IT WAS THE ONE ROUTE NO TASK CLAIMED. From FW9 until
    // FW20 it was 'planned' with UNASSIGNED_TASK: SPEC 9.1 required it,
    // tasks/todo.md never built it, and the product's only call to action
    // pointed at a 404 from every page. PARK-12 stopped rendering the link;
    // FW20b builds the page, which is the other half.
    //
    // THE PAGE IS LIVE AND THE APP IS NOT. PRODUCT_STATE.appExists stays
    // false - there is no android/ directory - and every sentence on the page
    // derives from that flag. This entry says a reader can reach the page,
    // nothing more, and /releve-annuel has made exactly that distinction
    // since FW20.
    path: '/application',
    status: 'live',
    task: 'FW20b',
    changeFrequency: 'monthly',
    priority: 0.9,
  },
  { path: '/releve-annuel', status: 'live', task: 'FW20', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/tarifs', status: 'live', task: 'FW20', changeFrequency: 'monthly', priority: 0.6 },
  // LIVE AT FW12 INCREMENT 0, not FW20 (ruling R113). P2 - the 49,9 edge -
  // has no input trigger by design, so this page is its ONLY disclosure, and
  // the calculator was indexed before it existed. The footer had also linked
  // here since FW10 while the route was planned, so every public page carried
  // a link to a 404.
  { path: '/sources', status: 'live', task: 'FW12', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/a-propos', status: 'live', task: 'FW20', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/alertes', status: 'live', task: 'FW14', changeFrequency: 'monthly', priority: 0.5 },
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

/**
 * RULING R85 AND RULING R172 TOGETHER: the href, or null when either the
 * TARGET does not exist or the THING THE BUTTON PROMISES does not exist.
 *
 * WHY A SECOND QUESTION. R85 was written when `planned` meant both "no
 * page" and "no feature", so one check answered both. FW20b separated
 * them: /application is live and the application is not built. The header
 * CTA reads "Suivre mes jours", and on the registry check alone that flip
 * would have put a prominent offer of day-tracking on every public page of
 * a product that cannot track a day - a PROMISE rather than a broken link,
 * which is worse because nothing 404s and nothing looks wrong.
 *
 * ONE FUNCTION RATHER THAN A CONDITION IN THE SHELL, because the three
 * tests that assert the button’s visibility computed R85 for themselves
 * and all three went green against a shell that had stopped agreeing with
 * them. A rule with no single enforcement point is a comment: this is the
 * point, and the shell and its tests now call it.
 */
export function ctaHrefIfOffered(
  href: string,
  offered: boolean,
  routes: readonly PublicRoute[] = PUBLIC_ROUTES,
): string | null {
  return offered ? ctaHrefIfLive(href, routes) : null;
}

/**
 * RULING R85 OVER A TABLE OF LINKS: each one's href when its target is live,
 * null when it is not - ctaHrefIfLive, key by key.
 *
 * FOR CLIENT CODE, WHICH MUST NOT DECIDE THIS ITSELF (R976, FW-CALC-BYTES). The
 * calculator's result panel renders inside a client island and called
 * ctaHrefIfLive on every render, which put this whole registry in the
 * calculator's first-load JS. The pages that render the panel call this on the
 * server and hand the island the answers: a four-entry table, and no registry.
 */
export function liveHrefs<K extends string>(
  links: Readonly<Record<K, { readonly href: string }>>,
  routes: readonly PublicRoute[] = PUBLIC_ROUTES,
): Readonly<Record<K, string | null>> {
  const resolved = {} as Record<K, string | null>;

  for (const key of Object.keys(links) as K[]) {
    resolved[key] = ctaHrefIfLive(links[key].href, routes);
  }

  return resolved;
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

  // NOT BUILT YET IS ALSO HIDDEN, since FW20, and this closed a hole that had
  // been open since FW9. That task shipped a nav and footer linking every
  // planned route, and routes.ts said so plainly: "every one of those links is
  // a 404 today." Eleven tasks later two were left - /calculateur-lamal-cmu
  // and /application - and they were still 404ing from the footer of every
  // page on the site.
  //
  // Nothing caught it because nothing asked. The registry test asserts every
  // href the shell renders is REGISTERED, which these were; the sitemap test
  // asserts no planned route is LISTED, which they were not. Between "declared"
  // and "in the sitemap" sat "linked from every page and broken", and todo.md's
  // FW20 check - "click every footer link: zero 404s" - is what finally asked.
  //
  // It is R85's rule, which the result panel has followed since FW12: a target
  // renders only when it is live. The shell simply never applied it.
  if (route.status !== 'live') return true;

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
 * A disclosure left with ONE child renders as a plain link to that child,
 * under the CHILD's label (FW33, approved as H4).
 *
 * Opening a menu to find a single item is a wasted interaction, and the menu's
 * own label is plural - "Calculateurs" over one destination names something
 * that is not there. The child's label is the honest one, and the mobile panel
 * already flattens disclosures to their children, so desktop and mobile now
 * agree on what the entry is called.
 *
 * APPLIED AFTER visibleNav, AND DELIBERATELY A SEPARATE FUNCTION. visibleNav
 * answers "which links exist"; this answers "what shape the survivors take".
 * Folding it into visibleNav would change that function's contract under
 * regulatory-gate.test.ts, which asserts the disclosure itself survives the
 * gate. It reads no registry, so it needs no routes parameter: it is handed
 * the entries that survived and nothing else.
 *
 * DERIVED, SO THE MENU COMES BACK ON ITS OWN. The day /calculateur-lamal-cmu
 * goes live, visibleNav leaves Calculateurs two children and this returns the
 * disclosure unchanged, with no edit here or in the shell.
 */
export function collapseLoneDisclosures<T extends GateableEntry>(
  entries: readonly T[],
): readonly (T | GateableEntry)[] {
  return entries.map((entry) => {
    const only = entry.children?.length === 1 ? entry.children[0] : undefined;

    return only === undefined ? entry : { label: only.label, href: only.href };
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
