// web/lib/db/scratch-database.d.mts
//
// Types for scratch-database.mjs, which is JavaScript because two plain `node`
// scripts read it before any compilation step exists: scripts/gate-clone.mjs
// names its scratch database through it, and vitest loads vitest.db.config.ts,
// which refuses through it.
//
// R185: ASSERTED, NOT ARGUED. tests/unit/meta/declaration-parity.test.ts finds
// this file beside its module and compares the value exports in both
// directions, so an export added there and forgotten here fails by name.

/** What test:db's guard decided about one DATABASE_URL. */
export type TestDatabaseVerdict =
  | { readonly admitted: true; readonly database: string; readonly reason: null }
  | { readonly admitted: false; readonly database: string | null; readonly reason: string };

/** Every scratch database name starts with this. */
export declare const SCRATCH_DATABASE_PREFIX: string;

/** The one pattern a database must match for test:db to run against it (R877). */
export declare const SCRATCH_DATABASE_PATTERN: RegExp;

/** Where the pattern lives, named in every refusal. */
export declare const SCRATCH_DATABASE_HOME: string;

/** A scratch database name built from a suffix; throws when the result is not admitted. */
export declare function scratchDatabaseName(suffix: string): string;

/** Which database a connection string names, read the way the driver reads it, and whether test:db may empty it. */
export declare function judgeTestDatabase(url: string | undefined | null): TestDatabaseVerdict;

/** The refusal text for a connection string, or null when it is admitted. Never contains the URL. */
export declare function testDatabaseRefusal(url: string | undefined | null): string | null;

/** Throws an Error carrying the refusal text when the connection string is not admitted. */
export declare function assertScratchTestDatabase(url: string | undefined | null): void;
