// web/tests/db/purge.test.ts
//
// FW14 increment 6: the thirty-day purge, and AC3's second half.
//
// /confidentialite, published since FW10: "Une inscription aux alertes qui
// reste non confirmée est supprimée au bout de 30 jours." That sentence is on
// a live page. Until this file existed it was a description of intent; a
// published privacy claim that nothing enforces is the one outcome this task
// may not produce.
//
// THE PROMPT ASKS FOR 29 AND 31 DAYS, and the reason that pair is the right
// test rather than "some old row" is that it brackets the boundary. A purge
// with the comparison inverted deletes the 29-day row and keeps the 31-day
// one, and both a "deletes old rows" test and a "keeps new rows" test can
// pass against it individually. Only the pair fails.
//
// THE JOB IS TESTED, NOT MERELY WRITTEN. FW12 found pnpm test:runtime had not
// run since FW10 - "a guard that hasn't run since FW10 is a guard we don't
// have" - and a retention script nobody executes is the same shape with a
// regulator on the other end. Scheduling belongs to FW27; this is the part
// that can be true today.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { describePurge, purgeUnconfirmed, PURGE_AFTER_DAYS } from '@/lib/alerts/purge';

const DAY = 24 * 60 * 60 * 1000;

const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY);

beforeEach(async () => {
  await prisma.alertSubscriber.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AC3: unconfirmed rows older than thirty days are purged', () => {
  it('is thirty days, the number the page states', () => {
    // The constant and the published sentence have to agree, and the only
    // way to keep them agreeing is to say so somewhere a change breaks.
    expect(PURGE_AFTER_DAYS).toBe(30);
  });

  it('removes the 31-day row and keeps the 29-day one', async () => {
    // THE BOUNDARY, BRACKETED. An inverted comparison passes "deletes old
    // rows" and passes "keeps recent rows" when each is tested alone.
    await prisma.alertSubscriber.createMany({
      data: [
        { email: 'jeune@example.com', source: 'calculateur', createdAt: daysAgo(29) },
        { email: 'vieille@example.com', source: 'calculateur', createdAt: daysAgo(31) },
      ],
    });

    const run = await purgeUnconfirmed();

    expect(run.deleted).toBe(1);
    // R244's other three, at the boundary where they are least ambiguous:
    // two rows looked at, one removed, one kept because it is too recent.
    expect(run.considered).toBe(2);
    expect(run.keptTooRecent).toBe(1);
    expect(run.keptUnsubscribed).toBe(0);

    const left = await prisma.alertSubscriber.findMany({ select: { email: true } });

    expect(left.map((row) => row.email)).toEqual(['jeune@example.com']);
  });

  it('never touches a CONFIRMED row, however old', async () => {
    // The rule is about unconfirmed subscriptions lapsing, not about
    // deleting subscribers. A purge that read the date alone would empty the
    // list every month.
    await prisma.alertSubscriber.create({
      data: {
        email: 'ancienne@example.com',
        source: 'calculateur',
        createdAt: daysAgo(400),
        confirmedAt: daysAgo(399),
      },
    });

    expect((await purgeUnconfirmed()).deleted).toBe(0);
    expect(await prisma.alertSubscriber.count()).toBe(1);
  });

  it('never touches an UNSUBSCRIBED row either', async () => {
    // An unsubscribed row is kept on purpose - it is what stops somebody
    // being re-subscribed by accident, and deleting it would lose that.
    await prisma.alertSubscriber.create({
      data: {
        email: 'partie@example.com',
        source: 'calculateur',
        createdAt: daysAgo(400),
        confirmedAt: daysAgo(399),
        unsubscribedAt: daysAgo(100),
      },
    });

    expect((await purgeUnconfirmed()).deleted).toBe(0);
    expect(await prisma.alertSubscriber.count()).toBe(1);
  });

  it('removes nothing when there is nothing to remove', async () => {
    // Non-vacuity in the other direction: a purge that always reported a
    // number would pass the boundary test by deleting everything.
    await prisma.alertSubscriber.create({
      data: { email: 'neuve@example.com', source: 'calculateur' },
    });

    expect((await purgeUnconfirmed()).deleted).toBe(0);
    expect(await prisma.alertSubscriber.count()).toBe(1);
  });

  it('purges several at once and reports how many', async () => {
    await prisma.alertSubscriber.createMany({
      data: [
        { email: 'a@example.com', source: 'calculateur', createdAt: daysAgo(45) },
        { email: 'b@example.com', source: 'alertes', createdAt: daysAgo(60) },
        { email: 'c@example.com', source: 'guide', createdAt: daysAgo(1) },
      ],
    });

    expect((await purgeUnconfirmed()).deleted).toBe(2);
    expect(await prisma.alertSubscriber.count()).toBe(1);
  });
});

describe('R244: the run says what it did, not that it ran', () => {
  it('distinguishes an empty match from a full set of exemptions', async () => {
    // "0 deleted" is true of a healthy list with nothing lapsed, and equally
    // true of a query that stopped matching anything. These four numbers are
    // not: every unconfirmed row is accounted for by exactly one of them.
    await prisma.alertSubscriber.createMany({
      data: [
        // Unconfirmed, past the cutoff, never unsubscribed: goes.
        { email: 'lapsed@example.com', source: 'calculateur', createdAt: daysAgo(31) },
        // Unconfirmed, past the cutoff, asked not to be written to: kept.
        {
          email: 'refused@example.com',
          source: 'calculateur',
          createdAt: daysAgo(31),
          unsubscribedAt: daysAgo(30),
        },
        // Unconfirmed, still inside its thirty days: kept.
        { email: 'recent@example.com', source: 'alertes', createdAt: daysAgo(29) },
        // Confirmed: not even considered, because the rule is about
        // subscriptions lapsing rather than about deleting subscribers.
        {
          email: 'member@example.com',
          source: 'guide',
          createdAt: daysAgo(400),
          confirmedAt: daysAgo(399),
        },
      ],
    });

    const run = await purgeUnconfirmed();

    expect(run.considered).toBe(3);
    expect(run.deleted).toBe(1);
    expect(run.keptUnsubscribed).toBe(1);
    expect(run.keptTooRecent).toBe(1);

    // AND THEY ADD UP. A census whose parts do not sum to its whole is a
    // census measuring something other than it says (R171's shape).
    expect(run.deleted + run.keptUnsubscribed + run.keptTooRecent).toBe(run.considered);
  });

  it('names the cutoff it used, so a wrong clock is visible in the log', async () => {
    const run = await purgeUnconfirmed(Date.parse('2026-07-07T12:00:00.000Z'));

    expect(run.cutoff).toBe('2026-06-07T12:00:00.000Z');
    expect(describePurge(run)).toContain('2026-06-07T12:00:00.000Z');
    expect(describePurge(run)).toContain('considered 0');
  });
});
