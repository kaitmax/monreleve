// web/scripts/container-db-stopped-verdict.d.mts
//
// Types for container-db-stopped-verdict.mjs, so its unit test (checked by the
// strict tsconfig.json, allowJs: false) can import it. Same reasoning as
// scripts/container-render-verdict.d.mts.
//
// R185: ASSERTED, not argued - tests/unit/meta/declaration-parity.test.ts
// walks every .d.mts beside a .mjs and fails if the value exports here do not
// match the module's, in both directions.

/** One HTTP answer. `status` null means nothing answered; `error` says why. */
export interface HttpAnswer {
  status: number | null;
  body: string;
  error?: string;
  cacheControl?: string;
}

/** One sitemap route and what it answered. */
export interface RouteAnswer {
  path: string;
  answer: HttpAnswer;
}

/** What `docker inspect` said about the app container. */
export interface ContainerState {
  id: string;
  startedAt: string;
  restartCount: number;
  running: boolean;
}

/** Everything the step read, in the three states R946 names. */
export interface DatabaseStoppedObservations {
  /** identity.json's `service`: what /api/health must name (R169). */
  service: string;
  /** This run's FRONTALIER_INSTANCE_ID, which /api/health must echo (R301). */
  instance: string;
  /** The image's baked origin, which the sitemap's <loc>s are on. */
  origin: string;
  /** The database-backed route, path and query. */
  databaseRoute: string;
  /** Its status for read_failed, read from docs/api-v1.md. */
  documentedStatus: number;
  /** This run's own random values, by what they are, checked by value. */
  secrets: Record<string, string>;
  up: {
    health: HttpAnswer;
    ready: HttpAnswer;
    sitemap: HttpAnswer;
    routes: RouteAnswer[];
    databaseRoute: HttpAnswer;
  };
  down: {
    /** docker's State.Running for the database container, read while measuring. */
    databaseRunning: boolean | null;
    health: HttpAnswer;
    ready: HttpAnswer;
    sitemap: HttpAnswer;
    routes: RouteAnswer[];
    databaseRoute: HttpAnswer;
  };
  recovery: {
    ready: HttpAnswer;
    health: HttpAnswer;
    databaseRoute: HttpAnswer;
    appBefore: ContainerState | null;
    appAfter: ContainerState | null;
  };
  /** FW-VERIFIER-OUTAGE (Web Ruling 20): /verifier/<a code the export route issued>. */
  verifier: {
    /** The name the step gave the account before the export: it is printed on the releve. */
    holderName: string;
    /** VERIFICATION_COPY's two sentences, read from lib/fr/verification.ts (copyLiteral). */
    copy: { unavailable: string; unknown: string };
    /** pg_stat_activity: the app's connections to its database when it was stopped. */
    connectionsAtStop: number | null;
    up: {
      /** The issued code, the database running. */
      issued: HttpAnswer;
      /** A random well-formed code, the database running: presence of the unknown sentence. */
      unknown: HttpAnswer;
    };
    down: {
      /** The FIRST database-touching read after the stop: the warm pool's answer, judged. */
      first: HttpAnswer;
      /** A second read of the same code, printed only. */
      second: HttpAnswer;
      /** The app's log lines from the stop to the end of the two reads, redacted. */
      log: string[];
    };
  };
}

export declare function sitemapPaths(
  xml: string,
  origin: string,
): { paths: string[]; foreign: string[] };

export declare function headingsOf(html: string): string[];

export declare function documentedStatus(markdown: string, code: string, method: string): number;

export declare function composePostgresImage(yaml: string): string;

export declare function copyLiteral(source: string, key: string): string;

export declare function leaksIn(
  body: string,
  secrets: Readonly<Record<string, string>>,
  options: { api: boolean },
): string[];

export declare function redact(body: string, secrets: Readonly<Record<string, string>>): string;

export declare function judgeDatabaseStopped(observations: DatabaseStoppedObservations): {
  passed: string[];
  refusals: string[];
};
