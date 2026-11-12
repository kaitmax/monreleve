// web/vitest.db.config.ts
//
// The database suite, kept separate from `pnpm test` on purpose.
//
// WHY NOT ONE SUITE. `pnpm test` is the command that runs on every increment
// and in every gate; it must work on a laptop with no Docker and in any CI job
// that has not started PostgreSQL. Folding database tests into it would make
// the primary loop command depend on a service, and the predictable outcome is
// that somebody adds a mock to get it green again - at which point the tests
// stop asserting what PostgreSQL does, which is the only reason they exist.
//
// So tests/db/** is excluded from vitest.config.ts and run by `pnpm test:db`,
// which R132's selector requires whenever prisma/**, lib/db/** or tests/db/**
// changes.
//
// ONE FILE AT A TIME, ONE WORKER. These tests share a database and each one
// starts by emptying the table it owns. Run in parallel, "exactly one row"
// would be a statement about scheduling rather than about the constraint.
//
// ============================================================================
// R877: AND BECAUSE EACH ONE EMPTIES A TABLE, THE SUITE REFUSES ANY DATABASE
// THAT IS NOT A SCRATCH ONE - BEFORE A SINGLE TEST FILE IS LOADED
// ============================================================================
//
// web/.env points DATABASE_URL at the shared development database, so
// `pnpm test:db` from a checkout holding that file used to empty the
// developer's data. The check runs HERE, while this file is evaluated, which
// is earlier than any globalSetup and earlier than test-file collection: a
// refused URL ends the process with the refusal text and no test file is ever
// imported. It is in the config rather than in package.json's script because
// the config is the one door: scripts/container-e2e.mjs runs vitest with this
// config directly, never through `pnpm test:db`.
//
// The pattern and the refusal text live in lib/db/scratch-database.mjs, the
// one home (R206). tests/unit/meta/test-db-guard.test.ts drives this file in a
// real vitest process in both directions.

import { defineConfig } from 'vitest/config';

import { assertScratchTestDatabase } from './lib/db/scratch-database.mjs';

assertScratchTestDatabase(process.env.DATABASE_URL);

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['tests/db/**/*.test.ts'],
    environment: 'node',

    // The shared-database argument above. fileParallelism alone would still
    // let two files interleave across workers, so the cap is set as well.
    fileParallelism: false,
    maxWorkers: 1,

    // A database test that hangs is usually a connection that never opened -
    // a container that is not up, a port that is not published. Ten seconds is
    // long enough for a cold pool and short enough that the failure arrives
    // while somebody is still watching.
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
