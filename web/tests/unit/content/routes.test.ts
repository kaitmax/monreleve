// web/tests/unit/content/routes.test.ts
//
// ONE SOURCE FOR EVERY PUBLIC URL, which is what the prompt asks for: the
// registry "also feeds the footer sitemap and PublicShell's nav".
//
// WHAT THIS TEST IS ACTUALLY FOR. A registry that merely EXISTS beside the nav
// is not a single source, it is a second list - and the second list is the one
// that goes stale. So the assertions below are the mechanism: every href the
// shell renders must be a registered path, and the registry must agree with
// SPEC 9.1's launch list. Writing a URL in one place and not the other is what
// fails.
//
// AND IT ALREADY CAUGHT THREE. FW9's shell shipped three slugs that SPEC does
// not name - /comparateur-lamal-cmu for 9.1's and 9.6's
// /calculateur-lamal-cmu, /releve for 9.1's and 9.7's /releve-annuel, and
// /guides/seuil-40-pourcent for 9.5's /guides/teletravail-frontalier-40-pourcent.
// SPEC 14 says slugs are permanent once published and renaming needs "a 301
// forever", so a divergence found before launch is worth more than the same
// divergence found after.
//
// THE SITEMAP LISTS ONLY WHAT EXISTS. A sitemap naming thirteen URLs of which
// nine are 404s is worse than a short one: it tells a crawler the pages are
// there. So the registry records status, and the assertions hold both halves -
// every live route is listed, and no planned route is.

import { describe, expect, it } from 'vitest';
import {
  NON_INDEXED,
  PUBLIC_ROUTES,
  UNASSIGNED,
  isRegistered,
  liveRoutes,
  sitemapPaths,
} from '@/lib/content/routes';
import { FOOTER_COLUMNS, SHELL_COPY, SHELL_NAV } from '@/lib/fr/shell';

/** Every href the public shell renders, from both surfaces. */
function shellHrefs(): string[] {
  const nav = SHELL_NAV.flatMap((entry) => [
    ...(entry.href === undefined ? [] : [entry.href]),
    ...(entry.children ?? []).map((child) => child.href),
  ]);
  const footer = FOOTER_COLUMNS.flatMap((column) => column.links.map((link) => link.href));

  return [...nav, ...footer, SHELL_COPY.ctaHref];
}

describe('the registry is the single source', () => {
  it('registers every href the shell renders', () => {
    // The assertion that makes the registry a source rather than a second
    // list. An unregistered href is either a typo or a route nobody declared.
    const unregistered = shellHrefs().filter((href) => !isRegistered(href));

    expect(unregistered, `hrefs the shell renders that no route declares: ${unregistered.join(', ')}`).toEqual([]);
  });

  it('collected hrefs from both the nav and the footer, so that is not vacuous', () => {
    const hrefs = shellHrefs();

    expect(hrefs.length).toBeGreaterThanOrEqual(12);
    expect(hrefs).toContain('/mentions-legales');
    expect(hrefs).toContain('/calculateur-teletravail-frontalier');
  });

  it('carries SPEC 9.1 launch routes', () => {
    // Quoted from SPEC 9.1: "Public routes at launch". The legal three and the
    // home page are live; the rest are declared and planned.
    for (const path of [
      '/',
      '/calculateur-teletravail-frontalier',
      '/calculateur-lamal-cmu',
      '/guides',
      '/application',
      '/releve-annuel',
      '/tarifs',
      '/sources',
      '/a-propos',
      '/alertes',
      '/mentions-legales',
      '/confidentialite',
      '/cgu',
    ]) {
      expect(isRegistered(path), path).toBe(true);
    }
  });

  it('carries SPEC 9.5 guide slugs', () => {
    for (const slug of [
      '/guides/teletravail-frontalier-40-pourcent',
      '/guides/seuil-social-49-9-pourcent',
      '/guides/jours-de-mission-hors-suisse',
      '/guides/attestation-employeur-teletravail',
      '/guides/droit-option-lamal-cmu',
      '/guides/declaration-impots-frontalier',
      '/guides/geneve',
    ]) {
      expect(isRegistered(slug), slug).toBe(true);
    }
  });

  it('does not carry the three slugs SPEC never names', () => {
    // FW9's divergences, pinned as absences so they cannot come back by
    // copy-paste from an old comment or an old report.
    for (const wrong of ['/comparateur-lamal-cmu', '/releve', '/guides/seuil-40-pourcent']) {
      expect(isRegistered(wrong), wrong).toBe(false);
    }
  });

  it('declares each path once', () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);

    expect(new Set(paths).size).toBe(paths.length);
  });

  it('gives every path a leading slash and no trailing one', () => {
    // The trailing-slash decision, held at the source rather than only at the
    // redirect: a registry entry with a slash would put one in the sitemap,
    // which would then 308 on every crawl.
    for (const route of PUBLIC_ROUTES) {
      expect(route.path.startsWith('/'), route.path).toBe(true);
      expect(route.path === '/' || !route.path.endsWith('/'), route.path).toBe(true);
    }
  });
});

