// web/tests/db/rappel-delai-schema.test.ts
//
// FW-DELAI-RAPPEL, R914: the DeadlineReminder record's invariants, asserted
// against the database that is supposed to enforce them (R196).
//
// BOTH DIRECTIONS, BY CONSTRAINT NAME - schema-constraints.test.ts's rule. A
// constraint that refused every row would pass every "is refused" case here;
// the accepted rows are what tell a correct constraint from a locked table,
// and the name is the only evidence that the rule under test is the one that
// fired.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { prisma } from '@/lib/db/client';
import { toStoredDay } from '@/lib/entries/day';
import { MAX_MONTHS_AHEAD, latestDeadline, shiftDays } from '@/lib/rappel/window';

/** Run a write that must fail, and hand back what PostgreSQL said. */
async function rejection(write: Promise<unknown>): Promise<string> {
  try {
    await write;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error('the write was ACCEPTED, and this test exists because it must not be');
}

const DAY = new Date(Date.UTC(2027, 1, 28));
const HOUR_MS = 60 * 60 * 1000;

let seq = 0;

/** A legal pending row's fields; each case overrides what it is about. */
function pending(overrides: Record<string, unknown> = {}): {
  email: string;
  deadline: Date;
  confirmationTokenHash: string | null;
  confirmationExpiresAt: Date | null;
  confirmedAt: Date | null;
  deleteTokenHashes: string[];
} {
  seq += 1;

  return {
    email: `rappel-${seq}@monreleve.test`,
    deadline: DAY,
    confirmationTokenHash: `${'c'.repeat(60)}${String(seq).padStart(4, '0')}`,
    confirmationExpiresAt: new Date(Date.now() + HOUR_MS),
    confirmedAt: null,
    deleteTokenHashes: [`${'d'.repeat(60)}${String(seq).padStart(4, '0')}`],
    ...overrides,
  };
}

beforeEach(async () => {
  await prisma.deadlineReminder.deleteMany();
});

afterAll(async () => {
  await prisma.deadlineReminder.deleteMany();
  await prisma.$disconnect();
});

describe('a row is awaiting confirmation or confirmed - never both, never neither', () => {
  it('refuses a confirmed row that still carries a live confirmation token', async () => {
    const message = await rejection(
      prisma.deadlineReminder.create({ data: pending({ confirmedAt: new Date() }) }),
    );

    expect(message).toContain('DeadlineReminder_pending_xor_confirmed');
  });

  it('refuses a row with neither a token nor a confirmation', async () => {
    const message = await rejection(
      prisma.deadlineReminder.create({
        data: pending({ confirmationTokenHash: null, confirmationExpiresAt: null }),
      }),
    );

    expect(message).toContain('DeadlineReminder_pending_xor_confirmed');
  });

  it('accepts a pending row, and a confirmed one', async () => {
    const waiting = await prisma.deadlineReminder.create({ data: pending() });
    const confirmed = await prisma.deadlineReminder.create({
      data: pending({ confirmationTokenHash: null, confirmationExpiresAt: null, confirmedAt: new Date() }),
    });

    expect(waiting.confirmedAt).toBeNull();
    expect(confirmed.confirmationTokenHash).toBeNull();
    expect(await prisma.deadlineReminder.count()).toBe(2);
  });
});

describe('a confirmation token and its expiry come together', () => {
  it('refuses a token with no expiry', async () => {
    const message = await rejection(
      prisma.deadlineReminder.create({ data: pending({ confirmationExpiresAt: null }) }),
    );

    expect(message).toContain('DeadlineReminder_token_expiry_pair');
  });

  it('refuses an expiry with no token, on a confirmed row', async () => {
    const message = await rejection(
      prisma.deadlineReminder.create({
        data: pending({ confirmationTokenHash: null, confirmedAt: new Date() }),
      }),
    );

    expect(message).toContain('DeadlineReminder_token_expiry_pair');
  });

  it('accepts both together, and neither on a confirmed row', async () => {
    await prisma.deadlineReminder.create({ data: pending() });
    await prisma.deadlineReminder.create({
      data: pending({ confirmationTokenHash: null, confirmationExpiresAt: null, confirmedAt: new Date() }),
    });

    expect(await prisma.deadlineReminder.count()).toBe(2);
  });
});

describe('the address is stored normalised, so "one address, one reminder" holds', () => {
  it.each([
    ['Rappel@Monreleve.test', 'capitals'],
    [' rappel@monreleve.test', 'a leading space'],
    ['rappel@monreleve.test ', 'a trailing space'],
    ['rappel.monreleve.test', 'no at-sign'],
    ['', 'nothing'],
  ])('refuses %j (%s)', async (email) => {
    const message = await rejection(prisma.deadlineReminder.create({ data: pending({ email }) }));

    expect(message).toContain('DeadlineReminder_email_normalised');
  });

  it('accepts a lowercased, trimmed address', async () => {
    const row = await prisma.deadlineReminder.create({
      data: pending({ email: 'rappel.normal@monreleve.test' }),
    });

    expect(row.email).toBe('rappel.normal@monreleve.test');
  });

  it('refuses the same address twice, by the unique index', async () => {
    await prisma.deadlineReminder.create({ data: pending({ email: 'twice@monreleve.test' }) });

    const message = await rejection(
      prisma.deadlineReminder.create({ data: pending({ email: 'twice@monreleve.test' }) }),
    );

    // Prisma reports a unique violation by its fields, not the index name.
    expect(message).toMatch(/Unique constraint failed|DeadlineReminder_email_key/u);
    expect(message).toContain('email');
  });
});

describe('R1003: every delete link a message carried is kept, and there is always at least one', () => {
  it('refuses a row with no delete link at all', async () => {
    const message = await rejection(prisma.deadlineReminder.create({ data: pending({ deleteTokenHashes: [] }) }));

    expect(message).toContain('DeadlineReminder_delete_link');
  });

  it('refuses a row whose list of links is NULL - written past the client, as another writer might', async () => {
    const row = await prisma.deadlineReminder.create({ data: pending() });
    const message = await rejection(
      prisma.$executeRaw`UPDATE "DeadlineReminder" SET "deleteTokenHashes" = NULL WHERE "id" = ${row.id}`,
    );

    expect(message).toContain('DeadlineReminder_delete_link');
  });

  it('accepts one link, and several', async () => {
    await prisma.deadlineReminder.create({ data: pending() });
    await prisma.deadlineReminder.create({ data: pending({ deleteTokenHashes: ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)] }) });

    expect(await prisma.deadlineReminder.count()).toBe(2);
  });
});

