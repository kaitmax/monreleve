// web/lib/content/jsonld.ts
//
// SPEC 14's structured data: WebApplication on the calculators, FAQPage on
// the calculator's inline FAQ.
//
// ONE RULE GOVERNS EVERY PROPERTY HERE: nothing in the JSON-LD that is not
// visible on the page. Structured data is written for a crawler and read by
// nobody, which is exactly the condition under which it drifts from the page
// and nobody notices - and a structured claim a reader cannot verify is
// cloaking, which is treated as manipulation rather than as an error.
//
// THE ALLOW-LISTS BELOW ARE THE ENFORCEMENT. tests/unit/content/jsonld.test.ts
// walks the emitted objects, collects every property name including nested
// ones, and requires the set to equal these lists exactly. Adding a property
// is therefore a deliberate edit in two places, and the second one is where
// somebody has to say where on the page a reader can see it.
//
// WHAT IS DELIBERATELY ABSENT: aggregateRating, offers/price and author.
// Those are what the rich-result documentation asks for, which is precisely
// why they are the ones a template acquires without anybody deciding to. This
// product has no reviews, no price on the calculator, and no named author,
// and inventing any of the three to earn a richer snippet would be the
// cheapest lie available.
//
// NO RICH RESULT IS EXPECTED FROM WebApplication FOR THAT REASON, and that is
// a trade made knowingly: without offers and aggregateRating the markup is
// descriptive rather than eligible. SPEC 14 asks for the entity; it does not
// ask for a star rating this product cannot support.
//
// THE RULE ALREADY REMOVED ONE OF MY OWN PROPERTIES. isAccessibleForFree was
// emitted here and then withdrawn: the only place the product says the
// calculation is free is the META DESCRIPTION, which a reader never sees. It
// is defensible - using the page costs nothing - and that is exactly the kind
// of argument this rule exists to refuse. A rule softened the first time it
// is inconvenient is not a rule, and the property earned no rich result
// anyway.

import type { FaqEntry } from '@/lib/fr/faq';

/** Every property name webApplicationLd can emit, nested ones included. */
export const WEB_APPLICATION_PROPERTIES = [
  '@context',
  '@type',
  'name',
  'description',
  'url',
  'applicationCategory',
  'inLanguage',
] as const;

/** Every property name faqPageLd can emit, nested ones included. */
export const FAQ_PAGE_PROPERTIES = [
  '@context',
  '@type',
  'mainEntity',
  'name',
  'acceptedAnswer',
  'text',
] as const;

const CONTEXT = 'https://schema.org';

export interface WebApplicationInput {
  /** The page's h1, so the name a crawler reads is the one a reader sees. */
  readonly name: string;
  /** The page's own visible lead, not the meta description. */
  readonly description: string;
  /**
   * The canonical URL, or absent.
   *
   * R81: with no configured origin there is no absolute URL to give, and a
   * relative one in JSON-LD is not resolved by every consumer. The property
   * is omitted rather than pointed at a localhost stand-in - the same
   * decision the canonical and the social card already make.
   */
  readonly url?: string;
}

export interface FaqQuestionLd {
  readonly '@type': 'Question';
  readonly name: string;
  readonly acceptedAnswer: {
    readonly '@type': 'Answer';
    readonly text: string;
  };
}

export interface FaqPageLd {
  readonly '@context': string;
  readonly '@type': 'FAQPage';
  readonly mainEntity: readonly FaqQuestionLd[];
}

export interface WebApplicationLd {
  readonly '@context': string;
  readonly '@type': 'WebApplication';
  readonly name: string;
  readonly description: string;
  readonly url?: string;
  readonly applicationCategory: string;
  readonly inLanguage: string;
}

export function webApplicationLd(input: WebApplicationInput): WebApplicationLd {
  return {
    '@context': CONTEXT,
    '@type': 'WebApplication',
    name: input.name,
    description: input.description,
    ...(input.url === undefined ? {} : { url: input.url }),

    // The schema taxonomy for what this is, rather than a claim about it.
    applicationCategory: 'FinanceApplication',

    // One locale by design (SPEC section 1), and the same value the layout
    // declares as hreflang. Verifiable by reading the page.
    inLanguage: 'fr-FR',
  };
}

/**
 * The FAQPage, from the same entries the accordion renders.
 *
 * TAKES THE RENDERED ENTRIES RATHER THAN READING lib/fr ITSELF. If this
 * module resolved the copy independently, the two consumers could be given
 * different arguments - a different year's ceilings, say - and both would
 * look correct in isolation. Passing the same array the page renders makes
 * disagreement impossible rather than merely unlikely.
 */
export function faqPageLd(entries: readonly FaqEntry[]): FaqPageLd {
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question' as const,
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: entry.answer,
      },
    })),
  };
}

/**
 * JSON for a <script> element.
 *
 * ESCAPING < IS THE WHOLE POINT, and it is a property of this function rather
 * than of today's copy. An HTML parser inside a script element looks for the
 * literal characters "</script" and stops there; a string containing one
 * would end the element early and put the rest of the JSON into the document
 * as markup. < is valid JSON and parses back to "<", so the data is
 * unchanged and the sequence cannot occur.
 *
 * This is what makes the one dangerouslySetInnerHTML in JsonLd.tsx
 * defensible: not that the input happens to be ours today, but that no input
 * can close the element.
 */
export function serialiseLd(value: unknown): string {
  return JSON.stringify(value).split('<').join('\\u003c');
}