describe('the sitemap lists what exists and nothing else', () => {
  it('lists every live route', () => {
    expect([...sitemapPaths()].sort()).toEqual([...liveRoutes().map((r) => r.path)].sort());
  });

  it('lists the twenty-one routes that exist and may be seen today', () => {
    // FOUR UNTIL FW11, five with the calculator, six with /sources. The
    // calculator joined when its page was built AND the Checkpoint A review
    // was recorded - two independent conditions, both of which had to be
    // true. While the review was null the page could exist and stay out of
    // this list, which is ruling R54 and is asserted directly in
    // tests/unit/content/regulatory-gate.test.ts.
    //
    // /alertes joined at FW14: the list has a page now, it is the landing a
    // Facebook post points at, and a route that exists and is not in the
    // sitemap is a page no crawler is told about.
    //
    // /sources joined at FW12 increment 0 under ruling R113, ahead of the
    // FW20 it was scheduled for: P2 has no input trigger, so that page is its
    // only disclosure, and the calculator was already indexed. The footer had
    // also linked it since FW10 while it was 'planned', so this list growing
    // is the same edit that stopped every public page carrying a link to a
    // 404.
    //
    // THE GUIDES JOINED AT FW17 INCREMENT 4, four at once: the hub and the
    // three articles SPEC 9.5 names as its launch pillar and clusters. FW16
    // built the hub and left it planned - "an empty page in the sitemap is
    // the sitemap-of-404s problem one level down: not a broken link, a page
    // that tells a crawler nothing" - and the flip waited until it had
    // content. All four move together because a live hub whose articles are
    // planned lists a page every link leaves, and live articles under a
    // planned hub have one way in.
    //
    // /guides/droit-option-lamal-cmu JOINED AT FW18b, and late. FW18 wrote
    // the other three and REFUSED this one: its two load-bearing facts - the
    // three-month window and the irrevocability - had no verified row, and
    // SPEC 22 listed the figure among those compiled from advisory sources.
    // It was parked as P2. The operator then read CLEISS, a French public
    // body, and docs/regulatory-sources.md carries the result as rows D1-D7,
    // so the article could be written from sources rather than from memory.
    // P6 supersedes P2. The delay is the mechanism working.
    //
    // THE LIST IS ALSO CHECKED AGAINST THE DISK. app/sitemap.xml/route.ts
    // emits a live guide route only when its article exists in
    // content/guides, and tests/unit/guides/hub.test.ts refuses a live guide
    // route with no file - so these four are a claim that is verified twice.
    //
    // Hardcoded on purpose: deriving it from the registry would make the
    // assertion agree with whatever the registry says, which is the thing
    // being checked.
    expect([...sitemapPaths()].sort()).toEqual([
      '/',
      // FW20: /a-propos joined when it stopped being a TODO-REVIEWER
      // placeholder and became a page that says, in a sentence a reader can
      // read, that nobody has validated these rules.
      '/a-propos',
      '/alertes',
      // FW20b: the route no task claimed from FW9 to FW20. SPEC 9.1 required
      // it and tasks/todo.md never built it, so the product's only call to
      // action pointed at a 404 from every page until PARK-12 hid the link.
      '/application',
      // FW-COMPARATEUR: the last planned route, built once R664-R673 cleared
      // the premium licence and the French formula (PARK-4, PARK-24).
      '/calculateur-lamal-cmu',
      '/calculateur-teletravail-frontalier',
      '/cgu',
      '/confidentialite',
      '/guides',
      '/guides/attestation-employeur-teletravail',
      // FW-SEO-ARTICLES: the two health-insurance guides, one per side of the
      // droit d'option, written on the sources R664-R673 already cleared.
      '/guides/cotisation-cmu-frontalier',
      '/guides/cout-lamal-frontalier',
      '/guides/declaration-impots-frontalier',
      '/guides/droit-option-lamal-cmu',
      '/guides/geneve',
      '/guides/jours-de-mission-hors-suisse',
      '/guides/seuil-social-49-9-pourcent',
      '/guides/teletravail-frontalier-40-pourcent',
      '/mentions-legales',
      // FW20: the dead link the calculator has pointed at since FW12.
      '/releve-annuel',
      '/sources',
      // FW20: /tarifs, one page carrying SPEC D3's sentence.
      '/tarifs',
    ]);
  });

  it('lists no planned route', () => {
    // The half that matters: a sitemap of 404s tells a crawler the pages are
    // there, and it is well-formed XML, so nothing else objects.
    const planned = PUBLIC_ROUTES.filter((route) => route.status === 'planned').map((r) => r.path);

    // HARDCODED RATHER THAN A FLOOR. It was toBeGreaterThan(5) - a
    // non-vacuity guard - and FW18b's flip of /guides/droit-option-lamal-cmu
    // took the count from six to five and turned the guard red. A floor that
    // has to be lowered every time a page ships is a floor that will one day
    // be lowered to nothing; the set below says which five, so shipping one
    // is an edit that names it.
    // FW20 took /a-propos out of this list and into the sitemap one, FW20b
    // took /application, and FW-COMPARATEUR took /calculateur-lamal-cmu, the
    // last one - so the set is EMPTY, asserted as a value (R345).
    expect([...planned].sort()).toEqual([]);

    // AND THE EXCLUSION STILL HAS TO BE SHOWN TO WORK, because "no planned
    // route is listed" is satisfied by there being none (R169's corollary).
    // A synthetic planned route, handed to the same function, stays out.
    const synthetic = [
      ...PUBLIC_ROUTES,
      { path: '/pas-encore', status: 'planned' as const, task: 'TEST', changeFrequency: 'monthly' as const, priority: 0.1 },
    ];

    expect(sitemapPaths(synthetic)).not.toContain('/pas-encore');
    expect(sitemapPaths(synthetic)).toContain('/calculateur-lamal-cmu');
  });

  it('lists nothing that robots disallows', () => {
    for (const path of sitemapPaths()) {
      for (const blocked of NON_INDEXED) {
        expect(path.startsWith(blocked), `${path} is in the sitemap and disallowed`).toBe(false);
      }
    }
  });
});

