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

  it('lists the four routes that exist today', () => {
    expect([...sitemapPaths()].sort()).toEqual([
      '/',
      '/cgu',
      '/confidentialite',
      '/mentions-legales',
    ]);
  });

  it('lists no planned route', () => {
    // The half that matters: a sitemap of 404s tells a crawler the pages are
    // there, and it is well-formed XML, so nothing else objects.
    const planned = PUBLIC_ROUTES.filter((route) => route.status === 'planned').map((r) => r.path);

    expect(planned.length).toBeGreaterThan(5);
    for (const path of planned) {
      expect(sitemapPaths(), path).not.toContain(path);
    }
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

  it('has exactly one route no task claims, and it is /application', () => {
    // PINNED, not tolerated. tasks/todo.md builds /releve-annuel, /tarifs,
    // /sources and /a-propos in FW20 and never builds /application - which
    // SPEC 9.1 requires and which is the target of the header's single primary
    // CTA, so the product's only call to action currently points at a 404.
    // Raised as a question in REPORT-FW10.txt. This assertion exists so the
    // gap stays exactly one route wide until someone answers it.
    expect(UNASSIGNED).toEqual(['/application']);
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
