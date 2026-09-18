// web/tests/db/fw14-era-migration.test.ts
//
// FW21 / AC1, second half: the migration applies to a database that already
// carries live FW14 rows, and every one of them survives intact.
//
// AN EMPTY DATABASE PROVES ALMOST NOTHING HERE. Every migration applies
// cleanly to nothing - the interesting question is what happens to the rows
// that are already there, and the alert list is live: /confidentialite
// publishes what is kept about a subscriber and for how long, so a migration
// that dropped a confirmedAt would break a published promise rather than lose
// a column.
//
// IT BUILDS A REAL FW14-ERA DATABASE rather than mocking one. A scratch
// database is created, FW14's two migration files are applied to it verbatim,
// their bookkeeping rows are written exactly as Prisma writes them, subscriber
// rows are inserted in every state the table can hold - and only then is
// `prisma migrate deploy` run against it, which is the same command CI and
// production use. Nothing about the sequence is simulated.
//
// THE ROWS ARE COMPARED FIELD BY FIELD, BEFORE AND AFTER. Counting them would
// be satisfied by a migration that kept every row and cleared every timestamp,
// which is precisely the failure that matters: an unsubscribedAt silently
// nulled is a person who asked to be removed and is back on the list.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

/** FW14's two migrations, in the order Prisma applied them. */
const FW14_MIGRATIONS = [
  '20260913075645_alert_subscriber',
  '20260913120000_unsubscribe_token',
] as const;

const SCRATCH_DATABASE = 'frontalier_fw14_era_probe';

/**
 * Every state an AlertSubscriber row can be in, because the one that gets
 * lost is never the ordinary one.
 *
 * `unsubscribedAt` on a confirmed row is the case with a person behind it:
 * somebody who agreed, then changed their mind. A migration that cleared it
 * would put them back on the list, and nothing would look wrong.
 */
const SUBSCRIBERS = [
  {
    id: 'fw14-confirmed',
    email: 'confirme@example.com',
    source: 'calculateur',
    confirmedAt: new Date('2026-09-14T08:15:00Z'),
    unsubscribedAt: null,
  },
  {
    id: 'fw14-unconfirmed',
    email: 'en-attente@example.com',
    source: 'alertes',
    confirmedAt: null,
    unsubscribedAt: null,
  },
  {
    id: 'fw14-unsubscribed',
    email: 'parti@example.com',
    source: 'guide',
    confirmedAt: new Date('2026-09-14T09:00:00Z'),
    unsubscribedAt: new Date('2026-09-15T11:30:00Z'),
  },
  {
    id: 'fw14-never-confirmed-left',
    email: 'jamais@example.com',
    source: 'comparateur',
    confirmedAt: null,
    unsubscribedAt: new Date('2026-09-16T07:45:00Z'),
  },
] as const;

type Row = {
  id: string;
  email: string;
  source: string;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
  confirmationTokenHash: string | null;
  unsubscribeTokenHash: string | null;
};

function adminUrl(): string {
  const url = process.env.DATABASE_URL;

  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set; this suite needs the local PostgreSQL from docker compose.');
  }

  return url;
}

/** The same server, a different database. */
function scratchUrl(): string {
  const url = new URL(adminUrl());

  url.pathname = `/${SCRATCH_DATABASE}`;

  return url.toString();
}

async function withClient<T>(connectionString: string, use: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });

  await client.connect();

  try {
    return await use(client);
  } finally {
    await client.end();
  }
}

async function readSubscribers(connectionString: string): Promise<Row[]> {
  return withClient(connectionString, async (client) => {
    const { rows } = await client.query<Row>(`
      SELECT "id", "email", "source", "confirmedAt", "unsubscribedAt", "createdAt",
             "confirmationTokenHash", "unsubscribeTokenHash"
      FROM "AlertSubscriber"
      ORDER BY "id"
    `);

    return rows;
  });
}

let before: Row[] = [];
let after: Row[] = [];
let deployOutput = '';

