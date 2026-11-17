// web/scripts/gate-clone-parts.mjs
//
// THE PARTS OF gate:clone A TEST CAN IMPORT. gate-clone.mjs clones, installs
// and runs suites the moment it is loaded, so anything in it that needs a
// unit test lives here instead - gate-selection.mjs's reasoning for
// gate-for-changes.mjs, applied to the other gate. Nothing here runs on
// import: no process is spawned and no driver is loaded until a function is
// called (tests/unit/meta/declaration-parity.test.ts imports this file for its
// keys).
//
// ============================================================================
// R955: EVERY TEST STEP'S COUNT IS PRINTED IN FULL
// ============================================================================
//
// gate:clone prints the last 14 lines of each step's stdout followed by its
// stderr. Every suite prints its summary on STDOUT and its noise on STDERR,
// so the tail was the noise: canvas warnings under `pnpm test`, docker's
// build log under the production write, and the middle of the size table,
// with its header and the calculator's own row cut off. A red suite still
// failed the step, but a run with FEWER tests than the last one read exactly
// like a full one (C1b's deviation 6; Queue Rulings 21-22).
//
// So each step that runs a suite, and the size step, has its summary read out
// of its WHOLE output, after stripAnsi (R206, R266: vitest colours the digits
// apart from their label), and printed beside the tail. A summary that
// cannot be found is NO RESULT, never a pass (R391): the step fails, named.
//
// ============================================================================
// R956: THE CLAIM CARRIES THE SAME COUNTS
// ============================================================================
//
// describeRan renders the "ran" line and the claim sentence from one record of
// the steps that completed, each with the phrase its own summary produced.
//
// ============================================================================
// R957: THE ADMIN CONNECTION IS postgres
// ============================================================================
//
// CREATE DATABASE and DROP DATABASE for the scratch database used to go
// through a connection to whatever DATABASE_URL named - from a checkout whose
// web/.env names `frontalier`, a session on the shared development database.
// administer() opens the server's `postgres` database with DATABASE_URL's
// host, port and credentials, and nothing else of it; gate-clone.mjs has no
// other way to reach the server.

import { stripAnsi } from './gate-selection.mjs';

// ----------------------------------------------------------------------------
// R955 - the summaries
// ----------------------------------------------------------------------------

/**
 * A vitest summary value: "4 passed (4)", "1 failed | 2 passed | 1 todo (4)".
 * The words are vitest's; the parenthesised number is the total.
 */
const VITEST_VALUE = /^(\d+ [a-z]+(?: \| \d+ [a-z]+)*) \((\d+)\)$/u;
const VITEST_FILES = /^\s*Test Files\s+(.+?)\s*$/u;
const VITEST_TESTS = /^\s*Tests\s+(.+?)\s*$/u;
const VITEST_ERRORS = /^\s*Errors\s+(\d+) errors?\s*$/u;

/** The parts of a vitest summary value, or null when the line is not one. */
function vitestValue(line, label) {
  const named = label.exec(line);
  const value = named === null ? null : VITEST_VALUE.exec(named[1]);

  if (value === null) {
    return null;
  }

  const counts = { passed: 0, failed: 0, skipped: 0, todo: 0, total: Number(value[2]) };

  for (const part of value[1].split(' | ')) {
    const [number, word] = part.split(' ');

    counts[word] = (counts[word] ?? 0) + Number(number);
  }

  return counts;
}

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * vitest's summary: the LAST "Test Files" line that has a "Tests" line right
 * beneath it, and the "Errors" line when there is one. Both lines are
 * required: a Tests line on its own is something a test printed.
 */