describe('every planned route names the task that builds it', () => {
  it('has a non-empty task for each route', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(route.task.length, route.path).toBeGreaterThan(0);
    }
  });

  it('has no route that no task claims, now that /application is built', () => {
    // THE GAP IS CLOSED, and the assertion changes shape rather than moving.
    //
    // From FW9 to FW20 this read `toEqual(['/application'])`: SPEC 9.1
    // required the page, tasks/todo.md never built it, and the product's only
    // call to action pointed at a 404 from every page. The assertion existed
    // to keep the gap exactly one route wide until somebody answered it.
    // FW20b answered it.
    //
    // EMPTY IS NOW THE CLAIM, which is stronger than the old one: any FUTURE
    // route added without a task in tasks/todo.md fails here on the day it is
    // added, rather than widening a gap that was already tolerated at one.
    expect(UNASSIGNED).toEqual([]);
  });
});

describe('what robots keeps out', () => {
  it('is the three prefixes R53 names, and no more', () => {
    // R53: "robots.txt disallows /dev/, /api/, and /releve/print. There is no
    // /app, /connexion or /inscription to disallow."
    expect([...NON_INDEXED]).toEqual(['/api/', '/dev/', '/releve/print']);
  });

  it('does not name the withdrawn signed-in routes (D14, R53)', () => {
    for (const withdrawn of ['/app/', '/connexion', '/inscription']) {
      expect([...NON_INDEXED], withdrawn).not.toContain(withdrawn);
    }
  });
});
