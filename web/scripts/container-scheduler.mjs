// web/scripts/container-scheduler.mjs
//
// ============================================================================
// TWO CONTAINERS, ONE DATABASE: IS THE WORK DISTRIBUTED OR DUPLICATED?
// ============================================================================
//
// `globalThis` is per-PROCESS. The guard in lib/scheduler/boss.ts stops a
// second scheduler inside one process - which is what hot reload produces -
// and says nothing whatever about a second CONTAINER. Two replicas are two
// schedulers by construction, and the question that matters is not "how many
// schedulers" but "how many times does the work happen".
//
// THIS MEASURES IT RATHER THAN REASONING ABOUT IT (R249). Two containers are
// started against one database, N jobs are enqueued from the host, and the
// executions are COUNTED out of both containers' logs.
//
//   duplicated  2N executions - every job runs in both replicas
//   distributed N executions, split across the two
//
// ============================================================================
// WHY NOT AN ADVISORY LOCK, WHICH IS THE OBVIOUS ANSWER
// ============================================================================
//
// A pg_advisory_lock held on the session would elect one scheduler. A
// container that dies without releasing it keeps the lock until its
// connection is reaped, so the survivor silently never schedules - and that
// failure is INDISTINGUISHABLE FROM WORKING, because the dead container had
// been doing the job. The symptom arrives days later as "the reminders
// stopped", with nothing in any log.
//
// The product needs no such lock. Every claim in this system is a UNIQUE ROW:
// ReminderSent is keyed (userId, sentOn), so the second container to try a
// day loses on the constraint and reports `already-sent` BY NAME. A dead
// container releases nothing because it holds nothing.
//
// ============================================================================
// WHY THE PURGE QUEUE AND NOT THE REMINDER
// ============================================================================
//
// The reminder queue is registered only where a push sender exists (R205), and
// a production container with no Firebase credentials deliberately does not
// register it - R250 forbids this task from obtaining any. The purge needs
// nothing but a database and is registered in every replica, so it is the
// queue that can actually answer the question. What is being measured is
// pg-boss's distribution, which is queue-independent.

import { execFileSync } from 'node:child_process';
// A NAMED IMPORT. pg-boss 12 has no default export, which lib/scheduler/boss.ts
// already records - and this script walked into it anyway.
import { PgBoss } from 'pg-boss';

const IMAGE = process.env.CONTAINER_IMAGE ?? 'monreleve:e2e';
const DB = 'monreleve_scheduler_probe';
const NAMES = ['monreleve-sched-a', 'monreleve-sched-b'];
const JOBS = 6;

const PG_USER = 'frontalier';
const PG_PASSWORD = 'frontalier';
/**
 * A database the caller already has (CI), or none (locally).
 *
 * Same shape as container-e2e.mjs: R251 says the answer to "CI cannot run
 * this" is a mechanism, not an exemption, and the only thing CI lacks is the
 * compose container this would otherwise create a scratch database inside.
 */
const SUPPLIED = process.env.CONTAINER_SCHEDULER_DATABASE_URL;

const hostUrl =
  SUPPLIED ?? `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:5436/${DB}?schema=public`;
const containerUrl =
  SUPPLIED === undefined
    ? `postgresql://${PG_USER}:${PG_PASSWORD}@host.docker.internal:5436/${DB}?schema=public`
    : SUPPLIED.replace('@localhost:', '@host.docker.internal:').replace(
        '@127.0.0.1:',
        '@host.docker.internal:',
      );

/** The queue name, read from the module rather than retyped (R206). */
const PURGE_QUEUE = 'purge-unconfirmed';

function run(file, args, options = {}) {
  return execFileSync(file, args, { encoding: 'utf8', timeout: 600_000, ...options });
}

function psql(sql) {
  return run('docker', [
    'exec',
    '-e',
    `PGPASSWORD=${PG_PASSWORD}`,
    'frontalier-postgres',
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-d',
    `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:5432/postgres`,
    '-c',
    sql,
  ]);
}

function removeAll() {
  for (const name of NAMES) {
    try {
      run('docker', ['rm', '-f', name], { stdio: 'ignore' });
    } catch {
      // Not running is the ordinary case.
    }
  }
}

