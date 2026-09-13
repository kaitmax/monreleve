// web/tests/db/subscribe-enumeration.test.ts
//
// FW14 increment 2, AC1 and the enumeration property.
//
// WHY THIS IS A SECURITY TEST AND NOT A POLISH ONE. If a new address produced
// "inscription enregistrée" and a known one produced "vous êtes déjà
// inscrit", then anybody could type an address into a public form and learn
// from the answer whether that person is on the list. On a list about
// cross-border tax compliance, MEMBERSHIP IS THE SENSITIVE FACT: it says
// something about where somebody works, and it says it to whoever asked.
//
// The property is therefore about what the four cases have IN COMMON, not
// about what the handler does internally. Internally they differ - a new row
// is created, an unconfirmed one gets a fresh token, a confirmed one is left
// alone, an unsubscribed one starts over - and every one of those is a
// different amount of work. What a caller can observe is one sentence.
//
// TIMING IS NOT ASSERTED HERE, and that is stated rather than left as a hole.
// A confirmed address does less work than a new one, so a determined attacker
// with a stopwatch and many samples could still distinguish them. Closing
// that means constant-time work on a public endpoint, which is a real cost
// for a real but much weaker attack. The rate limit in the same increment is
// what makes the sampling expensive. Raised in the report rather than
// silently ignored.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { recordSubscription } from '@/lib/alerts/record';

const EMAIL = 'frontalier@example.com';

beforeEach(async () => {
  await prisma.alertSubscriber.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** The four states an address can already be in when somebody subscribes. */
const arrange = {
  absent: async () => undefined,

  unconfirmed: async () => {
    await prisma.alertSubscriber.create({
      data: {
        email: EMAIL,
        source: 'calculateur',
        confirmationTokenHash: 'existing-hash',
        confirmationExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
  },

  confirmed: async () => {
    await prisma.alertSubscriber.create({
      data: { email: EMAIL, source: 'calculateur', confirmedAt: new Date() },
    });
  },

  unsubscribed: async () => {
    await prisma.alertSubscriber.create({
      data: {
        email: EMAIL,
        source: 'calculateur',
        confirmedAt: new Date(Date.now() - 86_400_000),
        unsubscribedAt: new Date(),
      },
    });
  },
};

const STATES = Object.keys(arrange) as (keyof typeof arrange)[];

describe('AC1: subscribing is idempotent and says the same thing every time', () => {
  it('covers all four states an address can be in', () => {
    // R63: without this the table could shrink to the case that passes.
    expect(STATES).toEqual(['absent', 'unconfirmed', 'confirmed', 'unsubscribed']);
  });

  it.each(STATES)('%s: never throws, and never leaves two rows', async (state) => {
    await arrange[state]();

    await expect(
      recordSubscription({ email: EMAIL, source: 'alertes' }),
    ).resolves.toBeDefined();

    expect(await prisma.alertSubscriber.count({ where: { email: EMAIL } })).toBe(1);
  });

  it('does not resurrect a confirmed row silently', async () => {
    // AC1 names this. A second subscribe on a CONFIRMED address must not
    // reset its consent date: that date is the record of when the reader
    // agreed, and moving it would make the record say they agreed today
    // because a stranger typed their address into a form.
    await arrange.confirmed();

    const before = await prisma.alertSubscriber.findUniqueOrThrow({
      where: { email: EMAIL },
    });

    await recordSubscription({ email: EMAIL, source: 'guide' });

    const after = await prisma.alertSubscriber.findUniqueOrThrow({
      where: { email: EMAIL },
    });

    expect(after.confirmedAt).toEqual(before.confirmedAt);
    expect(after.confirmationTokenHash).toBeNull();

    // And the source is not rewritten either: it records where this reader
    // actually joined, not where somebody last typed their address.
    expect(after.source).toBe('calculateur');
  });

  it('starts a fresh double opt-in after an unsubscribe', async () => {
    // The reader left and has come back. They are NOT on the list again
    // until they confirm - re-adding them directly would mean an unsubscribe
    // could be undone by anyone who knows the address.
    await arrange.unsubscribed();

    const outcome = await recordSubscription({ email: EMAIL, source: 'alertes' });

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(outcome.outcome).toBe('resubscribed');
    expect(row.unsubscribedAt).toBeNull();
    expect(row.confirmedAt).toBeNull();
    expect(row.confirmationTokenHash).not.toBeNull();
  });

  it('replaces the token of an unconfirmed row rather than keeping the old one', async () => {
    // The reader lost the first email, or it expired. A fresh token is a
    // fresh seven days; keeping the old one would mean the second attempt
    // silently did nothing.
    await arrange.unconfirmed();

    await recordSubscription({ email: EMAIL, source: 'alertes' });

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(row.confirmationTokenHash).not.toBe('existing-hash');
    expect(row.confirmationTokenHash).not.toBeNull();
  });
});

describe('the token is a capability, and is treated like one', () => {
  it('is returned in plaintext exactly once, and stored only as a hash', async () => {
    const outcome = await recordSubscription({ email: EMAIL, source: 'calculateur' });

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(outcome.token).toBeTypeOf('string');
    expect(String(outcome.token).length).toBeGreaterThanOrEqual(32);

    // THE POINT OF HASHING: the value in the database is not the value in
    // the link, so a database copy does not let anyone confirm an address
    // they do not control.
    expect(row.confirmationTokenHash).not.toBe(outcome.token);
    expect(row.confirmationTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives a different token every time', async () => {
    const first = await recordSubscription({ email: 'a@example.com', source: 'alertes' });
    const second = await recordSubscription({ email: 'b@example.com', source: 'alertes' });

    expect(first.token).not.toBe(second.token);
  });

  it('sets an expiry a week out, not never', async () => {
    await recordSubscription({ email: EMAIL, source: 'calculateur' });

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });
    const days = (Number(row.confirmationExpiresAt) - Date.now()) / 86_400_000;

    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('gives a confirmed row no token at all', async () => {
    // Nothing to confirm, so nothing that could be used to confirm it.
    await arrange.confirmed();

    const outcome = await recordSubscription({ email: EMAIL, source: 'alertes' });

    expect(outcome.outcome).toBe('already-confirmed');
    expect(outcome.token).toBeUndefined();
  });
});
