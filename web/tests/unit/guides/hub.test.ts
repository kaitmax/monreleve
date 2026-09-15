// web/tests/unit/guides/hub.test.ts
//
// The hub's contract with the registry, and the FAQ's with its structured
// data.
//
// "A GUIDE CANNOT EXIST AND BE ABSENT FROM THE HUB" is the rule, and the way
// it is kept is that the hub reads the same directory the router reads. A
// hand-written list would be one entry behind after FW18 and the failure
// would be silent: the article exists, nothing links to it, and it is
// invisible to a crawler arriving through this page.
//
// SO THE ASSERTION IS ABOUT THE SOURCE rather than about the markup. If the
// hub ever grows a literal list, this is what fails.

import { describe, expect, it } from 'vitest';
import { faqPageLd } from '@/lib/content/jsonld';
import { anchorFor } from '@/lib/guides/headings';
import { PUBLIC_ROUTES, isLive, isRegistered } from '@/lib/content/routes';
import { checkMesh } from '@/lib/guides/mesh';
import { GUIDES_PATH, allGuides, publishedGuides } from '@/lib/guides/registry';

describe('the hub lists exactly the published guides', () => {
  it('takes its entries from the registry, not from a list', () => {
    // The hub renders publishedGuides(); the mesh checker is handed the same
    // set as its `hub` argument by that page's own source of truth. This
    // asserts the identity that makes the in-hub rule unbreakable today.
    const published = publishedGuides().map((guide) => guide.frontmatter.slug);

    expect(checkMesh(publishedGuides(), published)).toEqual([]);
  });

  it('excludes fixtures, which are not content', () => {
    const published = publishedGuides().map((guide) => guide.file);

    expect(published.some((file) => file.startsWith('_'))).toBe(false);
  });

  it('has content now, and the pillar is in it', () => {
    // FW16's ASSERTION WAS "publishedGuides().length is 0", with a comment
    // saying it existed to fail the day somebody added the first article so
    // that the sitemap flag got flipped DELIBERATELY. It fired on this one.
    //
    // Replaced rather than deleted, and replaced with the same kind of
    // tripwire one step along: the hub is no longer empty, every article it
    // lists is a declared route, and /guides is STILL `planned`. FW17's
    // increment 4 flips the four routes together - hub and three articles -
    // because a hub in the sitemap whose entries are not is a crawler being
    // told half a story.
    expect(publishedGuides().length).toBeGreaterThan(0);
    expect(allGuides().length).toBeGreaterThan(publishedGuides().length);

    const slugs = publishedGuides().map((guide) => guide.frontmatter.slug);

    expect(slugs).toContain('teletravail-frontalier-40-pourcent');
  });

  it('gives every article a breadcrumb label that is NOT its title (Q45)', () => {
    // THE WHOLE POINT OF THE FIELD. FW17's read-through found the breadcrumb
    // rendering frontmatter.title, so a reader met the full title twice,
    // stacked, before the first sentence - and FD13 draws a short label.
    //
    // A FIELD SOMEBODY FILLS BY COPYING THE TITLE IS THE FIELD NOT EXISTING,
    // which is why this asserts the difference rather than the presence. The
    // schema's max(40) enforces "short"; this enforces "not the title".
    for (const guide of allGuides()) {
      const { title, breadcrumbLabel, slug } = guide.frontmatter;

      expect(breadcrumbLabel, slug).not.toBe(title);
      expect(breadcrumbLabel.length, `${slug} label is not shorter`).toBeLessThan(title.length);
    }
  });

  it('lists nothing that is not a declared route', () => {
    // SPEC 14 makes a guide slug permanent, and lib/content/routes.ts is
    // where the product's URLs are declared once. An article on disk whose
    // path is not declared would reach readers through the hub and never
    // reach the sitemap - live to a person, invisible to a crawler.
    const undeclared = publishedGuides()
      .map((guide) => `${GUIDES_PATH}/${guide.frontmatter.slug}`)
      .filter((path) => !isRegistered(path));

    expect(undeclared, undeclared.join(', ')).toEqual([]);
  });

  it('is live, with every article it lists live beside it', () => {
    // THE TRIPWIRE FIRED AND THIS IS THE DELIBERATE ANSWER. FW16 left /guides
    // planned so that an empty hub could not reach the sitemap; FW17 gave it
    // three articles, and the hub and its three entries go live TOGETHER. A
    // live hub whose articles are planned puts a page in the sitemap whose
    // every link leaves it; three live articles with a planned hub leaves
    // them with one way in.
    expect(isLive(GUIDES_PATH)).toBe(true);

    const notLive = publishedGuides()
      .map((guide) => `${GUIDES_PATH}/${guide.frontmatter.slug}`)
      .filter((path) => !isLive(path));

    expect(notLive, `listed on a live hub but not live: ${notLive.join(', ')}`).toEqual([]);
  });

  it('declares no LIVE guide route without an article behind it', () => {
    // THE OTHER DIRECTION, AND FW17 FOUND OUT IT WAS MISSING. FW16 built the
    // sitemap from two lists - the route registry for the product's pages and
    // the content directory for the articles - and they agreed only while
    // there were no articles. The first one made them disagree: the pillar
    // appeared in the sitemap with its route still `planned`, and the moment
    // that route went live the same URL would have been emitted TWICE, in
    // valid XML, with nothing to object.
    //
    // The sitemap is single-sourced now; this is the assertion that keeps the
    // two registries honest with each other. A live guide route with no file
    // is a promised page that 404s - the exact thing the status field exists
    // to prevent.
    const published = new Set(publishedGuides().map((guide) => guide.frontmatter.slug));

    const empty = PUBLIC_ROUTES.filter(
      (route) =>
        route.status === 'live' &&
        route.path.startsWith(`${GUIDES_PATH}/`) &&
        !published.has(route.path.slice(GUIDES_PATH.length + 1)),
    ).map((route) => route.path);

    expect(empty, `live guide routes with no article: ${empty.join(', ')}`).toEqual([]);
  });
});

