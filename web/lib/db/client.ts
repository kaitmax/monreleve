// web/lib/db/client.ts
//
// The one Prisma client. FW14.
//
// PRISMA 7 TAKES A DRIVER ADAPTER rather than a connection string. The schema
// no longer carries `url` at all - that moved to prisma.config.ts, which only
// the migration CLI reads - so the application's connection is configured
// here, in TypeScript, where it can be read and tested like anything else.
//
// ONE INSTANCE, GUARDED ON globalThis. Next's dev server re-evaluates modules
// on every edit, and a new PrismaClient per evaluation opens a new pool per
// edit until PostgreSQL refuses connections. The guard is a development
// concern only and is written so that production still gets a plain module
// singleton.
//
// NO ABSTRACTION LAYER OVER IT. FW14's standing protocol: "a form, a table,
// two route handlers, one email. No ORM abstraction layer over Prisma." What
// lives beside this file is not a repository pattern - it is the small amount
// of domain logic (normalising an address, hashing a token) that has to be
// identical everywhere it is used, and would otherwise be re-implemented in
// each route handler.

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Read the connection string, and fail loudly rather than connect to nothing.
 *
 * A missing DATABASE_URL produces a client that throws on first use, which
 * surfaces as a failed request somewhere far from the cause. Naming it here
 * means the process says what is wrong at the moment it is wrong.
 */
function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set. Copy web/.env.example to web/.env for local ' +
        'work; `docker compose up -d` starts the database it points at.',
    );
  }

  return url;
}

const globalForPrisma = globalThis as unknown as {
  frontalierPrisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.frontalierPrisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.frontalierPrisma = prisma;
}
