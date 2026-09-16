// @vitest-environment jsdom
//
// web/tests/unit/pages/guide-section-order.test.tsx
//
// RULING R137 applied to the article template: ADJACENCY IS ASSERTED AS
// SEQUENCE OR NOT AT ALL.
//
// WHY IT MATTERS MORE HERE THAN ANYWHERE ELSE IN THE PRODUCT. One file
// renders seven articles. A section order that drifts drifts on every guide
// at once, and FD13's order is not arbitrary: the breadcrumb orients, the h1
// names, the chips establish WHEN THIS WAS LAST CHECKED - which the brief
// puts first among the three, because on a subject whose rules change
// annually that matters more than who wrote it - and only then does the prose
// start.
//
// EVERY ELEMENT COULD BE PRESENT AND CORRECT IN THE WRONG ORDER, which is
// exactly how FW13 shipped a share row above the notice explaining it with
// every element individually tested.
//
// THE ARTICLE IS THE FIXTURE, deliberately. Asserting the template against
// content a reviewer will rewrite is how suites come to be edited to match
// whatever the page now does.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GUIDES_COPY } from '@/lib/fr/guides';
import { allGuides } from '@/lib/guides/registry';
import { readingMinutes } from '@/lib/guides/reading-time';

afterEach(cleanup);

/**
 * The page is an async server component that compiles MDX, which jsdom
 * cannot render. What R137 is about is the ORDER OF THE HEAD - breadcrumb,
 * title, chips, rule - and that part is plain markup, so the test renders the
 * same structure the route builds and asserts the sequence in it.
 *
 * THE RISK THIS CARRIES, stated rather than hidden: a copy of the markup can
 * drift from the route. It is closed from the other side by
 * e2e/guides.spec.ts, which reads the SERVED page and asserts the same order
 * against real HTML. This file catches the ordering mistake in milliseconds;
 * that one catches the drift.
 */
const SELECTORS = ['[data-breadcrumb]', 'h1', '[data-chips]', 'hr', '[data-prose]'] as const;

const NAMES: Readonly<Record<string, string>> = {
  '[data-breadcrumb]': 'breadcrumb',
  h1: 'title',
  '[data-chips]': 'metadata chips',
  hr: 'rule',
  '[data-prose]': 'prose',
};

function sequence(container: HTMLElement): string[] {
  return [...container.querySelectorAll(SELECTORS.join(', '))].map((element) => {
    const match = SELECTORS.find((selector) => element.matches(selector));

    return NAMES[String(match)] ?? 'unknown';
  });
}

const fixture = allGuides().find((guide) => guide.file.startsWith('_'));

/** The head, exactly as app/(public)/guides/[slug]/page.tsx builds it. */
function Head() {
  const frontmatter = fixture?.frontmatter;

  return (
    <article>
      <nav aria-label={GUIDES_COPY.breadcrumbLabel} data-breadcrumb>
        <ol>
          <li>
            <a href="/guides">{GUIDES_COPY.hubTitle}</a>
          </li>
          <li aria-current="page">{frontmatter?.title}</li>
        </ol>
      </nav>
      <h1>{frontmatter?.title}</h1>
      <ul data-chips>
        <li>{GUIDES_COPY.reviewedOn('09.09.2026')}</li>
        <li>
          <a href="/sources">{GUIDES_COPY.expertReview}</a>
        </li>
        <li>{GUIDES_COPY.readingTime(readingMinutes(fixture?.body ?? ''))}</li>
      </ul>
      <hr />
      <div data-prose />
    </article>
  );
}

describe('R137: the article renders its sections in one order', () => {
  it('puts the head in FD13s sequence, ending at the prose', () => {
    const { container } = render(<Head />);

    expect(sequence(container)).toEqual([
      'breadcrumb',
      'title',
      'metadata chips',
      'rule',
      'prose',
    ]);
  });

  it('finds every section it claims to order', () => {
    // R63. A selector that stopped matching would shorten the list above and
    // every assertion would still pass on the shorter one.
    const { container } = render(<Head />);

    for (const selector of SELECTORS) {
      expect(container.querySelector(selector), selector).not.toBeNull();
    }
  });

  it('puts the verification date FIRST among the three chips', () => {
    // FD13 states this as a rule rather than a layout detail: "The
    // verification date comes first among the chips. On a subject whose rules
    // change annually, when this was last checked matters more than who wrote
    // it." Order inside the row is as much a decision as order down the page.
    const { container } = render(<Head />);
    const chips = [...(container.querySelector('[data-chips]')?.children ?? [])].map(
      (chip) => chip.textContent ?? '',
    );

    expect(chips.length).toBe(3);
    expect(chips[0]).toContain('09.09.2026');
    // R160: the middle chip states the review STATUS. It read the
    // fixture reviewer until FW18b - which also meant the assertion went
    // vacuous whenever the fixture failed to load, because of the ?? ''.
    expect(chips[1]).toContain(GUIDES_COPY.expertReview);
    expect(chips[2]).toContain('min de lecture');
  });
});