function readVitest(lines) {
  for (let index = lines.length - 2; index >= 0; index -= 1) {
    const files = vitestValue(lines[index], VITEST_FILES);
    const tests = files === null ? null : vitestValue(lines[index + 1], VITEST_TESTS);

    if (files === null || tests === null) {
      continue;
    }

    const errorsLine = lines[index + 2] ?? '';
    const errors = VITEST_ERRORS.exec(errorsLine);
    const summary = [lines[index], lines[index + 1], ...(errors === null ? [] : [errorsLine])];
    const counts = {
      passed: tests.passed,
      failed: tests.failed,
      skipped: tests.skipped,
      todo: tests.todo,
      total: tests.total,
      files: files.total,
      errors: errors === null ? 0 : Number(errors[1]),
    };
    const extras = [
      counts.skipped > 0 ? `${counts.skipped} skipped` : '',
      counts.todo > 0 ? `${counts.todo} todo` : '',
      counts.failed > 0 ? `${counts.failed} failed` : '',
      counts.errors > 0 ? plural(counts.errors, 'error') : '',
    ].filter((part) => part !== '');

    return {
      lines: summary.map((line) => line.trimEnd()),
      counts,
      phrase: [`${counts.passed} of ${counts.total} tests passed`, ...extras, plural(counts.files, 'file')].join(', '),
    };
  }

  return null;
}

/** check-budgets.mjs's table: its title, column header, rules and route rows. */
const SIZE_TITLE = /^First-load JS per route\b/u;
const SIZE_HEADER = /^route\s+bucket\s+js total\s+delta\s+css\s+fonts\s+verdict\s*$/u;
const SIZE_RULE = /^-{20,}\s*$/u;
const SIZE_ROW = /^\/\S*\s+(?:public|dev)\s+-?\d+\.\d\s+-?\d+\.\d\s+-?\d+\.\d\s+-?\d+\.\d\s+\S.*$/u;

/** How far above its header the table's title may sit: the two gate lines and a blank. */
const TITLE_REACH = 6;

/**
 * The per-route table, title to closing rule. Every line between the two
 * rules must be a route row, and there must be at least one: a table whose
 * rows are gone is not a table, whatever the verdict sentence below it says.
 */
function readSizeTable(lines) {
  for (let header = lines.length - 1; header >= 0; header -= 1) {
    if (!SIZE_HEADER.test(lines[header]) || !SIZE_RULE.test(lines[header + 1] ?? '')) {
      continue;
    }

    let close = header + 2;

    while (close < lines.length && !SIZE_RULE.test(lines[close])) {
      close += 1;
    }

    const rows = lines.slice(header + 2, close);

    if (close >= lines.length || rows.length === 0 || !rows.every((row) => SIZE_ROW.test(row))) {
      return null;
    }

    let start = header;

    for (let above = header - 1; above >= Math.max(0, header - TITLE_REACH); above -= 1) {
      if (SIZE_TITLE.test(lines[above])) {
        start = above;
        break;
      }
    }

    return {
      lines: lines.slice(start, close + 1).map((line) => line.trimEnd()),
      counts: { routes: rows.length },
      phrase: `${plural(rows.length, 'route')} measured`,
    };
  }

  return null;
}

/** container-write.mjs's own sentences: "Production write checks  N passed (N)" and "N FAILED:". */
const WRITE_CHECKS = /^Production write checks {2}(\d+) passed \(\d+\)\s*$/u;
const WRITE_FAILED = /^(\d+) FAILED:\s*$/u;

function readProductionWrite(lines) {
  const checks = lines.findLast((line) => WRITE_CHECKS.test(line));

  if (checks === undefined) {
    return null;
  }

  const failedLine = lines.findLast((line) => WRITE_FAILED.test(line));
  const passed = Number(WRITE_CHECKS.exec(checks)[1]);
  const failed = failedLine === undefined ? 0 : Number(WRITE_FAILED.exec(failedLine)[1]);

  return {
    lines: [checks, ...(failedLine === undefined ? [] : [failedLine])].map((line) => line.trimEnd()),
    counts: { passed, failed },
    phrase: [`${plural(passed, 'check')} passed`, ...(failed > 0 ? [`${failed} failed`] : [])].join(', '),
  };
}

const READERS = Object.freeze({
  vitest: {
    what: 'vitest summary (a "Test Files" line with a "Tests" line beneath it)',
    read: readVitest,
  },
  size: {
    what: 'per-route size table (its column header, a rule, one or more route rows, a closing rule)',
    read: readSizeTable,
  },
  'production-write': {
    what: '"Production write checks  N passed (N)" line',
    read: readProductionWrite,
  },
});