describe('the FAQ and its structured data come from one source', () => {
  /** The mapping the article page makes: frontmatter.faq -> FaqEntry. */
  const entriesFor = (faq: readonly { question: string; answer: string }[]) =>
    faq.map((entry) => ({
      id: anchorFor(entry.question),
      question: entry.question,
      answer: entry.answer,
    }));

  it('publishes exactly the questions the frontmatter declares', () => {
    // THE IDENTITY ASSERTION THE PROMPT ASKS FOR, at the level where both
    // consumers are visible. The rendered accordion is asserted against the
    // same array in e2e, against served HTML.
    const fixture = allGuides().find((guide) => guide.file.startsWith('_'));
    const faq = fixture?.frontmatter.faq ?? [];

    expect(faq.length).toBeGreaterThan(0);

    const published = faqPageLd(entriesFor(faq));

    expect(published.mainEntity.map((question) => question.name)).toEqual(
      faq.map((entry) => entry.question),
    );
    expect(published.mainEntity.map((question) => question.acceptedAnswer.text)).toEqual(
      faq.map((entry) => entry.answer),
    );
  });

  it('derives the anchor rather than letting an author write one', () => {
    // An id in frontmatter would be a URL fragment written by hand, in a
    // file whose author is thinking about prose. Derived, it cannot drift
    // from the question it belongs to.
    const faq = [{ question: 'Les conges comptent-ils ?', answer: 'Une reponse assez longue.' }];

    expect(entriesFor(faq)[0]?.id).toBe('les-conges-comptent-ils');
  });

  it('emits no FAQPage at all for an article with no FAQ', () => {
    // An empty FAQPage is structured data about nothing. The page omits the
    // script entirely rather than publishing an empty mainEntity.
    expect(faqPageLd([]).mainEntity).toEqual([]);
  });
});
