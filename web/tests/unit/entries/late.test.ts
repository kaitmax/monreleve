// web/tests/unit/entries/late.test.ts
//
// SPEC 11.3's backfill threshold, in its one home. FW24 increment 4.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LATE_BACKFILL_DAYS, isLate, latenessInDays } from '@/lib/entries/late';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string): Date => new Date(iso);

describe('the threshold has one home', () => {
  it('is seven days, read from the constant rather than typed here', () => {
    // R181: a test that typed 7 beside the rule would be a second copy of it.
    // This asserts the CONSTANT is what the spec says, and everything below
    // computes from it.
    expect(LATE_BACKFILL_DAYS).toBe(7);
  });
});

describe('beyond seven days, not at seven', () => {
  // THE BOUNDARY IS THE POINT. SPEC 11.3 says "beyond 7 days". Written as `>=`
  // this would flag somebody catching up on the following Monday, which is the
  // ordinary case rather than the exceptional one - and the flag appears in a
  // legal document, so flagging the ordinary case devalues it everywhere.

  it('does not flag a day recorded exactly seven days later', () => {
    expect(isLate(day('2026-04-07'), at('2026-04-14T00:00:00.000Z'))).toBe(false);
  });

  it('flags the moment it passes seven days', () => {
    expect(isLate(day('2026-04-07'), at('2026-04-14T00:00:00.001Z'))).toBe(true);
  });

  it('does not flag the same evening', () => {
    expect(isLate(day('2026-04-07'), at('2026-04-07T18:44:02.000Z'))).toBe(false);
  });

  it('flags a genuine backfill', () => {
    expect(isLate(day('2026-02-10'), at('2026-03-05T09:41:00.000Z'))).toBe(true);
  });
});

describe('it reads the SERVER clock, never the client claim', () => {
  it('takes firstRecordedAt, which a client cannot backdate', () => {
    // SPEC 8 forbids treating clientClaimedAt as evidence. If lateness read it,
    // a client that backdated its own claim would clear its own flag - which is
    // the one thing the flag exists to prevent.
    //
    // The signature is the assertion: there is no parameter for a client
    // timestamp, so there is nothing to pass and nothing to get wrong.
    expect(isLate.length).toBe(2);
  });
});

describe('how late, for copy that wants to say it', () => {
  it('counts whole days from the start of the stored day', () => {
    expect(latenessInDays(day('2026-04-07'), at('2026-04-14T12:00:00.000Z'))).toBe(7);
    expect(latenessInDays(day('2026-04-07'), at('2026-04-07T23:59:59.000Z'))).toBe(0);
  });

  it('never disagrees with isLate about which side of the line a day is on', () => {
    // THE FIRST VERSION OF THIS TEST RE-DERIVED THE RULE to check it, which is
    // the defect it was written to prevent: a test that restates the threshold
    // is a second copy of it and passes when both copies are wrong together.
    //
    // So it asserts a RELATION between the two functions instead, with no 7 in
    // sight. A flagged day is at least a week old; a day more than a week old
    // is flagged. Neither sentence needs to know what the week is.
    for (const hours of [0, 1, 24, 167, 168, 169, 500, 5000]) {
      const recorded = new Date(Date.UTC(2026, 3, 7) + hours * 3600_000);
      const flagged = isLate(day('2026-04-07'), recorded);
      const days = latenessInDays(day('2026-04-07'), recorded);

      if (flagged) {
        expect(days, `flagged at ${hours}h but reported ${days} days`).toBeGreaterThanOrEqual(
          LATE_BACKFILL_DAYS,
        );
      }

      if (days > LATE_BACKFILL_DAYS) {
        expect(flagged, `${days} days old and not flagged`).toBe(true);
      }
    }
  });
});

describe('a day that has not happened (R413)', () => {
  // THIS SUITE DOES NOT ASSERT A FIX. It records that the arithmetic goes
  // negative, and that the input is kept away from it at the door - so that a
  // later reader who notices the negative case does not "repair" it here and
  // quietly remove the need for the server rule.

  // KMP-2's own fixture: a phone at 00:15 Paris wrote 2026-10-20 while the
  // server clock read 2026-10-19T14:30Z. Not invented for this test (R171).
  const notYetHappened = day('2026-10-20');
  const serverSawItFirst = at('2026-10-19T14:30:18.246Z');

  it('reads as on time, which is why it must never arrive', () => {
    expect(isLate(notYetHappened, serverSawItFirst)).toBe(false);
    expect(latenessInDays(notYetHappened, serverSawItFirst)).toBeLessThan(0);
  });

  it('is unreachable because the write path refuses it - and fails here if that stops being true', () => {
    // A SOURCE SCAN, deliberately, and not a second behavioural test. The
    // behaviour is proven where it lives, through the route handler, in
    // tests/db/entries-route.test.ts (R204). What is unguarded without this is
    // the LINK: delete the rule from the route and that suite's own tests go
    // with it, leaving this module's negative case reachable and nothing
    // saying so.
    const route = readFileSync(
      join(process.cwd(), 'app/api/v1/entries/route.ts'),
      'utf8',
    );

    expect(route).toContain("refuse('future_day'");
    expect(route).toContain('parisDayOf');
  });
});
