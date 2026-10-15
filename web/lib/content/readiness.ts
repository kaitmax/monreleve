// web/lib/content/readiness.ts
//
// RULING R83: liveness and readiness are separate.
//
//   /api/health   LIVENESS.  200 whenever the process is up. Degraded goes in
//                 the body. It never fails on configuration.
//   /api/ready    READINESS. 503 while degraded. FW28 points Coolify's deploy
//                 health check here.
//
// WHY THE SPLIT MATTERS, and it is not pedantry. I built the health endpoint
// returning 200 with a degraded body and raised the consequence: a deploy
// could go live degraded, because an orchestrator sees a healthy container.
// The obvious fix - make health 503 - is worse than the problem. An
// orchestrator RESTARTS a container that fails liveness, and restarting
// cannot supply a missing environment variable, so the container would loop
// forever while the previous version stayed down.
//
// Readiness is the endpoint that means "do not send this version live".
// Failing it stops a deploy and leaves the running version serving. That is
// what the two words mean everywhere, and conflating them is why deploys
// either crash-loop or go live broken.
//
// A LIST OF CHECKS RATHER THAN A BOOLEAN, because R83 already names the next
// one: "unreachable database later". A boolean would have to be replaced when
// that arrives; a list gets an entry, and the endpoint's contract does not
// change.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '@/lib/db/client';
import { servingWithoutOrigin } from './site';

/**
 * Why a check failed, as a FIXED CODE rather than prose (R354).
 *
 * /api/ready is unauthenticated: a deploy gate, a load balancer and anyone
 * who curls it read this body. A driver error carries the connection string -
 * host, port, user, password - in its message, so the message never travels.
 * The code says what an operator must DO; the server log carries the detail.
 */
export type ReadinessReason = 'unreachable' | 'timeout' | 'unmigrated' | 'migration_failed';

/** What a probe returns. Never an error object, never a driver message. */
export type DatabaseProbeResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ReadinessReason };

export type DatabaseProbe = () => Promise<DatabaseProbeResult>;

export interface ReadinessCheck {
  /** Stable identifier, safe to alert on. */
  readonly name: string;
  /**
   * true passed, false failed, NULL NOT EVALUATED (R355).
   *
   * THREE STATES, AND THE THIRD IS THE POINT. `pnpm build` and CI have no
   * database and must not need one, so the database check does not run there.
   * Reporting that as `true` would be a check nobody ran reading as a check
   * that passed - the exact shape R133 keeps finding - and dropping it from
   * the list would make a check that silently stopped running invisible. So
   * it stays in the list with `ok: null`, which no reader can mistake for a
   * pass, and which does not block a deploy.
   */
  readonly ok: boolean | null;
  /** Present when the check failed: what is wrong and what to set. */
  readonly detail?: string;
  /** R354: present when a failure has a code. Never driver text. */
  readonly reason?: ReadinessReason;
}

export interface Readiness {
  readonly ready: boolean;
  readonly checks: readonly ReadinessCheck[];
}

const ORIGIN_DETAIL =
  'NEXT_PUBLIC_SITE_URL is unset while FRONTALIER_RUNTIME=1. The site origin ' +
  'is the localhost stand-in, so /sitemap.xml is returning 503 and canonical ' +
  'URLs are omitted. Set the variable to the real origin - scheme, no ' +
  'trailing slash. Rulings R81 and R83.';

/** What an operator does about each reason. No host, no port, no name. */
const DATABASE_DETAIL: Readonly<Record<ReadinessReason, string>> = {
  unreachable:
    'The database did not answer. Check the database service is running and ' +
    'that DATABASE_URL points at it from inside the container. Ruling R353.',
  timeout:
    'The database did not answer within the readiness budget. It may be ' +
    'starting, saturated, or unreachable across the network. Ruling R353.',
  unmigrated:
    'The database is reachable but does not have every migration this ' +
    'version ships. Run prisma migrate deploy as docs/deploy.md section 4 ' +
    'describes, then redeploy. Ruling R353.',
  migration_failed:
    'A migration is recorded as failed or rolled back. It must be resolved ' +
    'against the database before this version can serve. Ruling R353.',
};

const NOT_EVALUATED_DETAIL =
  'Not evaluated: this process is not serving (FRONTALIER_RUNTIME is unset), ' +
  'so no database is required. `pnpm build` and CI run here. Ruling R355.';

/**
 * Every readiness check, passing ones included.
 *
 * Reporting the passes matters as much as the failures: a deploy log that
 * lists which checks RAN is what makes it possible to notice one silently
 * ceasing to be evaluated. The same reason the contrast audit reports its own
 * coverage rather than only its violations.
 *
 * ASYNC SINCE R353, because the database check has to ask the database. The
 * route awaits it; nothing else called this.
 *
 * THE PROBE IS A PARAMETER so the decision can be tested without a database -
 * what this function does with a result is separate from how the result is
 * obtained, and only the second needs PostgreSQL (pnpm test:db).
 */
