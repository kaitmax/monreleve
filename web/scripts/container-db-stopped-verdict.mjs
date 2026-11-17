// web/scripts/container-db-stopped-verdict.mjs
//
// ============================================================================
// FW-DB-STOPPED (R945-R948): THE VERDICT ON THE DATABASE-STOPPED STEP
// ============================================================================
//
// Plan Checkpoint D item 5, its second half: "the public site keeps serving
// with the database stopped". scripts/container-db-stopped.mjs starts its own
// Postgres, starts the production IMAGE against it, reads every answer with
// the database running, stops the database, reads them again, starts it, and
// reads the recovery. This module decides what those answers mean.
//
// PURE: no docker, no network, no clock. So every refusal is proven in
// `pnpm test` (tests/unit/meta/container-db-stopped-verdict.test.ts) without
// an image, and the run proves only the collecting - W3b's shape for
// container-render-verdict.mjs.
//
// WHAT R946 STATES, AND NOTHING ELSE IS ASSERTED. With the database stopped:
//   - every route the sitemap lists answers 200 WITH ITS OWN CONTENT;
//   - /api/health is 200 (liveness, R375);
//   - /api/ready is not ready and names the database;
//   - one database-backed route answers its documented error status, with no
//     stack trace and no connection string in the body;
//   - after the database is started again, readiness recovers without a
//     container restart.
// Anything the product does beyond that is printed by the step and reported,
// never asserted here: a finding is not an assertion to adjust (R946).
//
// "ITS OWN CONTENT" IS THE SAME IMAGE'S <h1> WITH THE DATABASE RUNNING. Read,
// not transcribed (R181): the reference is taken a minute before the stop, so
// a route added to the sitemap tomorrow is measured the day it ships, and an
// error page cannot pass for a page - its heading is not the page's. The
// reference must itself be sound first (R169's presence corollary): a route
// that failed with the database RUNNING is refused as such, never compared.

/** The <loc> of every sitemap entry, as a path on `origin`; any other origin kept apart. */
export function sitemapPaths(xml, origin) {
  const paths = [];
  const foreign = [];

  for (const match of xml.matchAll(/<loc>([^<]*)<\/loc>/gu)) {
    const loc = (match[1] ?? '').trim();

    if (loc === origin || loc.startsWith(`${origin}/`)) paths.push(loc.slice(origin.length) || '/');
    else foreign.push(loc);
  }

  return { paths, foreign };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, name) => {
    const key = String(name).toLowerCase();

    if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));

    return ENTITIES[key] ?? whole;
  });
}

/** The text of every <h1>: tags out, entities decoded, whitespace collapsed. */
export function headingsOf(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)].map((match) =>
    decodeEntities((match[1] ?? '').replace(/<[^>]*>/gu, ' '))
      .replace(/\s+/gu, ' ')
      .trim(),
  );
}

function escapeForPattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * The status docs/api-v1.md documents for `code` on `method`, from its
 * error-code table (section 7, the one table with a method column).
 *
 * R211: EXACTLY ONE ROW, OR A REFUSAL. A document restructured so the row moved
 * or doubled must fail here by name, never be read as some other number.
 */
export function documentedStatus(markdown, code, method) {
  const row = new RegExp(
    `^\\|\\s*\`${escapeForPattern(code)}\`\\s*\\|\\s*\`${escapeForPattern(method)}\`\\s*\\|\\s*(\\d{3})\\s*\\|`,
    'gmu',
  );
  const found = [...markdown.matchAll(row)];

  if (found.length !== 1) {
    throw new Error(
      `docs/api-v1.md has ${found.length} rows for \`${code}\` on \`${method}\`; ` +
        'this step reads exactly one (R211)',
    );
  }

  return Number(found[0][1]);
}

/**
 * The one Postgres image docker-compose.yml runs. The step's throwaway database
 * uses the same one, so it pulls no new artefact (and CI's services block names
 * the same image). R211: exactly one, or a refusal.
 */
export function composePostgresImage(yaml) {
  const found = [...yaml.matchAll(/^\s*image:\s*(postgres:\S+)\s*$/gmu)];

  if (found.length !== 1) {
    throw new Error(
      `docker-compose.yml names ${found.length} postgres images; this step reads exactly one (R211)`,
    );
  }

  return found[0][1];
}

/**
 * The SHAPES an API body could carry by accident (R354's rule). A page's prose
 * is checked by VALUE only: a frame-shaped line in a guide would be a false
 * alarm, and no driver writes into a prerendered page.
 *
 * @type {ReadonlyArray<readonly [string, RegExp]>}
 */