/**
 * A step's own summary, read from its WHOLE output after stripAnsi.
 *
 * Found: the summary lines as the step printed them (colour removed), the
 * numbers in them, and the phrase the claim carries. Not found: why, with the
 * step named - the caller fails the step on it (R955, R391).
 *
 * An unknown `kind` throws: that is a defect in gate-clone.mjs, not a verdict
 * about the commit under test.
 */
export function readStepSummary(label, kind, output) {
  const reader = Object.hasOwn(READERS, kind) ? READERS[kind] : undefined;

  if (reader === undefined) {
    throw new Error(`gate-clone-parts.mjs has no summary reader called ${JSON.stringify(kind)} (asked for by ${label})`);
  }

  const found = reader.read(stripAnsi(output).split(/\r?\n/u));

  if (found === null) {
    return {
      found: false,
      why: `${label} printed no ${reader.what}. A missing count is NO RESULT, never a pass (R955, R391).`,
    };
  }

  return { found: true, ...found };
}

/**
 * The steps that ran, each with its count beside it when its summary gave
 * one. The "ran" line and the claim sentence are both this string, so the
 * claim cannot name a step that did not complete or a number no summary
 * printed (R956, R206).
 */
export function describeRan(ran) {
  return ran.map(({ step, counts }) => (counts === undefined ? step : `${step} (${counts})`)).join(', ');
}

// ----------------------------------------------------------------------------
// R957 - the admin connection
// ----------------------------------------------------------------------------

/** The database every administration statement goes to. */
export const ADMIN_DATABASE = 'postgres';

/**
 * DATABASE_URL's protocol, host, port and credentials, on the server's
 * `postgres` database.
 *
 * BUILT FROM THE PARTS THAT CARRY OVER, rather than by editing the named URL:
 * its database, its query string and its fragment are not copied, so neither
 * the path nor a `?database=` / `?dbname=` / `?db=` parameter (which some
 * clients read as the database, scratch-database.mjs) can name `frontalier`
 * on this connection.
 */
export function adminDatabaseUrl(databaseUrl) {
  const named = new URL(String(databaseUrl));
  const admin = new URL(`${named.protocol}//${named.host}/${ADMIN_DATABASE}`);

  admin.username = named.username;
  admin.password = named.password;

  return admin.toString();
}

/**
 * The admin connection for the log, credentials masked, never printed.
 *
 * DERIVED FROM THE URL administer() OPENS, not built beside it: the R958 plant
 * reverted the derivation, and the real server refused a connection to the
 * named database while a target built on its own still printed `postgres`.
 */
export function adminTarget(databaseUrl) {
  const admin = new URL(adminDatabaseUrl(databaseUrl));
  const credentials = admin.username === '' && admin.password === '' ? '' : '<credentials>@';

  return `${admin.protocol}//${credentials}${admin.host}${admin.pathname}`;
}

/**
 * DATABASE_URL pointed at the scratch database, everything else kept - the
 * connection string db:deploy, test:db and the production write have always
 * been handed (R959).
 */
export function scratchDatabaseUrl(databaseUrl, database) {
  const scratch = new URL(String(databaseUrl));

  scratch.pathname = `/${database}`;

  return scratch.toString();
}

/** node-postgres, loaded only when a statement is actually sent. */
async function openWithPg(connectionString) {
  const { Client } = await import('pg');
  const client = new Client({ connectionString });

  await client.connect();

  return client;
}

/**
 * Run administration statements on the admin connection, in order, and only
 * there. `connect` opens a client for a connection string; a test injects one
 * to read the URL this opens and every statement it sends.
 *
 * The connection is closed whether or not a statement is refused, and a
 * refusal is never swallowed.
 */
export async function administer(databaseUrl, statements, connect = openWithPg) {
  const client = await connect(adminDatabaseUrl(databaseUrl));

  try {
    for (const statement of statements) {
      await client.query(statement);
    }
  } finally {
    await client.end();
  }
}
