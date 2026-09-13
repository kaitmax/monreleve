// web/tests/unit/guides/links.test.ts
//
// Internal links, resolved against the registry.
//
// THE DEFECT. A guide links /guides/seuil-social-49-9-percent - one character
// off - and the page renders perfectly. The link 404s, the mesh SPEC 9.5
// describes has a hole, and nothing objects until a reader clicks. Seven
// articles cross-linking each other is exactly where that happens, and it is
// invisible in review because the markup is correct.

import { describe, expect, it } from 'vitest';
import {
  assertResolves,
  internalHrefs,
  isInternal,
  pathOf,
  resolves,
} from '@/lib/guides/links';
import { CALCULATOR_PATH } from '@/lib/content/routes';
import { allGuides } from '@/lib/guides/registry';

describe('what counts as internal', () => {
  it('is one leading slash, and not a protocol-relative URL', () => {
    expect(isInternal('/sources')).toBe(true);
    expect(isInternal('https://www.admin.ch/x')).toBe(false);

    // //admin.ch is a protocol-relative EXTERNAL url that looks internal to a
    // naive startsWith('/'). Left alone rather than resolved, which would
    // either throw on a valid link or silently accept a foreign host.
    expect(isInternal('//admin.ch/x')).toBe(false);
  });

  it('strips the fragment and the query before looking anything up', () => {
    // A link to /sources#avenant-2023 is a link to /sources. The fragment is
    // the page's business and no registry can know it.
    expect(pathOf('/sources#avenant-2023')).toBe('/sources');
    expect(pathOf('/sources?x=1')).toBe('/sources');
  });
});

describe('resolution against the registry', () => {
  it('accepts a declared route', () => {
    expect(resolves(CALCULATOR_PATH)).toBe(true);
    expect(resolves('/sources')).toBe(true);
  });

  it('accepts an article by its slug, which the route registry does not list', () => {
    // A guide linking a sibling guide is the commonest link in the mesh, and
    // lib/content/routes.ts does not enumerate articles one by one.
    expect(resolves('/guides/fixture-modele-article')).toBe(true);
  });

  it('REFUSES a slug that is one character off', () => {
    expect(resolves('/guides/fixture-modele-articles')).toBe(false);
    expect(resolves('/guides/seuil-social-49-9-percent')).toBe(false);
  });

  it('refuses a route that is planned but does not exist', () => {
    // /tarifs is in the registry as `planned` - isRegistered covers declared
    // routes, and a guide must not link a page that 404s today. If this ever
    // becomes true, it should be because the page shipped.
    expect(resolves('/cette-page-nexiste-pas')).toBe(false);
  });

  it('leaves external links alone rather than pretending to check them', () => {
    // Validating admin.ch would mean a network call at build: a different and
    // much worse idea than an unchecked external link.
    expect(resolves('https://www.admin.ch/')).toBe(true);
  });

  it('accepts a bare fragment as same-page', () => {
    expect(resolves('#une-section')).toBe(true);
  });
});

describe('the failure names the article and the href', () => {
  it('throws with both, because a build log has seven candidates', () => {
    expect(() => {
      assertResolves('/guides/pas-un-guide', 'teletravail-frontalier-40-pourcent.mdx');
    }).toThrow(/teletravail-frontalier-40-pourcent\.mdx/);

    expect(() => {
      assertResolves('/guides/pas-un-guide', 'x.mdx');
    }).toThrow(/pas-un-guide/);
  });

  it('says nothing when the link is fine', () => {
    expect(() => {
      assertResolves(CALCULATOR_PATH, 'x.mdx');
    }).not.toThrow();
  });
});

describe('finding the hrefs in a body', () => {
  it('finds markdown links and JSX hrefs, in document order', () => {
    const body = [
      'Du texte avec [un lien](/sources) dedans.',
      '<CarteCalculateur href="/calculateur-teletravail-frontalier" />',
      'Et [un externe](https://admin.ch) qui ne compte pas.',
    ].join('\n');

    expect(internalHrefs(body)).toEqual([
      '/sources',
      '/calculateur-teletravail-frontalier',
    ]);
  });

  it('finds the fixture’s own links, so the mesh checker has something to read', () => {
    // Non-vacuity against the real article rather than a constructed string:
    // if the regexes stopped matching the way guides are actually written,
    // every mesh rule in increment 4 would pass on an empty list.
    const fixture = allGuides().find((guide) => guide.file.startsWith('_'));

    expect(fixture).toBeDefined();
    expect(internalHrefs(fixture?.body ?? '').length).toBeGreaterThanOrEqual(2);
  });
});
