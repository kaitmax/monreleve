// @vitest-environment jsdom
//
// web/tests/unit/pages/accessibility-guides.test.tsx
//
// FW16 increment 6: zero axe violations on the guides surface, in the states
// it can be in.
//
// WHY THE ARTICLE IS ASSEMBLED FROM ITS PARTS HERE. The route is an async
// server component that compiles MDX, and jsdom can run neither half. What
// jsdom CAN do is render the pieces the article is made of - the outline, the
// FAQ accordion, the closing card - in the same arrangement and in every
// state, which is where accessibility defects live: an accordion whose
// answers are hidden from the tree, an outline whose links have no accessible
// name, a heading level that skips.
//
// The article as SERVED is checked in e2e/guides.spec.ts, which reads real
// HTML in a real browser. Neither alone is enough: this one runs in
// milliseconds on every commit and covers the states, that one covers the
// compiled output.
//
// THE HUB IS A SYNCHRONOUS SERVER COMPONENT and renders here as itself.
//
// WHAT AXE CANNOT SEE: jsdom has no layout, so colour-contrast comes back
// INCOMPLETE and no size is measurable. Contrast is answered by
// tests/unit/tokens/contrast.test.ts - which caught a real 2,58:1 defect on
// this very surface - and the 320 dp overflow by e2e.

import { compileMDX } from 'next-mdx-remote/rsc';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import GuidesHubPage from '@/app/(public)/guides/page';
import { GUIDES_COPY } from '@/lib/fr/guides';
import { anchorFor, headingsIn } from '@/lib/guides/headings';
import { allGuides, publishedGuides } from '@/lib/guides/registry';
import type { Guide } from '@/lib/guides/registry';
import { mdxComponents } from '@/lib/guides/mdx-components';
import { MDX_OPTIONS } from '@/lib/guides/mdx-options';
import { guideScope } from '@/lib/guides/scope';
import { Faq } from '@/lib/ui/react/Faq/Faq';
import { GuideCta } from '@/lib/ui/react/GuideCta/GuideCta';
import { GuideInlineCta } from '@/lib/ui/react/GuideInlineCta/GuideInlineCta';
import { DataGrid } from '@/lib/ui/react/DataGrid/DataGrid';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';
import { TableOfContents } from '@/lib/ui/react/TableOfContents/TableOfContents';

expect.extend(matchers);

afterEach(cleanup);

const fixture = allGuides().find((guide) => guide.file.startsWith('_'));
const headings = headingsIn(fixture?.body ?? '');
const faq = (fixture?.frontmatter.faq ?? []).map((entry) => ({
  id: anchorFor(entry.question),
  question: entry.question,
  answer: entry.answer,
}));

/** The article's furniture, in document order, as the route arranges it. */
function ArticleParts() {
  return (
    <main>
      <article>
        <h1>{fixture?.frontmatter.title}</h1>

        <TableOfContents label={GUIDES_COPY.tocLabel} headings={headings} />

        <div>
          {headings.map((heading) =>
            heading.depth === 2 ? (
              <h2 key={heading.id} id={heading.id}>
                {heading.text}
              </h2>
            ) : (
              <h3 key={heading.id} id={heading.id}>
                {heading.text}
              </h3>
            ),
          )}
        </div>

        {/*
          FW18b'S TWO NEW SURFACES, both of which axe has something to say
          about and neither of which the fixture contains.

          THE INLINE CARD is an aside with a link in it, mid-article, and the
          question axe answers is whether a second call to action with the
          same accessible name as the closing card's reads as a duplicate or
          as a repetition of one offer.

          THE SCROLL CONTAINER is the one that had to be checked: R159 makes
          it tabbable and gives it role="region" with a name, which is three
          separate things axe can object to - a focusable element with no
          accessible name, a landmark without one, and duplicated landmark
          names if two tables ever shared a caption. A table is therefore
          rendered here even though the fixture has none.
        */}
        <GuideInlineCta />

        <DataGrid
          caption="Six années comparées"
          columns={[
            { key: 'cas', header: 'Cas' },
            { key: 'taux', header: 'Taux déclarable', numeric: true },
          ]}
          rows={[
            { key: 'a', cells: { cas: '72 jours, aucune mission', taux: '30,00 %' } },
            { key: 'b', cells: { cas: '84 jours, 24 de mission', taux: '39,16 %' } },
          ]}
          total={{ key: 'total', cells: { cas: 'Moyenne', taux: '34,58 %' } }}
        />

        <Faq heading={GUIDES_COPY.faqHeading} entries={faq} />
        <GuideCta />
      </article>
    </main>
  );
}