describe(`R1004: the date is at most ${MAX_MONTHS_AHEAD} months after the day the row is written`, () => {
  /**
   * The DATABASE's today in Paris - the day its bound is measured from - read
   * from the database rather than from this process (R171: the role).
   */
  async function databaseToday(): Promise<string> {
    const [row] = await prisma.$queryRaw<{ today: string }[]>`
      SELECT to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') AS today`;

    return row?.today ?? '';
  }

  it('accepts the bound itself, computed by lib/rappel/window.ts from the database\'s today', async () => {
    const latest = latestDeadline(await databaseToday()) ?? '';

    await prisma.deadlineReminder.create({ data: pending({ deadline: toStoredDay(latest) }) });

    expect(await prisma.deadlineReminder.count()).toBe(1);
  });

  it('refuses the day after the bound, by name', async () => {
    const beyond = shiftDays(latestDeadline(await databaseToday()) ?? '', 1) ?? '';
    const message = await rejection(prisma.deadlineReminder.create({ data: pending({ deadline: toStoredDay(beyond) }) }));

    expect(message).toContain('DeadlineReminder_deadline_bound');
  });

  it('states the figure the constant states: the migration is read, never retyped here (R181)', () => {
    const migration = readFileSync(
      'prisma/migrations/20261112120000_deadline_reminder/migration.sql',
      'utf8',
    );
    const check = /ADD CONSTRAINT "DeadlineReminder_deadline_bound"\s+CHECK \(([^;]+)\);/u.exec(migration)?.[1] ?? '';

    expect(check, 'the bound constraint is not in the migration').not.toBe('');
    expect(check).toContain(`INTERVAL '${MAX_MONTHS_AHEAD} months'`);
    expect(check.match(/INTERVAL '\d+ months'/gu)).toHaveLength(1);
  });
});

describe('the table holds what the notice says and nothing else', () => {
  it('has exactly the columns R914 names', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'DeadlineReminder' ORDER BY column_name`;

    expect(columns.map((column) => column.column_name)).toEqual([
      'confirmationExpiresAt',
      'confirmationTokenHash',
      'confirmedAt',
      'createdAt',
      'deadline',
      'deleteTokenHashes',
      'email',
      'id',
    ]);
  });

  it('stores the date as a calendar day, not an instant', async () => {
    const [column] = await prisma.$queryRaw<{ data_type: string }[]>`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'DeadlineReminder' AND column_name = 'deadline'`;

    expect(column?.data_type).toBe('date');
  });
});
