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

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import GuidesHubPage from '@/app/(public)/guides/page';
import { GUIDES_COPY } from '@/lib/fr/guides';
import { anchorFor, headingsIn } from '@/lib/guides/headings';
import { allGuides } from '@/lib/guides/registry';
import { Faq } from '@/lib/ui/react/Faq/Faq';
import { GuideCta } from '@/lib/ui/react/GuideCta/GuideCta';
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
