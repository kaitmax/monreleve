// @vitest-environment jsdom
// web/tests/unit/pages/jsonld-render.test.tsx
//
// The structured data as it reaches the document, compared against the page
// it describes.
//
// WHY THIS EXISTS BESIDE tests/unit/content/jsonld.test.ts. That file asserts
// the builders: given these entries, this object. It cannot catch the page
// handing the FAQPage one set of entries and the accordion another - both
// would be internally consistent and the two would disagree in the shipped
// HTML. So this reads the RENDERED output twice, once from the script element
// and once from the summaries, and requires them to be the same strings.
//
// That is the strongest available form of "one source, two consumers": not
// that both consumers were passed the same array, but that what a crawler
// reads and what a reader sees are identical after rendering.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CalculateurPage from '@/app/(public)/calculateur-teletravail-frontalier/page';
import { guideNavLinks } from '@/lib/guides/registry';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

afterEach(cleanup);

interface FaqPage {
  readonly '@type': string;
  readonly mainEntity?: { name: string; acceptedAnswer: { text: string } }[];
}

function structuredData(container: HTMLElement): FaqPage[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map(
    (script) => JSON.parse(script.textContent ?? '') as FaqPage,
  );
}

describe('the JSON-LD in the rendered page', () => {
  it('emits two objects, both parseable', () => {
    // PARSEABLE IS NOT A FORMALITY. The whole question of how to put JSON
    // inside a script element is about whether the text survives rendering,
    // and the answer measured for React 19 is that it does - including "&"
    // unescaped and "</script>" neutralised as s. If that ever changed,
    // the failure would be silent in every test that looks at the builders.
    const { container } = render(
      <PublicShell guideLinks={guideNavLinks()}>
        <CalculateurPage />
      </PublicShell>,
    );

    const emitted = structuredData(container);

    expect(emitted.map((object) => object['@type']).sort()).toEqual([
      'FAQPage',
      'WebApplication',
    ]);
  });

  it('publishes exactly the questions the accordion renders', () => {
    const { container } = render(
      <PublicShell guideLinks={guideNavLinks()}>
        <CalculateurPage />
      </PublicShell>,
    );

    const faq = structuredData(container).find((object) => object['@type'] === 'FAQPage');
    const summaries = [...container.querySelectorAll('[data-faq] summary')].map(
      (node) => node.textContent,
    );

    expect(summaries.length).toBeGreaterThan(0);
    expect(faq?.mainEntity?.map((question) => question.name)).toEqual(summaries);
  });

  it('publishes exactly the answers the accordion renders', () => {
    const { container } = render(
      <PublicShell guideLinks={guideNavLinks()}>
        <CalculateurPage />
      </PublicShell>,
    );

    const faq = structuredData(container).find((object) => object['@type'] === 'FAQPage');
    const answers = [...container.querySelectorAll('[data-faq] details > p')].map(
      (node) => node.textContent,
    );

    expect(answers.length).toBeGreaterThan(0);
    expect(faq?.mainEntity?.map((question) => question.acceptedAnswer.text)).toEqual(answers);
  });
});
