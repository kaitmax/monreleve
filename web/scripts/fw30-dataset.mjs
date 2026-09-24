// web/scripts/fw30-dataset.mjs
//
// FW30 increment 1 - the dataset every other measurement in the audit needs.
//
// WHY IT EXISTS. Every measurement this project had taken before tonight was
// against a 261-row demo year for one user. That is a screenshot, not a load,
// and several of the questions FW30 asks only have answers at volume. This
// builds the shape the product would actually meet in 2036 and leaves it in
// place so the rest of the audit measures against one known fixture.
//
// IT GENERATES AND MEASURES. It concludes nothing: every judgement about what
// the numbers mean belongs in the report, not here.
//
// R197: each user is a CONSISTENT SCENARIO rather than noise. A row that could
// not exist in the product teaches nothing when a query is slow against it.
//
// It is committed so the measurements can be reproduced:
//   node scripts/fw30-dataset.mjs
// It drops and recreates its own database and touches nothing else.

import { execFileSync } from 'node:child_process';

const PASSWORD = 'frontalier';
const CONTAINER = 'frontalier-postgres';
const DB = 'monreleve_fw30';
const HOST_PORT = 5436;
const serverBase = `postgresql://frontalier:${PASSWORD}@localhost:${HOST_PORT}`;

function psql(sql, database = 'postgres') {
  return execFileSync(
    'docker',
    [
      'exec',
      '-e',
      `PGPASSWORD=${PASSWORD}`,
      CONTAINER,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-t',
      '-A',
      '-d',
      `postgresql://frontalier:${PASSWORD}@127.0.0.1:5432/${database}`,
      '-c',
      sql,
    ],
    { encoding: 'utf8', timeout: 900_000, maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

const step = (label, fn) => {
  const started = process.hrtime.bigint();
  const out = fn();
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  console.log(`  ${label.padEnd(48)} ${ms.toFixed(0).padStart(7)} ms`);
  return out;
};

console.log(`\n=== FW30 dataset: ${DB} ===\n`);

psql(`DROP DATABASE IF EXISTS ${DB}`);
psql(`CREATE DATABASE ${DB}`);

execFileSync('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
  stdio: 'ignore',
  env: { ...process.env, DATABASE_URL: `${serverBase}/${DB}?schema=public` },
  timeout: 600_000,
});

// ---------------------------------------------------------------------------
// 200 users, each a coherent scenario rather than a random field soup.
//
// The modulus picks a scenario; every field then follows FROM that scenario,
// so an EXACT denominator always carries exactTotalWorkDays (which the R196
// CHECK constraint requires anyway) and a part-timer has a rate below 100.
// ---------------------------------------------------------------------------
step('200 users, each a consistent scenario', () =>
  psql(
    `INSERT INTO "User" (
       id, email, canton, name, "employmentRate",
       "denominatorKind", "exactTotalWorkDays",
       granularity, "loggingMode", "detectionConsentAt",
       "reminderTime", "reminderEnabled"
     )
     SELECT
       'fw30-u' || i,
       'fw30-' || i || '@example.com',
       (ARRAY['GE','VD','VS','NE','JU','BE'])[1 + (i % 6)],
       'Fixture ' || i,
       CASE i % 5 WHEN 0 THEN 50 WHEN 1 THEN 80 ELSE 100 END,
       (CASE WHEN i % 4 = 0 THEN 'EXACT' ELSE 'SIMPLIFIED240' END)::"DenominatorKind",
       CASE WHEN i % 4 = 0 THEN 220 + (i % 40) ELSE NULL END,
       (CASE WHEN i % 3 = 0 THEN 'HALF_DAY' ELSE 'DAY' END)::"LogGranularity",
       (CASE WHEN i % 7 = 0 THEN 'AUTO_DETECT' ELSE 'MANUAL' END)::"LoggingMode",
       CASE WHEN i % 7 = 0 THEN now() ELSE NULL END,
       '17:30',
       (i % 3 = 0)
     FROM generate_series(1, 200) AS i`,
    DB,
  ),
);

// THE NAMED SCENARIO USERS ARE PINNED, because R197 asks for a CONSISTENT
// scenario and the modulus above does not know which users the rest of the
// audit will drive. The first version left fw30-u1 on an 80 % rate while
// giving it a full-time ten-year history, and the engine refused the dossier
// with DAYS_EXCEED_TOTAL - correctly. A part-timer who records 261 full days
// is not a load, it is a contradiction, and every measurement taken against
// it would have been measuring the contradiction.
step('pin the named scenario users to coherent settings', () =>
  psql(
    `UPDATE "User"
     SET "employmentRate" = 100,
         "denominatorKind" = 'SIMPLIFIED240',
         "exactTotalWorkDays" = NULL
     WHERE id IN ('fw30-u1','fw30-u2','fw30-u3','fw30-u4','fw30-u5')`,
    DB,
  ),
);

// ---------------------------------------------------------------------------
// TEN YEARS for fw30-u1. ~2 600 working days: what somebody who starts in
// 2026 is carrying in 2036.
// ---------------------------------------------------------------------------
step('ten years of entries for fw30-u1', () =>
  psql(
    // detectedKind is NOT NULL whenever provenance is not MANUAL - the
    // Entry_detectedKind_when_detected constraint, which refused the first
    // version of this fixture. CONFIRMED means the detection was right, so
    // detectedKind equals kind; CORRECTED means the reader changed it, so it
    // differs.
    `INSERT INTO "Entry" (
       id, "userId", "dayDate", kind, "clientMutationId",
       provenance, "detectedKind", "detectedAt", "updatedAt"
     )
     SELECT 'fw30-e' || row_number() OVER (),
            'fw30-u1',
            d::date,
            k.kind::"EntryKind",
            'fw30-m' || row_number() OVER (),
            k.prov::"Provenance",
            CASE k.prov
              WHEN 'MANUAL' THEN NULL
              WHEN 'DETECTED_CONFIRMED' THEN k.kind::"EntryKind"
              ELSE (CASE WHEN k.kind = 'CH' THEN 'HOME' ELSE 'CH' END)::"EntryKind"
            END,
            CASE WHEN k.prov = 'MANUAL' THEN NULL ELSE d END,
            now()
     FROM generate_series(DATE '2016-01-01', DATE '2025-12-31', INTERVAL '1 day') AS d
     CROSS JOIN LATERAL (
       SELECT (ARRAY['CH','HOME','MISSION_FR','MISSION_THIRD'])[1 + (extract(doy from d)::int % 4)] AS kind,
              (ARRAY['MANUAL','DETECTED_CONFIRMED','DETECTED_CORRECTED'])[1 + (extract(doy from d)::int % 3)] AS prov
     ) AS k
     WHERE extract(isodow from d) < 6`,
    DB,
  ),
);

// One event per entry, plus a MODIFIED event on every fifth - so the trail is
// longer than the entry table, which is what an append-only log looks like
// after ten years of corrections.
step('entry events for the ten-year user (2 600+)', () => {
  psql(
    `INSERT INTO "EntryEvent" (id, "userId", "entryId", action, kind, provenance, "dayDate", portion)
     SELECT 'fw30-ev-c-' || e.id, e."userId", e.id, 'CREATED', e.kind, e.provenance, e."dayDate", e.portion
     FROM "Entry" e WHERE e."userId" = 'fw30-u1'`,
    DB,
  );

  return psql(
    `INSERT INTO "EntryEvent" (id, "userId", "entryId", action, kind, provenance, "dayDate", portion)
     SELECT 'fw30-ev-m-' || e.id, e."userId", e.id, 'MODIFIED', e.kind, e.provenance, e."dayDate", e.portion
     FROM "Entry" e
     WHERE e."userId" = 'fw30-u1' AND extract(doy from e."dayDate")::int % 5 = 0`,
    DB,
  );
});

// ---------------------------------------------------------------------------
// A HALF-DAY year at double the rows, on fw30-u2.
// ---------------------------------------------------------------------------
step('half-day year at double the rows (fw30-u2)', () => {
  psql(`UPDATE "User" SET granularity = 'HALF_DAY' WHERE id = 'fw30-u2'`, DB);

  return psql(
    `INSERT INTO "Entry" (id, "userId", "dayDate", portion, kind, "clientMutationId", "updatedAt")
     SELECT 'fw30-h' || row_number() OVER (),
            'fw30-u2', d::date, p::"EntryPortion",
            (ARRAY['CH','HOME'])[1 + (extract(doy from d)::int % 2)]::"EntryKind",
            'fw30-hm' || row_number() OVER (), now()
     FROM generate_series(DATE '2026-01-01', DATE '2026-12-31', INTERVAL '1 day') AS d
     CROSS JOIN unnest(ARRAY['AM','PM']) AS p
     WHERE extract(isodow from d) < 6`,
    DB,
  );
});

// ---------------------------------------------------------------------------
// 5 000 alert subscriptions. A real list, in every state the purge and the
// send have to cope with: confirmed, unconfirmed-and-fresh,
// unconfirmed-and-older-than-thirty-days, and unsubscribed.
// ---------------------------------------------------------------------------
step('5 000 alert subscriptions, in four states', () =>
  psql(
    `INSERT INTO "AlertSubscriber" (
       id, email, source,
       "confirmationTokenHash", "unsubscribeTokenHash",
       "confirmationExpiresAt", "confirmedAt", "unsubscribedAt", "createdAt"
     )
     SELECT
       'fw30-s' || i,
       'fw30-sub-' || i || '@example.com',
       (ARRAY['calculateur','alertes','guide'])[1 + (i % 3)],
       CASE WHEN i % 4 = 0 THEN NULL ELSE encode(sha256(('c' || i)::bytea), 'hex') END,
       encode(sha256(('u' || i)::bytea), 'hex'),
       CASE WHEN i % 4 = 0 THEN NULL ELSE now() + INTERVAL '7 days' END,
       CASE WHEN i % 4 = 0 THEN now() - INTERVAL '90 days' ELSE NULL END,
       CASE WHEN i % 20 = 0 THEN now() - INTERVAL '5 days' ELSE NULL END,
       CASE WHEN i % 4 = 1 THEN now() - INTERVAL '45 days' ELSE now() - INTERVAL '3 days' END
     FROM generate_series(1, 5000) AS i`,
    DB,
  ),
);

// ---------------------------------------------------------------------------
// PATHOLOGICAL BUT WITHIN THE CONTRACT. Every row here satisfies the CHECK
// constraints and could be produced by the API; none is malformed data.
// ---------------------------------------------------------------------------
step('pathological-but-legal rows', () => {
  // A name that is a spreadsheet formula, a quote storm and an RTL override.
  psql(
    `UPDATE "User" SET name = '=1+1+cmd|''/c calc''!A1 "' || repeat('a', 180) || '" ' || chr(8238)
     WHERE id = 'fw30-u3'`,
    DB,
  );

  // Every absence reason, each legal only with a reason present (R196).
  psql(
    `INSERT INTO "Entry" (id, "userId", "dayDate", kind, "absenceReason", "clientMutationId", "updatedAt")
     SELECT 'fw30-a' || i, 'fw30-u3', (DATE '2026-03-01' + i)::date, 'ABSENT',
            (ARRAY['CONGE','MALADIE','FERIE','AUTRE'])[1 + (i % 4)]::"AbsenceReason",
            'fw30-am' || i, now()
     FROM generate_series(1, 40) AS i
     WHERE extract(isodow from (DATE '2026-03-01' + i)) < 6`,
    DB,
  );

  // A 10 000-character note, and a note carrying every kind of whitespace
  // the renderer and the CSV writer have to survive: tab, CR, LF, NBSP,
  // narrow NBSP, line separator, zero-width space.
  psql(`UPDATE "Entry" SET note = repeat('Zurich ', 1429) WHERE id = 'fw30-a2'`, DB);
  psql(
    `UPDATE "Entry" SET note =
       'tab' || chr(9) || 'cr' || chr(13) || 'lf' || chr(10) ||
       'nbsp' || chr(160) || 'narrow' || chr(8239) ||
       'linesep' || chr(8232) || 'zwsp' || chr(8203) || 'end'
     WHERE id = 'fw30-a3'`,
    DB,
  );

  // AN ENTRY AT EACH DST BOUNDARY, both directions, in Europe/Paris.
  // dayDate is a DATE, so this is about what the renderer and the exporter do
  // with a day that is 23 or 25 hours long in the product's timezone.
  psql(
    `INSERT INTO "Entry" (id, "userId", "dayDate", kind, "clientMutationId", "updatedAt")
     VALUES
       ('fw30-dst-spring', 'fw30-u3', DATE '2026-03-29', 'CH', 'fw30-dst-1', now()),
       ('fw30-dst-autumn', 'fw30-u3', DATE '2026-10-25', 'CH', 'fw30-dst-2', now())`,
    DB,
  );

  // A YEAR WITH EVERY WORKING DAY ABSENT (fw30-u4) - a denominator of zero
  // worked days, which is the division the engine must not perform.
  psql(
    `INSERT INTO "Entry" (id, "userId", "dayDate", kind, "absenceReason", "clientMutationId", "updatedAt")
     SELECT 'fw30-abs' || row_number() OVER (), 'fw30-u4', d::date, 'ABSENT', 'MALADIE',
            'fw30-absm' || row_number() OVER (), now()
     FROM generate_series(DATE '2026-01-01', DATE '2026-12-31', INTERVAL '1 day') AS d
     WHERE extract(isodow from d) < 6`,
    DB,
  );

  // fw30-u5 IS LEFT WITH NO ENTRIES AT ALL, deliberately: the empty dossier
  // is a real state and the one most likely to divide by zero.
  return 'ok';
});

// ANALYZE BEFORE READING ANY PLAN. Without it the planner is working from
// the defaults it assumes for an empty table - it estimated 9 rows where
// there were 2 609 - and a plan chosen on those estimates is not the plan
// production would choose. Reporting one would be measuring the fixture's
// freshness rather than the product.
step('ANALYZE, so the plans below are the real ones', () => psql('ANALYZE', DB));

console.log('');

const counts = {
  users: psql(`SELECT count(*) FROM "User"`, DB),
  entries: psql(`SELECT count(*) FROM "Entry"`, DB),
  events: psql(`SELECT count(*) FROM "EntryEvent"`, DB),
  subscribers: psql(`SELECT count(*) FROM "AlertSubscriber"`, DB),
  tenYearUser: psql(`SELECT count(*) FROM "Entry" WHERE "userId"='fw30-u1'`, DB),
  halfDayYear: psql(`SELECT count(*) FROM "Entry" WHERE "userId"='fw30-u2'`, DB),
  allAbsentYear: psql(`SELECT count(*) FROM "Entry" WHERE "userId"='fw30-u4'`, DB),
  emptyUser: psql(`SELECT count(*) FROM "Entry" WHERE "userId"='fw30-u5'`, DB),
  longestNote: psql(`SELECT coalesce(max(length(note)), 0) FROM "Entry"`, DB),
};

console.log('=== shape ===');
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k.padEnd(16)} ${String(v).padStart(8)}`);
}

// ---------------------------------------------------------------------------
// THE QUERIES THE PRODUCT ACTUALLY RUNS, with their plans READ rather than
// assumed. EXPLAIN output is printed in full for the report.
// ---------------------------------------------------------------------------
const plans = [
  [
    'dossier: one year for the ten-year user',
    `SELECT * FROM "Entry"
     WHERE "userId" = 'fw30-u1' AND "dayDate" >= DATE '2025-01-01' AND "dayDate" <= DATE '2025-12-31'
     ORDER BY "dayDate"`,
  ],
  [
    'account export: the WHOLE history, no year bound',
    `SELECT * FROM "Entry" WHERE "userId" = 'fw30-u1' ORDER BY "dayDate"`,
  ],
  [
    'account export: the whole event trail',
    `SELECT * FROM "EntryEvent" WHERE "userId" = 'fw30-u1' ORDER BY "recordedAt"`,
  ],
  [
    'the alert send: every confirmed, not-unsubscribed row',
    `SELECT * FROM "AlertSubscriber" WHERE "confirmedAt" IS NOT NULL AND "unsubscribedAt" IS NULL`,
  ],
  [
    'the purge: unconfirmed rows older than thirty days',
    `SELECT * FROM "AlertSubscriber" WHERE "confirmedAt" IS NULL AND "createdAt" < now() - INTERVAL '30 days'`,
  ],
];

for (const [label, sql] of plans) {
  console.log(`\n=== query plan: ${label} ===`);
  for (const line of psql(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, DB).split('\n')) {
    console.log(`  ${line}`);
  }
}

console.log(`\ndatabase left in place for the rest of the audit: ${DB}`);
console.log(`DATABASE_URL=${serverBase}/${DB}?schema=public\n`);
