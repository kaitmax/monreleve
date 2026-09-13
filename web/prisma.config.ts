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
// THE DATASOURCE IS CONDITIONAL, and CI is why. `prisma generate` needs the
// SCHEMA and nothing else - it writes TypeScript, it does not connect - but
// Prisma's own env() helper throws while the config file is being LOADED, so
// declaring the datasource unconditionally made `generate` impossible without
// a database URL. Every job that installs and builds but has no database was
// then unable to compile: the runtime guard and the visual baselines both
// failed on "Module '@prisma/client' has no exported member 'PrismaClient'",
// because the client had never been generated.
//
// So the URL is read plainly and the key is present only when there is one to
// put in it. A migration command run without DATABASE_URL still fails, and
// says so - it just fails at the point it needs the database rather than at
// the point the file is read.

import { defineConfig } from 'prisma/config';

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',

  ...(url === undefined || url === '' ? {} : { datasource: { url } }),

  migrations: {
    path: 'prisma/migrations',
    // pnpm db:seed, as the prompt names it. Prisma runs this after
    // `migrate reset` and `migrate dev`, so a freshly reset local database is
    // usable without a second command.
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
});
