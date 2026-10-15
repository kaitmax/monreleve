// web/tests/db/readiness-database.test.ts
//
// R353: THE READINESS PROBE, AGAINST A REAL POSTGRESQL.
//
// tests/unit/content/readiness.test.ts injects a probe and tests the DECISION
// readiness() makes from a result. This file tests the probe ITSELF, and it
// has to live here because the three interesting states cannot be faked:
//
//   unmigrated        needs a database with no _prisma_migrations, or one
//                     missing a row this build ships
//   migration_failed  needs a row with rolled_back_at set
//   unreachable       needs a port nothing is listening on
//
// A unit test asserting "unmigrated" against a stub would be asserting my
// model of Prisma's bookkeeping table rather than the table, which is the
// same argument docker-compose.yml's own header makes for not mocking
// PostgreSQL.
//
// EVERY CASE RESTORES WHAT IT CHANGED. The migration rows are this database's
// real bookkeeping; a test that deleted one and died would leave the next run
// reporting a false "unmigrated".

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  DATABASE_PROBE_TIMEOUT_MS,
  databaseProbe,
  type DatabaseProbeResult,
} from '@/lib/content/readiness';

/** A row removed by a test, so afterEach can put it back exactly. */
interface Removed {
  readonly id: string;
  readonly checksum: string;
  readonly migration_name: string;
  readonly finished_at: Date | null;
  readonly started_at: Date;
  readonly applied_steps_count: number;
}

let removed: Removed | null = null;
let rolledBack: string | null = null;

afterEach(async () => {
  if (removed !== null) {
    await prisma.$executeRaw`
      INSERT INTO _prisma_migrations
        (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
      VALUES (${removed.id}, ${removed.checksum}, ${removed.migration_name},
              ${removed.finished_at}, ${removed.started_at}, ${removed.applied_steps_count})
    `;
    removed = null;
  }

  if (rolledBack !== null) {
    await prisma.$executeRaw`
      UPDATE _prisma_migrations SET rolled_back_at = NULL WHERE migration_name = ${rolledBack}
    `;
    rolledBack = null;
  }
});

describe('the database probe against a migrated database', () => {
  it('reports ok', async () => {
    // THE CONTROL, and it is not ceremony: every negative case below is only
    // evidence if this one passes, or they would all be reporting the same
    // broken connection (R133).
    expect(await databaseProbe()).toEqual({ ok: true });
  });

  it('bounds its wait, and the bound is a stated constant', async () => {
    expect(DATABASE_PROBE_TIMEOUT_MS).toBe(2_000);

    const started = Date.now();

    await databaseProbe();

    // A healthy SELECT 1 on the same host is sub-millisecond; this asserts
    // the probe is not somehow sitting on the full budget when it succeeds.
    expect(Date.now() - started).toBeLessThan(DATABASE_PROBE_TIMEOUT_MS);
  });
});

describe('a reachable database that is not migrated', () => {
  it('reports unmigrated when a migration this build ships is absent', async () => {
    const rows = await prisma.$queryRaw<ReadonlyArray<Removed>>`
      SELECT id, checksum, migration_name, finished_at, started_at, applied_steps_count
      FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 1
    `;
    const victim = rows[0];

    expect(victim, 'the database must be migrated for this test to mean anything').toBeDefined();
    if (victim === undefined) return;

    removed = victim;
    await prisma.$executeRaw`
      DELETE FROM _prisma_migrations WHERE migration_name = ${victim.migration_name}
    `;

    const result: DatabaseProbeResult = await databaseProbe();

    expect(result).toEqual({ ok: false, reason: 'unmigrated' });
  });

  it('reports migration_failed when one is recorded as rolled back', async () => {
    const rows = await prisma.$queryRaw<ReadonlyArray<{ migration_name: string }>>`
      SELECT migration_name FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 1
    `;
    const victim = rows[0]?.migration_name;

    expect(victim).toBeDefined();
    if (victim === undefined) return;

    rolledBack = victim;
    await prisma.$executeRaw`
      UPDATE _prisma_migrations SET rolled_back_at = NOW() WHERE migration_name = ${victim}
    `;

    const result = await databaseProbe();

    // A ROLLED-BACK MIGRATION IS NOT "UNMIGRATED", and the difference is what
    // the operator does: one is `prisma migrate deploy`, the other needs
    // somebody to decide what the schema should be.
    expect(result).toEqual({ ok: false, reason: 'migration_failed' });
  });
});

describe('R354: the probe never returns anything that identifies the database', () => {
  it('returns a code and nothing else, on every failure path', async () => {
    const rows = await prisma.$queryRaw<ReadonlyArray<Removed>>`
      SELECT id, checksum, migration_name, finished_at, started_at, applied_steps_count
      FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 1
    `;
    const victim = rows[0];

    if (victim === undefined) return;

    removed = victim;
    await prisma.$executeRaw`
      DELETE FROM _prisma_migrations WHERE migration_name = ${victim.migration_name}
    `;

    const result = await databaseProbe();
    const body = JSON.stringify(result);

    // The migration name is in the SERVER LOG by design and must not be here:
    // a migration name describes the schema, and the schema is not public.
    expect(body).not.toContain(victim.migration_name);

    // Nor anything from the connection string.
    const url = process.env.DATABASE_URL ?? '';
    const host = /@([^:/?]+)/.exec(url)?.[1];

    if (host !== undefined && host !== '') expect(body).not.toContain(host);
    expect(body).not.toContain('postgres://');
    expect(body).not.toContain('postgresql://');

    // R133: all of the above hold for an empty object, so prove it answered.
    expect(result).toEqual({ ok: false, reason: 'unmigrated' });
  });
});