beforeAll(async () => {
  // A leftover probe database from an interrupted run would be applied to
  // twice, so it is dropped first rather than reused. Reuse is exactly how a
  // migration test comes to assert against a database nobody built.
  await withClient(adminUrl(), async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${SCRATCH_DATABASE}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${SCRATCH_DATABASE}"`);
  });

  await withClient(scratchUrl(), async (client) => {
    // Prisma's own bookkeeping table, created exactly as the CLI creates it,
    // so that `migrate deploy` below sees FW14's two migrations as applied and
    // has only FW21's to do. Without it the CLI would replay everything and
    // the test would prove nothing about existing rows.
    await client.query(`
      CREATE TABLE "_prisma_migrations" (
        id                      VARCHAR(36) PRIMARY KEY NOT NULL,
        checksum                VARCHAR(64) NOT NULL,
        finished_at             TIMESTAMPTZ,
        migration_name          VARCHAR(255) NOT NULL,
        logs                    TEXT,
        rolled_back_at          TIMESTAMPTZ,
        started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
        applied_steps_count     INTEGER NOT NULL DEFAULT 0
      )
    `);

    for (const name of FW14_MIGRATIONS) {
      const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');

      await client.query(sql);

      // The checksum is the sha256 of the file, which is what the CLI records
      // and what it re-checks on the next run. A wrong one here would make the
      // deploy below fail on drift instead of migrating - a green-looking
      // failure of the wrong thing.
      const checksum = execFileSync(process.execPath, [
        '-e',
        `process.stdout.write(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(process.argv[1])).digest('hex'))`,
        `prisma/migrations/${name}/migration.sql`,
      ]).toString();

      await client.query(
        `INSERT INTO "_prisma_migrations"
           (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES ($1, $2, now(), $3, NULL, NULL, now(), 1)`,
        [randomUUID(), checksum, name],
      );
    }

    for (const subscriber of SUBSCRIBERS) {
      await client.query(
        `INSERT INTO "AlertSubscriber"
           ("id", "email", "source", "confirmedAt", "unsubscribedAt", "createdAt")
         VALUES ($1, $2, $3, $4, $5, '2026-09-13T12:00:00Z')`,
        [
          subscriber.id,
          subscriber.email,
          subscriber.source,
          subscriber.confirmedAt,
          subscriber.unsubscribedAt,
        ],
      );
    }
  });

  before = await readSubscribers(scratchUrl());

  // THE ACTUAL TEST: the command CI and production run, against a database
  // that was FW14 a moment ago.
  deployOutput = execFileSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: { ...process.env, DATABASE_URL: scratchUrl() }, encoding: 'utf8' },
  );

  after = await readSubscribers(scratchUrl());
}, 120_000);

afterAll(async () => {
  await withClient(adminUrl(), async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${SCRATCH_DATABASE}" WITH (FORCE)`);
  });
});