export async function readiness(probe: DatabaseProbe = databaseProbe): Promise<Readiness> {
  const checks: ReadinessCheck[] = [
    servingWithoutOrigin()
      ? { name: 'site-origin', ok: false, detail: ORIGIN_DETAIL }
      : { name: 'site-origin', ok: true },
  ];

  // R355: only a SERVING process needs a database. The marker is the one
  // signal that distinguishes serving from building - NODE_ENV cannot, since
  // `next build` sets production too (FW28's guard learned this).
  if (process.env.FRONTALIER_RUNTIME === '1') {
    const result = await probe();

    checks.push(
      result.ok
        ? { name: 'database', ok: true }
        : {
            name: 'database',
            ok: false,
            reason: result.reason,
            detail: DATABASE_DETAIL[result.reason],
          },
    );
  } else {
    checks.push({ name: 'database', ok: null, detail: NOT_EVALUATED_DETAIL });
  }

  // `!== false` rather than truthiness: a NOT EVALUATED check (null) must not
  // block a deploy, and must not count as a pass either. Only an explicit
  // failure stops the version going live (R83).
  return { ready: checks.every((check) => check.ok !== false), checks };
}

/**
 * How long readiness will wait for the database before calling it a timeout.
 *
 * TWO SECONDS, AND THE NUMBER IS A DEPLOY DECISION rather than a guess. This
 * runs per request against a deploy gate that is polling: too long and a
 * genuinely dead database holds every probe open until the orchestrator's own
 * timeout decides for us, with no reason code recorded; too short and a
 * database that is merely busy fails a deploy that would have been fine. Two
 * seconds is far above a healthy SELECT 1 on the same Docker network
 * (sub-millisecond, measured) and far below Coolify's own health-check
 * window, so the answer here is always ours rather than the orchestrator's.
 */
export const DATABASE_PROBE_TIMEOUT_MS = 2_000;

/**
 * The migrations THIS VERSION ships, read from the image at startup.
 *
 * R353b: the runner stage copies prisma/ into the image -
 * `COPY --from=builder /app/prisma ./prisma` in web/Dockerfile - so the
 * directory is present beside the server and is the authority on what this
 * build expects. Verified on the running production container: prisma/
 * contains migrations/ and schema.prisma, 13 migration directories.
 *
 * READ FROM DISK RATHER THAN A HAND-KEPT LIST, which the ruling forbids for
 * the obvious reason: a list someone maintains is a list that disagrees with
 * the migrations the day someone forgets. A directory listing cannot.
 */
function expectedMigrations(): readonly string[] {
  const dir = join(process.cwd(), 'prisma', 'migrations');

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** A row of _prisma_migrations, narrowed to what the comparison needs. */
interface MigrationRow {
  readonly migration_name: string;
  readonly finished_at: Date | null;
  readonly rolled_back_at: Date | null;
}

/**
 * Is the database reachable, and does it carry this version's migrations?
 *
 * ONE CONNECTION FROM THE EXISTING CLIENT (R357). No new PrismaClient and no
 * second pool: a readiness probe that opened its own pool would consume
 * connections in proportion to how often the deploy gate polls, which is
 * exactly when the database is least able to spare them.
 *
 * EVERY FAILURE BECOMES A CODE, and the error itself goes to the log (R354).
 */
export async function databaseProbe(): Promise<DatabaseProbeResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => {
        resolve('timeout');
      }, DATABASE_PROBE_TIMEOUT_MS);
    });

    // SELECT 1 proves the connection and the credentials without reading a
    // single row of anybody's data.
    const reachable = prisma.$queryRaw`SELECT 1`.then(() => 'reachable' as const);
    const outcome = await Promise.race([reachable, timeout]);

    if (outcome === 'timeout') {
      console.error(
        `[readiness] the database did not answer within ${String(DATABASE_PROBE_TIMEOUT_MS)}ms`,
      );

      return { ok: false, reason: 'timeout' };
    }

    // MIGRATED (R353b). _prisma_migrations is Prisma's own table; a database
    // that has never been migrated does not have it, which is itself the
    // answer rather than an error.
    const rows = await prisma.$queryRaw<MigrationRow[]>`
      SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations
    `;

    if (rows.some((row) => row.rolled_back_at !== null)) {
      console.error('[readiness] a migration is recorded as rolled back');

      return { ok: false, reason: 'migration_failed' };
    }

    const finished = new Set(
      rows.filter((row) => row.finished_at !== null).map((row) => row.migration_name),
    );
    const missing = expectedMigrations().filter((name) => !finished.has(name));

    if (missing.length > 0) {
      // THE NAMES GO TO THE LOG, NEVER THE BODY (R354). A migration name
      // describes the schema, and the schema is not public.
      console.error(
        `[readiness] ${String(missing.length)} migration(s) not applied: ${missing.join(', ')}`,
      );

      return { ok: false, reason: 'unmigrated' };
    }

    return { ok: true };
  } catch (cause) {
    // A MISSING _prisma_migrations IS "UNMIGRATED", NOT "UNREACHABLE", and
    // the distinction is what an operator does next: one is prisma migrate
    // deploy, the other is the database service. SELECT 1 already succeeded
    // by the time that query runs, so a failure here is about the table.
    const message = cause instanceof Error ? cause.message : String(cause);
    const missingTable = /_prisma_migrations/.test(message) && /exist/i.test(message);

    console.error(`[readiness] database probe failed: ${message}`);

    return { ok: false, reason: missingTable ? 'unmigrated' : 'unreachable' };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
