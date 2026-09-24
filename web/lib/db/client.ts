// web/lib/db/client.ts
//
// The one Prisma client. FW14.
//
// PRISMA 7 TAKES A DRIVER ADAPTER rather than a connection string. The schema
// no longer carries `url` at all - that moved to prisma.config.ts, which only
// the migration CLI reads - so the application's connection is configured
// here, in TypeScript, where it can be read and tested like anything else.
//
// ONE INSTANCE, CACHED ON globalThis, IN EVERY ENVIRONMENT. Next's dev server
// re-evaluates modules on every edit, and a new PrismaClient per evaluation
// opens a new pool per edit until PostgreSQL refuses connections. The same is
// true of production for a different reason - the Proxy below calls create()
// on every property access - so the cache is unconditional.
//
// THIS PARAGRAPH USED TO SAY THE GUARD WAS "a development concern only" AND
// THAT "production still gets a plain module singleton". That was false from
// the day it was written: a module singleton needs a module-scope binding and
// there is none. Production had no singleton at all, every `prisma.x` built a
// client and a pool, and POST /api/v1/entries returned 500 with zero rows
// from 13 September until FW31 - three weeks in which every suite was green,
// because they all run where the guard WAS applied. The sentence is kept, in
// the past tense, because a comment asserting a property nothing delivers is
// the mechanism that hid this (R154), and deleting it would leave the lesson
// nowhere.
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

function create(): PrismaClient {
  const client =
    globalForPrisma.frontalierPrisma ??
    new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) });

  // CACHED IN EVERY ENVIRONMENT, PRODUCTION INCLUDED. FW31.
  //
  // This assignment used to sit behind `NODE_ENV !== 'production'`, on the
  // reasoning recorded above it that production "still gets a plain module
  // singleton". IT NEVER DID: a module singleton needs a module-scope binding
  // and there is none - there is a Proxy that calls this function on EVERY
  // property access. So production cached nothing and every `prisma.x` built
  // a PrismaClient and a PrismaPg pool.
  //
  // Measured before the change, against a production container: thirty
  // authenticated requests took the server from 1 to 97 of 100 connections,
  // and the next thirty exhausted it so completely that psql could not
  // connect. About four pools per request, released only by node-postgres's
  // ~10s idleTimeoutMillis.
  //
  // globalThis rather than a module-scope `let`, still: Next bundles server
  // code into several chunks and this module can be evaluated more than once
  // in one process, which is the same reason the dev guard used it.
  globalForPrisma.frontalierPrisma = client;

  return client;
}

/**
 * BUILT ON FIRST USE, NOT ON IMPORT, and CI is what taught this.
 *
 * The first version constructed the client at module scope, so importing this
 * file read DATABASE_URL and threw without one. `next build` IMPORTS every
 * route module to collect page data - it does not run the handlers - so the
 * build died on /api/alertes/confirm in exactly the two CI jobs that have no
 * database: the visual baselines and the runtime guard. The `web` job has one
 * and passed, and so did every local run, because .env exists here.
 *
 * A build is not a connection. Deferring construction means a machine that
 * never queries never needs a database, while the first real query still gets
 * the same error naming the same fix - just at the moment it is actually
 * needed rather than at the moment the file is read.
 *
 * The Proxy exists so that every call site keeps reading `prisma.model.method`
 * rather than calling an accessor; the indirection is one property lookup and
 * it is confined to this file.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = create();
    const value = Reflect.get(client, property) as unknown;

    // WHAT COMES BACK IS BOUND TO THE CLIENT, and a 500 on the product's main
    // use case is what taught this. FW31.
    //
    // `prisma.$transaction(cb)` is a method call whose base reference is THIS
    // PROXY, so JavaScript binds `this` to the Proxy no matter what the trap
    // returned. Prisma's `$transaction` then reads `this._engine`,
    // `this._tracingHelper`, `this._createItxClient` and a dozen more through
    // here instead of off the client that opened the transaction. While the
    // cache above was skipped in production, each of those re-entries built a
    // DIFFERENT client - so the transaction was started on one engine and
    // committed against another: "Transaction API error: Transaction not
    // found."
    //
    // Binding makes each method carry the client it came from, so no Prisma
    // internal is ever resolved against this Proxy, and the trap fires once
    // per call site rather than a dozen times per transaction.
    //
    // MODEL DELEGATES ARE UNTOUCHED. `prisma.entry` is an object - Prisma's
    // own composite proxy - not a function, so it passes through unbound and
    // keeps its identity.
    //
    // THE RECEIVER ARGUMENT IS GONE BECAUSE IT NEVER DID ANYTHING, and saying
    // so matters more than dropping it. `Reflect.get`'s third argument sets
    // `this` for an ACCESSOR during the get; it cannot decide the `this` of a
    // later call. And in Prisma 7 it could not even do that much: the
    // constructor ends `return this._appliedParent = <composite proxy>`, and
    // that proxy's trap is `get(o, s)` - two parameters, the receiver
    // discarded. Read from the shipped runtime, not assumed. Leaving it in
    // would imply a mechanism that is not there, which is how this defect was
    // first described.
    return typeof value === 'function' ? (value.bind(client) as unknown) : value;
  },
});
