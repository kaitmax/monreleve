// web/tests/db/schema-shape.test.ts
//
// What the migrations PRODUCED, read back from the database.
//
// ============================================================================
// A MIGRATION THAT EXITED 0 IS A CLAIM ABOUT A COMMAND
// ============================================================================
//
// `prisma migrate deploy` succeeding says the files ran. It does not say the
// schema is the one they describe: a DROP that silently found nothing, an index
// created under a name nothing looks for, a column added to the wrong table -
// each exits 0. The distinction is the one R177 draws between counting `<link>`
// tags and fetching the stylesheet.
//
// So this file asks the DATABASE. It runs in tests/db, after `db:deploy`, which
// is the only moment the answer means anything (R182).
//
// IT IS AN ASSERTED CENSUS, NOT A SPOT CHECK (R206's corollary). The index sets
// are compared whole, so an index added next year is a deliberate edit here
// rather than an arrival nobody noticed - and, more importantly, an index
// REMOVED cannot pass by simply not being looked for.

import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';

async function indexesOn(table: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
    `SELECT indexname FROM pg_indexes WHERE tablename = $1 AND schemaname = current_schema() ORDER BY indexname`,
    table,
  );

  return rows.map((row) => row.indexname);
}

async function columnsOn(table: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = current_schema() ORDER BY column_name`,
    table,
  );

  return rows.map((row) => row.column_name);
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the migrations produced the schema they describe', () => {
  it('found a database at all, so nothing below passes vacuously', async () => {
    // R133 / R169's corollary. Every assertion in this file is about a set;
    // an empty database returns empty sets, and "the dropped index is absent"
    // is satisfied by a table that does not exist.
    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`,
    );

    expect(tables.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(['Entry', 'EntryEvent', 'User']),
    );
  });

  it('gave Entry exactly the indexes the migrations describe', async () => {
    expect(await indexesOn('Entry')).toEqual([
      'Entry_pkey',
      // R220. The composite replaced a GLOBAL unique on clientMutationId.
      'Entry_userId_clientMutationId_key',
      'Entry_userId_dayDate_idx',
      'Entry_userId_dayDate_portion_key',
    ]);
  });

  it('DROPPED the global unique, which an exit code cannot tell you', async () => {
    // THE ASSERTION THIS FILE EXISTS FOR. The equality above already implies
    // it, and stating it separately is deliberate: the equality fails for many
    // reasons and this one names the reason that matters. R220's migration is
    // a DROP followed by a CREATE, and a DROP that found nothing to drop exits
    // 0 exactly like one that worked.
    //
    // While this index existed, a second account reusing a client-generated id
    // was refused 409 because a stranger had used it first.
    expect(await indexesOn('Entry')).not.toContain('Entry_clientMutationId_key');
  });

  it('gave EntryEvent the column and index R219 added', async () => {
    expect(await columnsOn('EntryEvent')).toContain('clientMutationId');
    expect(await indexesOn('EntryEvent')).toEqual([
      'EntryEvent_entryId_recordedAt_idx',
      'EntryEvent_pkey',
      // R219. The duplicate lookup, scoped to the account.
      'EntryEvent_userId_clientMutationId_idx',
      'EntryEvent_userId_entryId_idx',
    ]);
  });

  it('left EntryEvent.clientMutationId NULLABLE, which the backfill story needs', async () => {
    // NOT COSMETIC. R219 cannot backfill this column: the id on a legacy
    // event's Entry is the LAST write's rather than the one that created it,
    // so filling it in would write a falsehood into an append-only table. A
    // migration that made it NOT NULL would have to invent values, and the
    // write path's Entry fallback exists precisely for the rows that have none.
    const rows = await prisma.$queryRawUnsafe<Array<{ is_nullable: string }>>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_name = 'EntryEvent' AND column_name = 'clientMutationId'
         AND table_schema = current_schema()`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.is_nullable).toBe('YES');
  });

  it('kept the append-only triggers the trail rests on', async () => {
    // The whole R219 fix rests on EntryEvent being append-only: a trail a
    // later write could edit would be no better than the row it replaced.
    const rows = await prisma.$queryRawUnsafe<Array<{ tgname: string }>>(
      `SELECT tgname FROM pg_trigger
       WHERE tgrelid = '"EntryEvent"'::regclass AND NOT tgisinternal
       ORDER BY tgname`,
    );

    expect(rows.map((row) => row.tgname)).toEqual([
      'entry_event_no_delete',
      'entry_event_no_update',
    ]);
  });
});
