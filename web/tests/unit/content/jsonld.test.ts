// web/tests/unit/content/jsonld.test.ts
//
// SPEC 14's structured data, and the one rule that governs all of it:
// NOTHING IN THE JSON-LD THAT IS NOT VISIBLE ON THE PAGE.
//
// WHY THAT RULE AND NOT "VALID SCHEMA". Valid schema is easy and beside the
// point. The failure mode of structured data is that it is written for a
// crawler and read by nobody, so it drifts from the page and nobody notices -
// and at that point it is cloaking, which search engines treat as a
// manipulation rather than as an error. aggregateRating is the canonical
// example: a rating nobody gave, on a page with no reviews, emitted because a
// template had a slot for it.
//
// SO THE ALLOW-LIST IS THE TEST. Every property the builders emit is
// enumerated - recursively, including nested objects - and compared against a
// declared set. A new property fails here, which forces whoever adds one to
// say where on the page a reader can see it.
//
// AND THE FAQ SET IS COMPARED AGAINST THE RENDERED ACCORDION, not against a
// copy of the questions. One source, two consumers: lib/fr/faq.ts. If the two
// could disagree there would be no way to know which was wrong.

import { TEST_ORIGIN } from '../../../lib/content/identity';
import { describe, expect, it } from 'vitest';
import {
  FAQ_PAGE_PROPERTIES,
  WEB_APPLICATION_PROPERTIES,
  faqPageLd,
  serialiseLd,
  webApplicationLd,
} from '@/lib/content/jsonld';
import { FAQ_COPY } from '@/lib/fr/faq';

const ENTRIES = FAQ_COPY.entries({ fiscal: 'AAA', social: 'BBB', basisDays: 'CCC' });

const APP = {
  name: 'Calculateur',
  description: 'Une description visible sur la page.',
  url: `${TEST_ORIGIN}/calculateur-teletravail-frontalier`,
};

/** Every property name in an object tree, deduplicated. */
function properties(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap(properties))];

  if (typeof value !== 'object' || value === null) return [];

  return [
    ...new Set(
      Object.entries(value).flatMap(([key, nested]) => [key, ...properties(nested)]),
    ),
  ];
}

describe('the FAQPage is generated from the visible FAQ', () => {
  it('asks exactly the questions the accordion renders, in order', () => {
    // THE ASSERTION THE PROMPT ASKS FOR, and it is about identity rather than
    // about coverage: same questions, same order, same strings. A FAQPage
    // listing a fourth question, or the same three worded differently, is a
    // claim about a page that does not exist.
    const emitted = faqPageLd(ENTRIES).mainEntity.map((question) => question.name);

    expect(emitted).toEqual(ENTRIES.map((entry) => entry.question));
  });

  it('answers them with the text the accordion shows', () => {
    const emitted = faqPageLd(ENTRIES).mainEntity.map(
      (question) => question.acceptedAnswer.text,
    );

    expect(emitted).toEqual(ENTRIES.map((entry) => entry.answer));
  });

  it('is the shape a validator expects', () => {
    const page = faqPageLd(ENTRIES);

    expect(page['@context']).toBe('https://schema.org');
    expect(page['@type']).toBe('FAQPage');
    expect(page.mainEntity.length).toBe(ENTRIES.length);

    for (const question of page.mainEntity) {
      expect(question['@type']).toBe('Question');
      expect(question.acceptedAnswer['@type']).toBe('Answer');
      expect(question.name.length).toBeGreaterThan(0);
      expect(question.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });

  it('emits no property outside the allow-list', () => {
    expect(properties(faqPageLd(ENTRIES)).sort()).toEqual([...FAQ_PAGE_PROPERTIES].sort());
  });
});

describe('the WebApplication claims only what the page shows', () => {
  it('is the shape a validator expects', () => {
    const app = webApplicationLd(APP);

    expect(app['@context']).toBe('https://schema.org');
    expect(app['@type']).toBe('WebApplication');
    expect(app.name).toBe(APP.name);
    expect(app.description).toBe(APP.description);
    expect(app.url).toBe(APP.url);
  });

  it('omits the url rather than naming one that cannot be reached (R81)', () => {
    // The same ruling as the canonical and the card. With no origin there is
    // no absolute URL to give, and a relative one in JSON-LD is not resolved
    // by every consumer - so the property is absent, which is the safer
    // failure.
    const app = webApplicationLd({ name: APP.name, description: APP.description });

    expect('url' in app).toBe(false);
  });

  it('emits no property outside the allow-list', () => {
    expect(properties(webApplicationLd(APP)).sort()).toEqual(
      [...WEB_APPLICATION_PROPERTIES].sort(),
    );
  });

  it('carries no rating, no price and no author', () => {
    // NAMED RATHER THAN LEFT TO THE ALLOW-LIST, because these three are the
    // ones a future template will add without thinking - they are what the
    // rich-result documentation asks for, and this product has no reviews, no
    // price on this page, and no named author. The allow-list would catch
    // them; this says why they are refused.
    const emitted = properties(webApplicationLd(APP));

    for (const forbidden of ['aggregateRating', 'ratingValue', 'offers', 'price', 'author']) {
      expect(emitted, `${forbidden} is a claim this page does not make`).not.toContain(
        forbidden,
      );
    }
  });
});

describe('serialisation', () => {
  it('escapes < so no string can close the script element', () => {
    // THE PROPERTY THAT MAKES THE INJECTION SITE ACCEPTABLE. The input is
    // built from lib/fr today and a closing tag cannot appear in it, but the
    // reason this is safe must be a property of the serialiser rather than of
    // the current copy.
    const serialised = serialiseLd({ name: '</script><img onerror=alert(1)>' });

    expect(serialised).not.toContain('</script>');
    expect(serialised).not.toContain('<');
    expect(serialised).toContain('\\u003c');
  });

  it('round-trips as JSON, which is what a consumer parses', () => {
    const serialised = serialiseLd(faqPageLd(ENTRIES));
    const parsed = JSON.parse(serialised) as { mainEntity: { name: string }[] };

    expect(parsed.mainEntity.map((question) => question.name)).toEqual(
      ENTRIES.map((entry) => entry.question),
    );
  });
});
