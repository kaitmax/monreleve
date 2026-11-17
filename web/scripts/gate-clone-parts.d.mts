// web/scripts/gate-clone-parts.d.mts
//
// Types for gate-clone-parts.mjs, so its unit tests (checked by the strict
// tsconfig.json, allowJs: false) can import it. Same reasoning as
// scripts/gate-selection.d.mts.
//
// R185: ASSERTED, not argued - tests/unit/meta/declaration-parity.test.ts
// walks every .d.mts beside a .mjs and fails if the value exports here do not
// match the module's, in both directions.

/** The summaries gate:clone knows how to read (R955). */
export type SummaryKind = 'vitest' | 'size' | 'production-write';

/**
 * A step's own summary, read from its WHOLE output after stripAnsi, or why it
 * could not be found. `why` names the step: a missing count is NO RESULT.
 */
export type StepSummary =
  | {
      found: true;
      /** The suite's own summary lines, as it printed them, colour removed. */
      lines: string[];
      /** The numbers parsed from those lines. */
      counts: Readonly<Record<string, number>>;
      /** The same numbers as the claim sentence carries them (R956). */
      phrase: string;
    }
  | { found: false; why: string };

/** Read a step's summary out of its whole output (R955). */
export declare function readStepSummary(label: string, kind: SummaryKind, output: string): StepSummary;

/** One step that ran, and its count when it reports one. */
export interface RanStep {
  step: string;
  counts?: string;
}

/** The "ran" list and the claim's list, both, from one record (R956). */
export declare function describeRan(ran: ReadonlyArray<RanStep>): string;

/** The database every administration statement goes to (R957). */
export declare const ADMIN_DATABASE: string;

/** DATABASE_URL's protocol, host, port and credentials, on the `postgres` database; nothing else carries over (R957). */
export declare function adminDatabaseUrl(databaseUrl: string | URL): string;

/** The admin connection with its credentials masked, for the log. */
export declare function adminTarget(databaseUrl: string | URL): string;

/** DATABASE_URL pointed at the scratch database, its query string kept. */
export declare function scratchDatabaseUrl(databaseUrl: string | URL, database: string): string;

/** The two calls the admin runner makes on a client. */
export interface AdminClient {
  query(statement: string): Promise<unknown>;
  end(): Promise<void>;
}

/** Run administration statements on the admin connection, and only there (R957). */
export declare function administer(
  databaseUrl: string | URL,
  statements: ReadonlyArray<string>,
  connect?: (connectionString: string) => Promise<AdminClient>,
): Promise<void>;
