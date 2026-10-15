// web/tests/unit/meta/healthcheck-target.test.ts
//
// FW-FOLLOWUP (R375): the container's own HEALTHCHECK probes LIVENESS.
//
// ============================================================================
// THE TWO CHECKS ARE DIFFERENT THINGS AND THE DOCKERFILE CONFLATED THEM
// ============================================================================
//
// There are two health checks in this deployment and only one of them is in
// the Dockerfile:
//
//   COOLIFY'S DEPLOY CHECK runs ONCE, when a new version is being released.
//   It must probe /api/ready, because a readiness failure should stop the
//   deploy and leave the running version serving. That is R83, and it is
//   configured in Coolify, not here.
//
//   THE CONTAINER'S OWN HEALTHCHECK runs every 10 seconds FOR THE LIFE OF THE
//   CONTAINER. It must probe /api/health, because what consumes it is a
//   restart or a routing decision - and an orchestrator RESTARTS what fails
//   liveness, while a restart cannot supply a missing environment variable or
//   bring a database back.
//
// The Dockerfile had the second one probing /api/ready, under a comment that
// cited R83 and described Coolify's check:
//
//     # The readiness endpoint, NOT liveness (R83). Coolify's DEPLOY health
//     # check points here: /api/ready returns 503 while degraded, ...
//
// R83's own second sentence says the opposite about this probe - "Wire the
// restart policy, if any, at /api/health" - so this was not a ruling being
// followed, it was one being half-applied to the wrong probe.
//
// ============================================================================
// WHY IT MATTERS NOW AND DID NOT BEFORE
// ============================================================================
//
// It was harmless while /api/ready could not fail at runtime. FW-READY
// (R353-R357) made /api/ready check the DATABASE, so a database outage now
// marks the serving container unhealthy every 10 seconds - and anything that
// routes or restarts on Docker health may then take the whole site down,
// including the pages R357 says must keep serving without a database.
//
// THE ARGUMENT DOES NOT DEPEND ON WHAT COOLIFY DOES with an unhealthy
// container, which is why this is a test and not an investigation. Whatever
// consumes the signal, a continuous probe is a liveness probe.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DOCKERFILE = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf8');

/** The HEALTHCHECK instruction and its command, which continues over a line. */
function healthcheck(): string {
  const lines = DOCKERFILE.split('\n');
  const start = lines.findIndex((line) => line.startsWith('HEALTHCHECK'));

  expect(start, 'the Dockerfile declares no HEALTHCHECK').toBeGreaterThan(-1);

  const collected = [lines[start] ?? ''];

  // A trailing backslash continues the instruction.
  for (let i = start; (lines[i] ?? '').trimEnd().endsWith('\\'); i += 1) {
    collected.push(lines[i + 1] ?? '');
  }

  return collected.join('\n');
}

describe('R375: the container healthcheck is a liveness probe', () => {
  it('probes /api/health', () => {
    expect(healthcheck()).toContain('/api/health');
  });

  it('does NOT probe /api/ready', () => {
    // BOTH DIRECTIONS (R196). "Contains /api/health" alone is satisfied by a
    // command that probes both, and by the old line if it ever grew a second
    // request - and the whole point is that the continuous probe must not be
    // able to fail on a degraded dependency.
    expect(healthcheck()).not.toContain('/api/ready');
  });

  it('still declares an interval, a timeout and retries', () => {
    // R345: these are values somebody chose. A HEALTHCHECK with none of them
    // inherits Docker's defaults, which is a different policy nobody wrote
    // down - and the image proof for this ruling is stated in terms of
    // interval x retries.
    const line = healthcheck();

    expect(line).toMatch(/--interval=\d+s/);
    expect(line).toMatch(/--timeout=\d+s/);
    expect(line).toMatch(/--retries=\d+/);
  });
});
