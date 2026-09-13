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

import { defineConfig } from 'vitest/config';

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
