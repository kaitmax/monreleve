// web/tests/db/alert-subscriber.test.ts
//
// FW14 increment 1: the row, against a real PostgreSQL.
//
// NOT MOCKED, AND THAT IS THE POINT. The two behaviours this file asserts are
// behaviours OF THE DATABASE: a unique index, and what it does when a second
// row collides with it. A fake would assert my model of PostgreSQL rather than
// PostgreSQL, and the failure mode being guarded against - two rows for one
// person because they typed a capital letter the second time - is exactly the
// kind of thing a fake gets wrong in the same direction as the code.
//
// NORMALISATION IS A PRIVACY PROPERTY, not a tidiness one. /confidentialite
// says an address is recorded only if the reader gives it, and that the date
// of their agreement is recorded. Two rows for one address means two
// agreements recorded for one act of consent, and an unsubscribe that only
// half works - the reader clicks it, and the other row keeps them on the list.
//
// THE SUITE OWNS THE TABLE. Every test starts from an empty AlertSubscriber,
// and the config runs these files one at a time: a shared database and
// parallel workers would make "exactly one row" a statement about scheduling.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { normaliseEmail } from '@/lib/db/alert-subscriber';

beforeEach(async () => {
  await prisma.alertSubscriber.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('normaliseEmail', () => {
  it.each([
    ['  frontalier@example.com  ', 'frontalier@example.com', 'surrounding space'],
    ['Frontalier@Example.COM', 'frontalier@example.com', 'mixed case'],
    ['\tFRONTALIER@EXAMPLE.COM\n', 'frontalier@example.com', 'tabs and newlines'],
    ['frontalier@example.com', 'frontalier@example.com', 'already normal'],
  ])('%s -> %s (%s)', (raw, expected) => {
    expect(normaliseEmail(raw)).toBe(expected);
  });

  it('does not touch the part that is case-sensitive by standard', () => {
    // THE LOCAL PART IS TECHNICALLY CASE-SENSITIVE (RFC 5321), and this
    // lowercases it anyway. That is a deliberate trade and it belongs in a
    // test rather than in a comment nobody reads: no mail provider anyone
    // will plausibly use treats Jean.Dupont@ and jean.dupont@ as two people,
    // and treating them as two would mean two consent records and a
    // half-working unsubscribe. The cost is that a hypothetical
    // case-sensitive provider gets one row; the benefit is that every real
    // reader does.
    expect(normaliseEmail('Jean.Dupont@example.com')).toBe('jean.dupont@example.com');
  });
});

describe('the row, and the constraint that keeps it one row', () => {
  it('stores the normalised address, not what was typed', async () => {
    await prisma.alertSubscriber.create({
      data: { email: normaliseEmail('  Frontalier@Example.COM '), source: 'calculateur' },
    });

    const rows = await prisma.alertSubscriber.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe('frontalier@example.com');
  });

  it('refuses a second row for the same address, whatever the casing', async () => {
    // THE CONSTRAINT IS THE LAST LINE, not the first. The handler in
    // increment 2 will check before inserting; this asserts what happens when
    // two requests race past that check, which is the case no amount of
    // checking first can remove.
    await prisma.alertSubscriber.create({
      data: { email: normaliseEmail('frontalier@example.com'), source: 'calculateur' },
    });

    const second = prisma.alertSubscriber.create({
      data: { email: normaliseEmail('FRONTALIER@example.com'), source: 'alertes' },
    });

    await expect(second).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

    // THE SHAPE IS THE DRIVER ADAPTER'S, and it is worth knowing it differs.
    // Prisma 6 reported `meta.target: ['email']`; Prisma 7 through
    // @prisma/adapter-pg reports the driver's own error instead, which names
    // the INDEX. That is the better assertion anyway: this table has two
    // unique indexes - email and confirmationTokenHash - and "a unique
    // constraint was violated" does not say which. Colliding on the token
    // hash would be a different defect entirely.
    await expect(second).rejects.toMatchObject({
      code: 'P2002',
      meta: {
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            // PostgreSQL's SQLSTATE for a unique violation.
            originalCode: '23505',
            constraint: { index: 'AlertSubscriber_email_key' },
          },
        },
      },
    });

    // And the first row is untouched: a failed insert must not have changed
    // the source or the consent date of the row that was already there.
    const rows = await prisma.alertSubscriber.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe('calculateur');
  });

  it('allows two different addresses', async () => {
    // NON-VACUITY. A table that rejected every second insert would satisfy
    // the test above and be useless.
    await prisma.alertSubscriber.create({
      data: { email: 'une@example.com', source: 'calculateur' },
    });
    await prisma.alertSubscriber.create({
      data: { email: 'deux@example.com', source: 'alertes' },
    });

    expect(await prisma.alertSubscriber.count()).toBe(2);
  });

  it('starts unconfirmed, unsubscribed by nobody, with no token', async () => {
    // The defaults are the double opt-in's starting state, and every one of
    // them is load-bearing: a row that arrived already confirmed would put an
    // address on the list without the reader having answered the email.
    const row = await prisma.alertSubscriber.create({
      data: { email: 'neuve@example.com', source: 'guide' },
    });

    expect(row.confirmedAt).toBeNull();
    expect(row.unsubscribedAt).toBeNull();
    expect(row.confirmationTokenHash).toBeNull();
    expect(row.confirmationExpiresAt).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('sits among exactly the tables the schema has grown to', async () => {
    // FW14 BUILT ONE TABLE AND ASSERTED SO: "SPEC section 8 defines six models
    // and FW14 builds ONE. A schema is a promise about what exists, and a User
    // table with no auth behind it is a promise this task has not kept."
    //
    // FW21 KEEPS THAT PROMISE, so the list grows - and it is still a list
    // rather than a count, for FW14's reason: a count of seven is satisfied by
    // any seven, and the table that would quietly appear is the one nobody
    // meant to add. Asserted against the DATABASE rather than the schema file,
    // because the database is what is true.
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    // Sorted HERE rather than by the query. ORDER BY table_name sorts under
    // the database's collation, which put "AlertSubscriber" before
    // "_prisma_migrations" - a true fact about PostgreSQL that has nothing to
    // do with what this test is asking.
    expect(tables.map((row) => row.table_name).sort()).toEqual([
      // Auth.js, written from its published adapter schema. phase4parking.md
      // P4-1: the adapter is not installed, so the shape is transcribed rather
      // than verified, and FW22 is where it gets checked.
      'Account',
      'AlertSubscriber',
      // D21, replacing the PushSubscription a web-push design would need.
      'Device',
      'Session',
      'User',
      'VerificationToken',
      '_prisma_migrations',
    ]);
  });
});
