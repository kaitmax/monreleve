// web/prisma.config.ts
//
// Where the migration tooling finds the database. Prisma 7 removed `url` from
// the schema file: migrations read it from here, and the CLIENT never reads it
// at all - it is handed a driver adapter instead (lib/db/client.ts).
//
// THAT SPLIT IS WORTH UNDERSTANDING RATHER THAN COPYING. The schema is now a
// description of shape only, so a schema file can no longer leak a connection
// string into a diff, a screenshot or a bug report. The two consumers are
// separate: `prisma migrate` is a developer tool that needs a URL, and the
// running application needs a connection pool.
//
// env() rather than process.env: Prisma's own helper reads .env the way the
// CLI does, so `pnpm db:migrate` works without the shell having been set up
// first.

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  datasource: {
    url: env('DATABASE_URL'),
  },

  migrations: {
    path: 'prisma/migrations',
    // pnpm db:seed, as the prompt names it. Prisma runs this after
    // `migrate reset` and `migrate dev`, so a freshly reset local database is
    // usable without a second command.
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
});
