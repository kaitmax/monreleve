// web/lib/guides/frontmatter.ts
//
// The frontmatter contract, as a zod schema.
//
// WHY IT FAILS THE BUILD RATHER THAN A TEST. An article with a missing
// `lastReviewed` or an unknown `cluster` is not a broken test, it is a page
// that would render wrongly for readers - a guide with no review date
// contradicts SPEC 9.5's "every guide carries a derniere verification date",
// and a FAQ with no answers publishes empty FAQPage entries. FW17 and FW18
// write seven of these at speed; the contract has to refuse the bad one at
// the moment it is written, not in a suite somebody runs later.
//
// SO parseFrontmatter THROWS, and the registry calls it while the page tree
// is being built. `next build` collects page data by importing the modules,
// so an invalid article stops the build with the file name and the zod issue
// in the message.
//
// THE SLUG IS IN THE FRONTMATTER AND MUST EQUAL THE FILE NAME (SPEC 14:
// "slugs are permanent"). Two sources for one identity is exactly the drift
// this repository keeps closing, and here the consequence is a URL that
// changes under readers who bookmarked it. Checked in readGuide, where both
// halves are in scope.

import { z } from 'zod';

/**
 * SPEC 9.5's three roles. A closed union rather than a string, because the
 * mesh checker's rules are keyed on it: a pillar must link every cluster, a
 * cluster must link back, and a canton page is long-tail and answers to
 * neither.
 */
export const CLUSTERS = ['pillar', 'cluster', 'canton'] as const;

export type Cluster = (typeof CLUSTERS)[number];

/** R28: an ISO day, so it sorts and formats without a timezone in sight. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const faqEntry = z.object({
  question: z.string().min(8),
  answer: z.string().min(20),
});

export const frontmatterSchema = z.object({
  title: z.string().min(8),
  description: z.string().min(40),

  /** Must equal the file name. Checked where both are in scope. */
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'a slug is lowercase words joined by hyphens'),

  cluster: z.enum(CLUSTERS),

  /**
   * SPEC 9.5's mesh. Declared on BOTH sides or it is not a relationship -
   * "forced cross-links dilute the signal", and the checker makes that
   * mechanical rather than editorial.
   */
  related: z.array(z.string()).default([]),

  /** R28, and SPEC 9.5's "derniere verification" date. */
  lastReviewed: z.string().regex(ISO_DAY, 'lastReviewed is an ISO day, e.g. 2026-09-09'),

  reviewer: z.string().min(2),

  /**
   * SPEC 14 puts FAQPage structured data on the guides, and FW15 established
   * the rule it follows: one source, two consumers. The accordion a reader
   * opens and the JSON-LD a crawler reads are generated from THIS array, so
   * they cannot disagree.
   */
  faq: z.array(faqEntry).default([]),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;

/**
 * Validate, or throw with the file named.
 *
 * The file name is in the message because zod's own error says which FIELD
 * is wrong and nothing about WHICH ARTICLE - and a build failing on
 * "Invalid input: expected string" with seven candidates is a hunt.
 */
export function parseFrontmatter(data: unknown, file: string): Frontmatter {
  const result = frontmatterSchema.safeParse(data);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid frontmatter in ${file}:\n${issues}`);
  }

  return result.data;
}
