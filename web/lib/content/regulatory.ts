// web/lib/content/regulatory.ts
//
// RULING R51 - THE "VERIFIE LE" DATE MUST NOT LIE.
//
// One constant, and it is null. Until the operator records the Checkpoint A
// human gate, this product has not had its constants checked against a primary
// source, and the footer must say so rather than print a date.
//
// WHY THIS IS THE MOST DANGEROUS STRING ON THE SITE. The whole proposition is
// credibility - SPEC 9.1 puts a dated review in the footer of every page,
// beside a source list and a named reviewer, precisely because that is what
// separates this from a blog post. A date printed before anyone reviewed
// anything is therefore the claim a reader would most reasonably rely on AND
// the one that would be false. Everything else on the site can be improved
// later; this one would have to be retracted.
//
// SETTING IT IS THE OPERATOR'S, AT THE GATE. docs/checkpoint-a.md holds twelve
// unchecked boxes - seven constants and five open questions, two of which
// (truncation versus rounding, and whether 49,9 % is a maximum or a shorthand
// for "under 50 %") can still move the fixtures. None is ticked. When they are,
// this becomes the ISO day of that review and the footer switches sentence.
//
// R28: an ISO day string, never a Date. A calendar day carries no instant, so
// there is no zone to get wrong, and `new Date('2026-02-30')` silently rolls
// over to March 2 - which is why formatDate validates by round-tripping
// instead of trusting the parse.

import { SHELL_COPY } from '@/lib/fr/shell';
import { formatDate } from '@/lib/ui/core';

/**
 * The day the regulatory constants were last verified against primary
 * sources, or null if that has not happened.
 *
 * DO NOT set this to a placeholder, to today, or to the date the code was
 * written. null is not a gap to be filled in - it is the accurate answer
 * until docs/checkpoint-a.md's human gate is recorded.
 */
export const LAST_REGULATORY_REVIEW: string | null = null;

/**
 * The footer's review line.
 *
 * A PURE FUNCTION taking the value rather than reading the constant, so both
 * branches are testable without mocking a module - and the footer calls it
 * with LAST_REGULATORY_REVIEW and nothing else. It deliberately takes no
 * default: a `review` argument that could be omitted, or a prop on the footer,
 * would be exactly the channel through which a date that has not happened
 * could reach the page. PublicShell's test asserts the footer passes the
 * constant.
 *
 * Throws on anything that is not an ISO day, via formatDate's own validation,
 * rather than printing it: an arbitrary string in the place a reader trusts
 * most is worse than a crash in CI.
 */
export function reviewNotice(review: string | null): string {
  return review === null ? SHELL_COPY.reviewPending : SHELL_COPY.reviewDone(formatDate(review));
}
