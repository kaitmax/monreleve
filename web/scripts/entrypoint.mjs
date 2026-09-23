// web/scripts/entrypoint.mjs
//
// ============================================================================
// RULING R250: THE IMAGE REFUSES TO START ON A PLACEHOLDER
// ============================================================================
//
// This runs BEFORE `node server.js`, and that position is the whole design.
//
// WHY NOT instrumentation.ts, WHICH IS THE OTHER STARTUP HOOK. That file
// carries an explicit, reasoned invariant - IT NEVER THROWS - because
// `register()` runs before the server accepts requests and an exception there
// takes the whole application down: "a scheduler that will not start is a
// product with no reminders; a web server that will not start is a product
// with nothing at all." Making it throw would contradict a decision somebody
// already made for a stated reason.
//
// There is no conflict once the two are separated. A failure HERE means the
// server process is never created, so the invariant about a running server is
// untouched. Coolify sees the container exit immediately, the deploy does not
// go out, and THE RUNNING VERSION KEEPS SERVING - which is the same outcome
// R83 wants from a 503 on /api/ready, arrived at one step earlier and without
// a crash-loop.
//
// ============================================================================
// WHAT IT REFUSES, AND WHAT IT DELIBERATELY DOES NOT
// ============================================================================
//
//   a PLACEHOLDER, at any severity      refuse
//   a REQUIRED variable absent          refuse
//   a DEGRADABLE variable absent        START, and say so
//
// The third is the one worth defending. The product has designed degraded
// behaviour for an absent credential - the mailer collects in memory, the
// push sender declines to schedule the reminder and reports it by name,
// /api/ready answers 503 without NEXT_PUBLIC_SITE_URL - and each of those is
// legible. Turning them into a crash would convert "this deploy did not go
// out" into a crash-loop, which is strictly worse and is exactly what R83
// argues against: an orchestrator RESTARTS what fails liveness, and a restart
// cannot supply a missing environment variable.
//
// A placeholder is not that. It presents as configured, so every naive check
// passes, and the discovery otherwise happens when a reader first uses the
// feature - later, quietly, in production.
//
// ============================================================================
// IT NEVER PRINTS A VALUE
// ============================================================================
//
// Only names and verdicts. A container log is a place things get pasted from,
// and an entrypoint that helpfully echoed the secret it was complaining about
// would be a credential-disclosure bug inside the credential guard.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  classifyEnvironment,
  classifyOrigin,
  describeEnvironment,
} from '../lib/deploy/placeholders.mjs';

const report = classifyEnvironment(process.env);

console.log('\n[entrypoint] deployment environment (R250):');
console.log(describeEnvironment(report));

// ============================================================================
// THE IMAGE IS ENVIRONMENT-SPECIFIC, AND THIS IS WHERE THAT IS ENFORCED
// ============================================================================
//
// Static routes bake their canonicals during `next build`, so the origin the
// image was BUILT for is part of the artefact. Running a staging image with a
// production origin serves production traffic with staging canonicals -
// correct in every test, invisible in every log, expensive in search.
//
// Measured before it was guarded: an image built without the origin failed 41
// of 284 e2e specs while the same source under `next start` passed all 284.
function bakedOrigin() {
  try {
    return readFileSync('/etc/frontalier-site-origin', 'utf8');
  } catch {
    // R133: "could not look" is not "found nothing".
    return null;
  }
}

const baked = bakedOrigin();
const originVerdict = classifyOrigin(baked, process.env.NEXT_PUBLIC_SITE_URL);

if (originVerdict === 'mismatch' || originVerdict === 'unbuilt') {
  console.error('\n  THIS CONTAINER WILL NOT START (R250).');
  console.error('');
  console.error(
    originVerdict === 'mismatch'
      ? `    NEXT_PUBLIC_SITE_URL is ${JSON.stringify(
          (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim(),
        )} but this image was BUILT for ${JSON.stringify((baked ?? '').trim())}.`
      : `    NEXT_PUBLIC_SITE_URL is ${JSON.stringify(
          (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim(),
        )} but this image was built with NO origin.`,
  );
  console.error('');
  console.error('    Static routes bake their canonicals at build time, so this image');
  console.error('    already serves the wrong ones and no runtime value can change that.');
  console.error('    Rebuild with --build-arg NEXT_PUBLIC_SITE_URL=<the origin>.');
  console.error('\n[entrypoint] refusing to start (R250).\n');
  process.exit(1);
}

if (originVerdict === 'unknown') {
  console.log('\n  origin: this image records no build origin - it predates the check (R133).');
}

if (!report.mayServe) {
  // R198: the refusal is labelled by the rule that raised it, and the exit
  // code is non-zero so an orchestrator treats it as the failure it is.
  console.error('\n[entrypoint] refusing to start (R250).\n');
  process.exit(1);
}

console.log('\n[entrypoint] starting the server.\n');

// ============================================================================
// SIGNALS ARE FORWARDED, BECAUSE THIS PROCESS IS PID 1
// ============================================================================
//
// A container's PID 1 receives SIGTERM when the orchestrator stops it. Without
// forwarding, `node server.js` never hears it, the ten-second grace period
// expires and the container is SIGKILLed - which on this product means an
// in-flight PDF render is torn down mid-write and pg-boss's worker never gets
// to release its jobs.
//
// R179's shape, one layer out: a harness kills the tree it spawned. Here the
// tree is the actual product.
const child = spawn(process.execPath, ['server.js'], { stdio: 'inherit' });

// NAMED ONE AT A TIME rather than looped. A `for (const s of ['SIGTERM', ...])`
// widens each to `string`, which is not Node's `Signals` union, and
// tsconfig.scripts.json typechecks this file. Two lines beats a cast.
process.on('SIGTERM', () => {
  if (!child.killed) child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  if (!child.killed) child.kill('SIGINT');
});

child.on('exit', (code, signal) => {
  // A child killed by a signal exits with no code. Reporting 0 there would
  // tell the orchestrator a SIGKILLed server shut down cleanly.
  if (signal !== null) {
    process.exit(128 + (signal === 'SIGTERM' ? 15 : 2));
  }

  process.exit(code ?? 1);
});

child.on('error', (cause) => {
  console.error('[entrypoint] could not start the server:', cause);
  process.exit(1);
});