describe('the FW21 migration on an FW14-era database', () => {
  it('applies EVERY pending migration, and no others', () => {
    // DERIVED FROM THE DIRECTORY, NEVER TYPED, and this test is why the rule
    // matters. It used to name three migrations by hand:
    //
    //   20260918003225_user_device_auth
    //   20260918075246_entry_provenance_mutation_id
    //   20260918080540_entry_event_append_only
    //
    // By FW23 there were SIX on disk. FW22's device_session_tokens was never
    // added to that list, so the "and no others" half of the title had never
    // been asserted at all - and the next migration would have slid past in
    // green for exactly the same reason. R175: the space between "these three
    // were applied" and "FW14's two were not" held every migration written
    // since, unexamined.
    //
    // Reading the directory closes it permanently: a migration added tomorrow
    // is covered the moment it exists, without anyone remembering to come
    // here. R171 - a test names a role, never a coincidence.
    const onDisk = readdirSync('prisma/migrations')
      .filter((name) => /^\d{14}_/u.test(name))
      .sort();

    const expected = onDisk.filter(
      (name) => !(FW14_MIGRATIONS as readonly string[]).includes(name),
    );

    // NON-VACUITY FIRST. "every pending migration was applied" is satisfied by
    // there being none, which is what a changed path or a renamed directory
    // would produce.
    expect(onDisk.length).toBeGreaterThan(FW14_MIGRATIONS.length);
    expect(expected.length).toBeGreaterThan(0);

    for (const name of expected) {
      expect(deployOutput, `${name} should have been applied`).toContain(name);
    }

    // FW14's two were already recorded as applied, so the CLI must not have
    // touched them. If it did, the fixture was wrong and everything below is
    // asserting against a database this test built twice.
    for (const name of FW14_MIGRATIONS) {
      expect(deployOutput).not.toContain(`Applying migration \`${name}\``);
    }
  });

  it('leaves every subscriber row byte for byte as it was', () => {
    // FIELD BY FIELD, NOT A COUNT. A migration that kept four rows and
    // cleared their timestamps would pass a count and would put somebody who
    // unsubscribed back on the list.
    expect(before).toHaveLength(SUBSCRIBERS.length);
    expect(after).toEqual(before);
  });

  it('keeps confirmedAt and unsubscribedAt exactly, including the nulls', () => {
    // THE NULLS ARE HALF THE CLAIM. /confidentialite says an unconfirmed row
    // is purged after 30 days, and the purge selects on confirmedAt IS NULL.
    // A migration that backfilled those nulls with a timestamp would make
    // four unconfirmed addresses permanent - silently, and in the direction
    // that keeps data rather than loses it, which is the direction nobody
    // notices.
    for (const expected of SUBSCRIBERS) {
      const row = after.find((candidate) => candidate.id === expected.id);

      expect(row, `row ${expected.id} survived`).toBeDefined();
      expect(row?.email).toBe(expected.email);
      expect(row?.source).toBe(expected.source);
      expect(row?.confirmedAt?.toISOString() ?? null).toBe(
        expected.confirmedAt === null ? null : expected.confirmedAt.toISOString(),
      );
      expect(row?.unsubscribedAt?.toISOString() ?? null).toBe(
        expected.unsubscribedAt === null ? null : expected.unsubscribedAt.toISOString(),
      );
    }
  });

  it('leaves the FW14 indexes that the privacy claims depend on', async () => {
    // The purge scans (confirmedAt, createdAt); the confirm and unsubscribe
    // routes look a row up by its token hash. Those three indexes are what
    // make FW14's published retention promise something the database can
    // actually deliver rather than a statement about intent.
    const indexes = await withClient(scratchUrl(), async (client) => {
      const { rows } = await client.query<{ indexname: string }>(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'AlertSubscriber'
        ORDER BY indexname
      `);

      return rows.map((row) => row.indexname);
    });

    expect(indexes).toEqual([
      'AlertSubscriber_confirmationTokenHash_key',
      'AlertSubscriber_confirmedAt_createdAt_idx',
      'AlertSubscriber_email_key',
      'AlertSubscriber_pkey',
      'AlertSubscriber_unsubscribeTokenHash_key',
    ]);
  });

  it('adds the FW21 tables alongside, not instead', async () => {
    const tables = await withClient(scratchUrl(), async (client) => {
      const { rows } = await client.query<{ table_name: string }>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name
      `);

      return rows.map((row) => row.table_name);
    });

    expect(tables).toEqual([
      'Account',
      'AlertSubscriber',
      'Device',
      'DeviceSession',
      'Entry',
      'EntryEvent',
      'Session',
      'SessionToken',
      'User',
      'VerificationToken',
      '_prisma_migrations',
    ]);
  });

  it('brings the triggers and check constraints with it', async () => {
    // A migration can create every table and still arrive without the part
    // that is hand-written below Prisma's output - which is the part AC2
    // rests on. This asks the migrated database directly, so a future
    // migration that recreated a table without its trigger would be caught
    // here rather than by an audit.
    const { triggers, checks } = await withClient(scratchUrl(), async (client) => {
      const t = await client.query<{ tgname: string }>(
        `SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`,
      );
      const c = await client.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint
         WHERE contype = 'c' AND connamespace = 'public'::regnamespace
         ORDER BY conname`,
      );

      return { triggers: t.rows.map((row) => row.tgname), checks: c.rows.map((row) => row.conname) };
    });

    expect(triggers).toEqual([
      'entry_event_no_delete',
      'entry_event_no_update',
      'entry_first_recorded_at_immutable',
    ]);

    expect(checks).toEqual([
      'DeviceSession_revoked_pair',
      'Entry_absenceReason_iff_absent',
      'Entry_detectedKind_when_detected',
      'SessionToken_consumed_after_created',
      'User_employmentRate_range',
      'User_exactTotalWorkDays_iff_exact',
    ]);
  });

  // RUNS LAST, AND DAMAGES THE SCRATCH DATABASE ON PURPOSE.
  //
  // Every assertion above is of the form "nothing changed", and an assertion
  // of that shape is satisfied by an instrument that cannot see change at
  // all. If readSubscribers returned the same thing regardless - a query
  // against the wrong database, a deploy that silently did nothing, an empty
  // result compared to an empty result - the whole file would be green and
  // would mean nothing.
  //
  // So the last thing it does is inflict exactly the failure it is here to
  // catch: clear one unsubscribedAt, the field with a person behind it, and
  // require the comparison to notice. The database is dropped immediately
  // afterwards.
  it('would notice if a migration had cleared a timestamp', async () => {
    await withClient(scratchUrl(), async (client) => {
      await client.query(`UPDATE "AlertSubscriber" SET "unsubscribedAt" = NULL WHERE "id" = $1`, [
        'fw14-unsubscribed',
      ]);
    });

    const damaged = await readSubscribers(scratchUrl());

    expect(damaged).not.toEqual(before);
    expect(damaged.find((row) => row.id === 'fw14-unsubscribed')?.unsubscribedAt).toBeNull();
    expect(before.find((row) => row.id === 'fw14-unsubscribed')?.unsubscribedAt).not.toBeNull();
  });
});
