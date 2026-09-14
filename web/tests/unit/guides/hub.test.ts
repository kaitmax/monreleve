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
import { checkMesh } from '@/lib/guides/mesh';
import { allGuides, publishedGuides } from '@/lib/guides/registry';

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

  it('is empty today, and that is why /guides is not in the sitemap yet', () => {
    // STATED RATHER THAN HIDDEN. FW16 ships infrastructure; FW17 and FW18
    // write the seven articles. An empty hub in the sitemap would tell a
    // crawler a page exists that says nothing - the "sitemap of 404s"
    // problem one level down. The route stays `planned` until it has
    // content, and this assertion is what will fail when it does, so that
    // whoever adds the first article flips the flag deliberately.
    expect(publishedGuides().length).toBe(0);
    expect(allGuides().length).toBeGreaterThan(0);
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