describe('the article surface has no axe violations', () => {
  it('found the fixture, so nothing below passes vacuously', () => {
    expect(headings.length).toBeGreaterThanOrEqual(4);
    expect(faq.length).toBeGreaterThan(0);
  });

  it('with the FAQ closed, which is how every reader meets it', async () => {
    const { container } = render(<ArticleParts />);

    expect(container.querySelectorAll('details[open]').length).toBe(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('with every FAQ answer open, the heaviest state', async () => {
    const { container } = render(<ArticleParts />);

    for (const details of container.querySelectorAll('details')) details.open = true;

    expect(await axe(container)).toHaveNoViolations();
  });

  it('inside the public shell, where landmarks can collide', async () => {
    // A nav nested in a nav, a second main, a heading order broken by the
    // shell's own furniture - none of which is visible from the parts alone.
    const { container } = render(
      <PublicShell>
        <ArticleParts />
      </PublicShell>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('the hub has no axe violations', () => {
  it('renders and passes, inside the shell', async () => {
    const { container } = render(
      <PublicShell>
        <GuidesHubPage />
      </PublicShell>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// THE REAL ARTICLES, COMPILED. FW17.
//
// Everything above renders the article's FURNITURE - outline, FAQ, closing
// card - because this file was written when the only article was a fixture
// made of headings, paragraphs and links. FW17's three real guides use the
// half of the kit that had never been rendered anywhere: the Encadre summary
// block, the Avertissement banner and a DataGrid comparison table.
//
// Those are exactly where the accessibility defects on this surface would be.
// A table with no accessible name is announced as "table"; an aside with no
// role is furniture a screen reader walks past; a banner whose text relies on
// colour alone is unreadable. None of it was covered.
//
// AND IT CAN BE COVERED, which FW16 did not know: compileMDX is an async
// function, not a server component, so a test can await it. The page is what
// jsdom cannot run. So each article is compiled with the REAL component map
// and the REAL scope, rendered to HTML, and axed as it will be served.
// ---------------------------------------------------------------------------

const YEAR = 2026;

/** Every article a reader can reach, compiled as the route compiles it. */
async function compiledArticle(guide: Guide): Promise<string> {
  const { content } = await compileMDX({
    source: guide.body,
    components: mdxComponents({ file: guide.file, headings: headingsIn(guide.body) }),
    options: { ...MDX_OPTIONS, scope: guideScope(YEAR) },
  });

  return renderToStaticMarkup(content);
}

describe('every published article passes axe as compiled', () => {
  const published = publishedGuides();

  it('found the three articles, so nothing below passes vacuously', () => {
    expect(published.length).toBeGreaterThanOrEqual(3);
  });

  it.each(published.map((guide) => [guide.frontmatter.slug, guide] as const))(
    '%s',
    async (_slug, guide) => {
      const html = await compiledArticle(guide);
      const container = document.createElement('div');

      // The landmarks the route puts around the body, so a heading level or a
      // nested landmark is judged in the arrangement a reader meets.
      container.innerHTML = `<main><article><h1>${guide.frontmatter.title}</h1>${html}</article></main>`;
      document.body.append(container);

      try {
        expect(await axe(container)).toHaveNoViolations();
      } finally {
        // REMOVED, AND THE FIRST VERSION DID NOT. afterEach(cleanup) unmounts
        // testing-library renders and knows nothing about a node appended by
        // hand, so each case left its <main> in the document and the next one
        // was judged against two. axe reported landmark-no-duplicate-main on
        // articles two and three - a real rule, a violation this test created.
        //
        // Worth keeping the note: a per-case fixture that leaks is how a suite
        // starts reporting faults that belong to itself, and the first
        // instinct on reading "more than one main landmark" was to go looking
        // at the template.
        container.remove();
      }
    },
  );

  it('actually rendered the kit, so the assertion is about more than prose', async () => {
    // NON-VACUITY WITH TEETH. If the component map were not applied, the
    // output would be plain HTML and every assertion above would still pass -
    // which is the same failure R120 keeps naming. These three markers are
    // the parts that had never been rendered anywhere before FW17.
    const all = (await Promise.all(published.map(compiledArticle))).join('');

    expect(all, 'no Encadre rendered').toContain('data-summary');
    expect(all, 'no Avertissement rendered').toContain('data-warning');
    expect(all, 'no DataGrid rendered').toContain('<table');
  });

  it('gives every comparison table an accessible name', async () => {
    // A <caption> is the table's only name. Without one a screen reader
    // announces "table" and the reader has to infer what it compares - and
    // axe does not fail an unnamed table, so this is asserted directly.
    for (const guide of published) {
      const html = await compiledArticle(guide);
      const tables = html.split('<table').length - 1;
      const captions = html.split('<caption').length - 1;

      expect(captions, `${guide.frontmatter.slug}: ${String(tables)} table(s)`).toBe(tables);
    }
  });
});

describe('the outline is navigable by keyboard', () => {
  it('gives every entry a focusable link with an accessible name', () => {
    // An outline of links with no text - icons, or empty anchors - passes a
    // count and fails a screen reader. The name IS the heading text, which
    // is what makes the outline usable without sight of the page.
    const { container } = render(<ArticleParts />);
    const links = [...container.querySelectorAll('[data-toc] a')];

    expect(links.length).toBe(headings.length);

    for (const link of links) {
      expect(link.getAttribute('tabindex')).toBeNull();
      expect((link.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('names the outline itself, so it can be jumped to', () => {
    const { container } = render(<ArticleParts />);
    const nav = container.querySelector('[data-toc]');

    expect(nav?.getAttribute('aria-label')).toBe(GUIDES_COPY.tocLabel);
  });
});

describe('the heading outline does not skip a level', () => {
  it('goes h1, then h2 before any h3', () => {
    // A skipped level is the commonest structural defect on a long document
    // and axe does not always report it. The article's h1 is the title; the
    // FAQ and the closing card are h2s; a body h3 must follow a body h2.
    const { container } = render(<ArticleParts />);
    const levels = [...container.querySelectorAll('h1, h2, h3')].map((node) =>
      Number(node.tagName.slice(1)),
    );

    expect(levels[0]).toBe(1);

    for (const [index, level] of levels.entries()) {
      if (index === 0) continue;

      const previous = levels[index - 1] ?? 1;

      expect(level - previous, `${String(previous)} -> ${String(level)}`).toBeLessThanOrEqual(1);
    }
  });
});