const API_SHAPES = [
  ['a connection string', /postgres(?:ql)?:\/\//iu],
  ['a stack trace', /\bat\s+(?:\S+\s+\()?[^\s()]*\.(?:m?js|cjs|tsx?)(?::\d+){1,2}\)?/u],
  ['a server path', /node_modules|\.next[\\/]server/u],
  ['a driver message', /PrismaClient\w*Error|Can't reach database server|ECONNREFUSED|ENOTFOUND|getaddrinfo/u],
];

/**
 * What a body gives away, by NAME - never by value, so the refusal that reports
 * a leaked password does not print it. `secrets` are this run's own random
 * values (password, user, host), checked by value: the run knows exactly what
 * it must not see.
 */
export function leaksIn(body, secrets, { api }) {
  const found = [];

  for (const [what, value] of Object.entries(secrets)) {
    if (value !== '' && body.includes(value)) found.push(what);
  }

  if (api) {
    for (const [what, pattern] of API_SHAPES) {
      if (pattern.test(body)) found.push(what);
    }
  }

  return found;
}

/** `body` with every secret replaced by its name, so it can be printed. */
export function redact(body, secrets) {
  let out = body;

  for (const [what, value] of Object.entries(secrets)) {
    if (value !== '') out = out.split(value).join(`<${what}>`);
  }

  return out;
}

function json(answer) {
  try {
    return JSON.parse(answer.body);
  } catch {
    return null;
  }
}

/** An answer in a refusal: its status, or why there was none. Never the body. */
function said(answer) {
  if (answer === undefined) return 'not fetched';

  return answer.status === null ? `no answer (${answer.error ?? 'unknown'})` : String(answer.status);
}

function databaseCheck(answer) {
  const body = json(answer);
  const checks = body !== null && Array.isArray(body.checks) ? body.checks : [];

  return { body, check: checks.find((check) => check !== null && check.name === 'database') };
}

/**
 * The verdict: `passed` names every check that held, `refusals` every one that
 * did not, each naming the route or the endpoint and both values.
 */
export function judgeDatabaseStopped(o) {
  const passed = [];
  const refusals = [];

  const check = (name, holds, why) => {
    if (holds) passed.push(name);
    else refusals.push(`${name}: ${why}`);
  };

  const healthy = (answer) => {
    const body = json(answer);

    return {
      holds: answer.status === 200 && body !== null && body.service === o.service && body.instance === o.instance,
      why: `status ${said(answer)}, service ${JSON.stringify(body?.service)}, instance ${JSON.stringify(body?.instance)} (this run's is ${o.instance})`,
    };
  };

  // ==========================================================================
  // THE REFERENCE: THE DATABASE RUNNING (R945: "proves a page served")
  // ==========================================================================
  const upHealth = healthy(o.up.health);

  check('with the database running, /api/health names this product and this run (R169, R301)', upHealth.holds, upHealth.why);

  const upReady = databaseCheck(o.up.ready);

  check(
    'with the database running, /api/ready is ready and its database check passed',
    o.up.ready.status === 200 && upReady.body?.ready === true && upReady.check?.ok === true,
    `status ${said(o.up.ready)}, ready ${JSON.stringify(upReady.body?.ready)}, database ok ${JSON.stringify(upReady.check?.ok)}`,
  );

  const listed = sitemapPaths(o.up.sitemap.body, o.origin);

  check(
    "with the database running, the sitemap answers 200 and lists at least one route, all on the image's origin",
    o.up.sitemap.status === 200 && listed.paths.length > 0 && listed.foreign.length === 0,
    `status ${said(o.up.sitemap)}, ${listed.paths.length} route(s) on ${o.origin}, ${listed.foreign.length} elsewhere (${listed.foreign.join(', ')})`,
  );

  const fetched = (routes) => routes.map((route) => route.path);
  const sameList = (a, b) => a.length === b.length && a.every((path, index) => path === b[index]);

  check(
    'with the database running, every route the sitemap lists was fetched (the count, R133)',
    sameList(fetched(o.up.routes), listed.paths),
    `listed ${listed.paths.length} [${listed.paths.join(', ')}], fetched ${o.up.routes.length} [${fetched(o.up.routes).join(', ')}]`,
  );

  check(
    `with the database running, GET ${o.databaseRoute} answers 200 (it reads the database)`,
    o.up.databaseRoute.status === 200,
    `status ${said(o.up.databaseRoute)}`,
  );

  // ==========================================================================
  // THE DATABASE STOPPED
  // ==========================================================================
  check(
    'the database container is stopped while the step measures (R945)',
    o.down.databaseRunning === false,
    `docker reports it running: ${JSON.stringify(o.down.databaseRunning)}`,
  );

  const downHealth = healthy(o.down.health);

  check('with the database stopped, /api/health answers 200 and names this run (R375, R301)', downHealth.holds, downHealth.why);

  const downReady = databaseCheck(o.down.ready);

  check(
    'with the database stopped, /api/ready answers 503, not ready, and names the database',
    o.down.ready.status === 503 && downReady.body?.ready === false && downReady.check?.ok === false,
    `status ${said(o.down.ready)}, ready ${JSON.stringify(downReady.body?.ready)}, database check ${JSON.stringify(downReady.check ?? null)}`,
  );

  check(
    'with the database stopped, the sitemap answers 200 with the same document',
    o.down.sitemap.status === 200 && o.down.sitemap.body === o.up.sitemap.body,
    `status ${said(o.down.sitemap)}, ${o.down.sitemap.body === o.up.sitemap.body ? 'same' : 'a different'} document`,
  );

  check(
    'with the database stopped, every route the sitemap lists was fetched (the count, R133)',
    sameList(fetched(o.down.routes), listed.paths),
    `listed ${listed.paths.length} [${listed.paths.join(', ')}], fetched ${o.down.routes.length} [${fetched(o.down.routes).join(', ')}]`,
  );

  check(
    `with the database stopped, GET ${o.databaseRoute} answers its documented ${o.documentedStatus} (docs/api-v1.md, read_failed)`,
    o.down.databaseRoute.status === o.documentedStatus,
    `status ${said(o.down.databaseRoute)}, documented ${o.documentedStatus}`,
  );

  const routeLeaks = leaksIn(o.down.databaseRoute.body, o.secrets, { api: true });

  check(
    `with the database stopped, GET ${o.databaseRoute}'s body carries no stack trace, no connection string and no secret (R354)`,
    routeLeaks.length === 0,
    `it carries ${routeLeaks.join(', ')}`,
  );

  const elsewhere = [
    ...[
      ['/api/health', o.down.health],
      ['/api/ready', o.down.ready],
    ].flatMap(([where, answer]) => leaksIn(answer.body, o.secrets, { api: true }).map((what) => `${what} in ${where}`)),
    ...[['/sitemap.xml', o.down.sitemap], ...o.down.routes.map((route) => [route.path, route.answer])].flatMap(
      ([where, answer]) => leaksIn(answer.body, o.secrets, { api: false }).map((what) => `${what} in ${where}`),
    ),
  ];

  check(
    'with the database stopped, no other body served carries a secret or (in an API body) a connection string or stack trace',
    elsewhere.length === 0,
    elsewhere.join('; '),
  );

  // ==========================================================================
  // EVERY ROUTE, BOTH STATES - one check each, so a refusal names its route
  // ==========================================================================
  for (const path of listed.paths) {
    const up = o.up.routes.find((route) => route.path === path)?.answer;
    const down = o.down.routes.find((route) => route.path === path)?.answer;
    const upHeadings = up === undefined ? [] : headingsOf(up.body);

    check(
      `with the database running, ${path} answers 200 with a heading`,
      up !== undefined && up.status === 200 && upHeadings.length > 0 && upHeadings.every((text) => text !== ''),
      `status ${said(up)}, headings ${JSON.stringify(upHeadings)}`,
    );

    const downHeadings = down === undefined ? [] : headingsOf(down.body);

    check(
      `with the database stopped, ${path} answers 200 with its own heading`,
      down !== undefined &&
        down.status === 200 &&
        upHeadings.length > 0 &&
        sameList(downHeadings, upHeadings),
      `status ${said(down)} (${said(up)} with it running), heading ${JSON.stringify(downHeadings)} (${JSON.stringify(upHeadings)} with it running)`,
    );
  }

  // ==========================================================================
  // THE RECOVERY: THE DATABASE STARTED AGAIN, THE CONTAINER NOT RESTARTED
  // ==========================================================================
  const backReady = databaseCheck(o.recovery.ready);

  check(
    'after the database is started again, /api/ready recovers to ready',
    o.recovery.ready.status === 200 && backReady.body?.ready === true && backReady.check?.ok === true,
    `status ${said(o.recovery.ready)}, ready ${JSON.stringify(backReady.body?.ready)}, database ok ${JSON.stringify(backReady.check?.ok)}`,
  );

  check(
    `after the database is started again, GET ${o.databaseRoute} answers 200 again`,
    o.recovery.databaseRoute.status === 200,
    `status ${said(o.recovery.databaseRoute)}`,
  );

  const backHealth = healthy(o.recovery.health);

  check('after the database is started again, /api/health still names this run (R301)', backHealth.holds, backHealth.why);

  const before = o.recovery.appBefore;
  const after = o.recovery.appAfter;

  check(
    'the app container was not restarted: same id, same start time, same restart count, running',
    before !== null &&
      after !== null &&
      after.running === true &&
      after.id === before.id &&
      after.startedAt === before.startedAt &&
      after.restartCount === before.restartCount,
    `before ${JSON.stringify(before)}, after ${JSON.stringify(after)}`,
  );

  return { passed, refusals };
}
