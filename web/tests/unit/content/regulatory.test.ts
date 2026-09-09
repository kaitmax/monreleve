// web/tests/unit/content/regulatory.test.ts
//
// RULING R51: "the 'verifie le' date must not lie."
//
//   "The footer's regulatory-review date comes from a single constant
//    LAST_REGULATORY_REVIEW: string | null (ISO day, R28) in
//    lib/content/regulatory.ts. Until the Checkpoint A human gate is recorded
//    that constant is null and the footer renders the lib/fr variant
//    'Verification reglementaire en cours' - it never shows a date that has
//    not happened."
//
// WHY IT IS A RULING AND NOT A DETAIL. The whole product is a credibility
// play: a dated source list and a named reviewer are what separate it from a
// blog post, and SPEC 9.1 puts the review date in the footer of every page.
// A date printed before anyone reviewed anything is the single most damaging
// string this site could carry - it is the claim a reader would most reasonably
// rely on, and it would be false.
//
// SO THE NOTICE IS A PURE FUNCTION, tested exhaustively here, and the footer
// calls it with the constant and nothing else. Both halves matter: this file
// proves the function is right for every input, and PublicShell's own test
// proves the footer passes the CONSTANT rather than something a caller chose -
// because a `review` prop would be exactly the channel through which a date
// that has not happened could reach the page.

import { describe, expect, it } from 'vitest';
import { LAST_REGULATORY_REVIEW, reviewNotice } from '@/lib/content/regulatory';
import { SHELL_COPY } from '@/lib/fr/shell';
import { formatDate } from '@/lib/ui/core';

describe('the constant itself', () => {
  it('carries the Checkpoint A date, recorded 09.09.2026', () => {
    // IT WAS null FOR SEVEN TASKS, and the assertion that said so was correct
    // every one of them: not a placeholder, not an empty string, not today.
    // The gate ran on 09.09.2026 and this is the one place the date enters
    // the product.
    //
    // AN ISO DAY (R28), not a formatted one. formatDate turns it into Swiss
    // dots at the edge; storing "09.09.2026" here would make the constant
    // presentational and unparseable.
    expect(LAST_REGULATORY_REVIEW).toBe('2026-09-09');
  });

  it('is a real day, not a plausible-looking string', () => {
    // A date the engine cannot parse would render as "Invalid Date" in the
    // footer - a worse failure than the pending sentence it replaced, because
    // it looks like a bug rather than an honest absence.
    const parsed = new Date(`${LAST_REGULATORY_REVIEW ?? ''}T00:00:00Z`);

    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(8);
    expect(parsed.getUTCDate()).toBe(9);
  });

  it('is not in the future, which would be a claim about work not done', () => {
    // The direction that matters. A future date would assert a verification
    // that has not happened - the exact failure the null state existed to
    // prevent, arriving by a different route.
    const recorded = new Date(`${LAST_REGULATORY_REVIEW ?? ''}T00:00:00Z`).getTime();

    expect(recorded).toBeLessThanOrEqual(Date.now());
  });
});

describe('the notice while no review has happened', () => {
  it('renders the in-progress sentence, not a date', () => {
    expect(reviewNotice(null)).toBe(SHELL_COPY.reviewPending);
  });

  it('contains no digits at all', () => {
    // The assertion that actually protects the reader. A sentence carrying
    // any number could be misread as a date, and this is the one string on
    // the site where being misread is a credibility failure rather than a
    // usability one.
    expect(reviewNotice(null)).not.toMatch(/\d/);
  });
});

describe('the notice once a review is recorded', () => {
  const REVIEWED = '2026-04-29';

  it('renders the date through formatDate, never assembling one itself', () => {
    // formatDate gives Swiss dots (R28: an ISO day string, no Date, no zone).
    // A footer that formatted the date itself would be a second answer to
    // "how does this product write a date".
    expect(reviewNotice(REVIEWED)).toContain(formatDate(REVIEWED));
  });

  it('says what the date MEANS, not just the date', () => {
    // "29.04.2026" alone in a footer is ambiguous - published? updated?
    // reviewed? The sentence names the regulatory review.
    const notice = reviewNotice(REVIEWED);

    expect(notice).toBe(SHELL_COPY.reviewDone(formatDate(REVIEWED)));
    expect(notice.length).toBeGreaterThan(formatDate(REVIEWED).length);
  });

  it('is DIFFERENT from the pending notice', () => {
    // Guards the branch itself: a function returning the pending sentence for
    // every input would pass both blocks above except this one.
    expect(reviewNotice(REVIEWED)).not.toBe(reviewNotice(null));
  });

  it('rejects a value that is not an ISO day, rather than printing it', () => {
    // R28 makes the constant an ISO day string. Anything else reaching this
    // function is a mistake, and printing it would put an arbitrary string in
    // the place a reader trusts most. formatDate already validates by
    // round-tripping, so this asserts the failure is loud.
    expect(() => reviewNotice('29.04.2026')).toThrow();
    expect(() => reviewNotice('2026-02-30')).toThrow();
  });
});