function logsOf(name) {
  try {
    return run('docker', ['logs', name], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return '';
  }
}

let failure = null;
let boss = null;

try {
  removeAll();

  console.log(`\n--- scratch database ${DB} ---`);
  if (SUPPLIED === undefined) {
    psql(`DROP DATABASE IF EXISTS ${DB}`);
    psql(`CREATE DATABASE ${DB}`);
  }

  run('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: hostUrl },
  });

  // ==========================================================================
  // THE ORIGIN IS READ OUT OF THE IMAGE, NOT RETYPED (R181)
  // ==========================================================================
  //
  // The entrypoint refuses to start when the origin it was BUILT for differs
  // from the one it is RUN with, because static routes bake their canonicals
  // at build time. This probe passed no origin at all on its first run and
  // both containers correctly refused - the sixth time in FW28 that a new
  // guard's first real signal came from the person who wrote it.
  //
  // Reading the recorded value means the probe cannot drift from the image
  // the way a copied constant would.
  const bakedOrigin = run('docker', [
    'run',
    '--rm',
    '--entrypoint',
    'cat',
    IMAGE,
    '/etc/frontalier-site-origin',
  ]).trim();

  console.log(`--- starting ${NAMES.length} containers against one database ---`);
  console.log(`    image origin: ${bakedOrigin === '' ? '(none)' : bakedOrigin}`);

  for (const name of NAMES) {
    run('docker', [
      'run',
      '-d',
      '--name',
      name,
      '--add-host',
      'host.docker.internal:host-gateway',
      '-e',
      `DATABASE_URL=${containerUrl}`,
      '-e',
      'AUTH_SECRET=scheduler-probe-not-a-deployment-secret',
      '-e',
      `NEXT_PUBLIC_SITE_URL=${bakedOrigin}`,
      // R243's door, opened deliberately: the image does not set this, so a
      // container run by hand stays quiet. This IS the deliberate lift.
      '-e',
      'FRONTALIER_SCHEDULER=1',
      IMAGE,
    ]);
  }

  // Both must be RUNNING their scheduler before anything is enqueued (R169's
  // presence-before-absence: "no duplicate executions" is satisfied perfectly
  // by two containers that never started).
  const ready = Date.now() + 120_000;
  const started = new Map();

  while (Date.now() < ready && started.size < NAMES.length) {
    for (const name of NAMES) {
      const log = logsOf(name);
      const match = /\[scheduler ([^\]]+)\] started as/u.exec(log);

      if (match !== null) started.set(name, match[1]);
    }
  }

  if (started.size < NAMES.length) {
    throw new Error(
      `only ${started.size} of ${NAMES.length} containers started their scheduler. ` +
        'A measurement of duplication needs two live schedulers, and this had fewer.',
    );
  }

  console.log('\nboth schedulers are up, and they name themselves (R244):');
  for (const [name, instance] of started) console.log(`  ${name}  ->  ${instance}`);

  // THE INSTANCE IDS MUST DIFFER, or the tag is decorative.
  const instances = [...started.values()];

  if (new Set(instances).size !== instances.length) {
    throw new Error(`both containers reported the same instance id: ${instances.join(', ')}`);
  }

  console.log(`\n--- enqueueing ${JOBS} jobs on ${PURGE_QUEUE} from the host ---`);

  boss = new PgBoss({ connectionString: hostUrl });
  await boss.start();

  for (let index = 0; index < JOBS; index += 1) {
    await boss.send(PURGE_QUEUE, {});
  }

  // Wait for the work to be done, then a little longer, because the question
  // is whether a SECOND execution arrives - and a check that stopped at N
  // could never see N+1.
  const deadline = Date.now() + 90_000;
  let counts = new Map();

  const tally = () => {
    const found = new Map();

    for (const name of NAMES) {
      const lines = logsOf(name)
        .split('\n')
        .filter((line) => line.includes('[purge] older than'));

      found.set(name, lines.length);
    }

    return found;
  };

  while (Date.now() < deadline) {
    counts = tally();

    if ([...counts.values()].reduce((a, b) => a + b, 0) >= JOBS) break;
  }

  // The settling window: if anything is going to run a job twice, it happens
  // after the first N have completed.
  const settle = Date.now() + 15_000;

  while (Date.now() < settle) counts = tally();

  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  console.log('\nexecutions, per container:');
  for (const [name, count] of counts) console.log(`  ${name}  ${count}`);
  console.log(`  total   ${total}   (enqueued ${JOBS})`);

  if (total !== JOBS) {
    failure =
      total > JOBS
        ? `${total} executions for ${JOBS} jobs - the work is DUPLICATED across replicas. ` +
          'Every reminder pass would run in every container.'
        : `${total} executions for ${JOBS} jobs - work was LOST.`;
  }

  // BOTH MUST HAVE DONE SOME. A total of N is also what one container
  // working and one sitting dead produces, and that is the advisory-lock
  // failure this design exists to avoid - it looks exactly like success.
  const idle = [...counts.entries()].filter(([, count]) => count === 0);

  if (failure === null && idle.length > 0) {
    failure =
      `${idle.map(([name]) => name).join(', ')} executed nothing. A correct total with an ` +
      'idle replica is the shape of a lock nobody released: it looks like success ' +
      'because the other container was doing the work.';
  }
} catch (cause) {
  failure = cause instanceof Error ? cause.message : String(cause);
} finally {
  if (boss !== null) {
    try {
      await boss.stop();
    } catch {
      // Stopping a scheduler that never started is not an error here.
    }
  }

  removeAll();

  if (SUPPLIED === undefined) {
    try {
      psql(`DROP DATABASE IF EXISTS ${DB}`);
    } catch (cause) {
      console.error(`could not drop ${DB}: ${cause instanceof Error ? cause.message : cause}`);
    }
  }
}

if (failure !== null) {
  console.error(`\nSCHEDULER PROBE FAILED: ${failure}\n`);
  process.exit(1);
}

// R133: A COUNT, NOT ONLY AN EXIT CODE. This suite HAS a number - four
// distinct claims: both schedulers started, their instance ids differ, the
// execution total equals the jobs enqueued, and no replica sat idle. "exit 0
// (no count to check)" is for tsc and eslint, which report success by saying
// nothing; a probe that measured something and reported only its exit status
// would be the silence R133 exists to refuse.
console.log('\nScheduler checks  4 passed (4)');
console.log(
  'SCHEDULER PROBE PASSED - two containers, one database, every job executed ' +
    'exactly once, and both replicas did some of it (R249).\n',
);
