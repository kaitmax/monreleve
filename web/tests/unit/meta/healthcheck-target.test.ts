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
//
// ============================================================================
// R844: "COOLIFY'S DEPLOY CHECK RUNS ONCE" IS NOT WHAT COOLIFY 4.5.0 DOES
// ============================================================================
//
// The first paragraph above was written from memory, and its first claim is
// wrong. Read from coollabsio/coolify at v4.5.0 (FW-READY-GATE):
//
//   - THERE IS NO ONE-SHOT RELEASE PROBE. The deploy gate only reads Docker's
//     own health status of the new container - `docker inspect
//     .State.Health.Status` - start_period first, then retries times, interval
//     apart (app/Jobs/ApplicationDeploymentJob.php 2743-2792).
//   - WHEN COOLIFY'S OWN CHECK IS IN EFFECT it is written into the generated
//     compose as the service's healthcheck (same file, 4198-4212), which
//     replaces this image's HEALTHCHECK FOR THE CONTAINER'S WHOLE LIFE - and
//     Traefik stops routing to a container whose health is not "healthy".
//   - WHILE THIS DOCKERFILE CARRIES A HEALTHCHECK, Coolify uses it instead,
//     as both the release gate and the life-long probe (Application.php
//     2704-2743; the job, 2727 and 4198).
//
// So the conclusion above is stronger than it knew: the two "different
// checks" are the same Docker healthcheck, which is exactly why this one must
// stay on liveness. The rest is in docs/deploy.md section 3.

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

/**
 * One option's value, read off the HEALTHCHECK instruction.
 *
 * Anchored on whitespace so `--interval` can never be read out of
 * `--start-interval`: the two names share a suffix, and a bare substring match
 * would return whichever came first.
 */
function option(name: string): string | undefined {
  const flags = healthcheck().split(/\sCMD\s/)[0] ?? '';

  return new RegExp(`(?:^|\\s)--${name}=(\\S+)`).exec(flags)?.[1];
}

describe('R846: the start window is a stated value, not an inherited one', () => {
  // R345: STATE THE VALUE AND ASSERT THE VALUE. "Has a start period" is
  // satisfied by the 20s this replaced; the ruling is "at least 60s", and the
  // number chosen is the number held here.
  it('gives the container a start period of 60 seconds', () => {
    expect(option('start-period')).toBe('60s');
  });

  it('probes every 2 seconds during that window', () => {
    // A SHORT START INTERVAL is what keeps the long start period from costing
    // the container anything: it is marked healthy within ~2s of answering,
    // rather than at the first 10s tick. Docker >= 25 on both engines
    // (server 29.7.1, local 29.6.1, measured 2026-11-11).
    expect(option('start-interval')).toBe('2s');
  });

  it('keeps the steady-state values it had', () => {
    expect([option('interval'), option('timeout'), option('retries')]).toEqual(['10s', '5s', '3']);
  });
});

describe('R844: what Coolify 4.5.0 reads back from this instruction', () => {
  // COOLIFY COPIES THESE VALUES INTO ITS OWN DEPLOY WAIT. While its health
  // check is disabled and the Dockerfile carries a HEALTHCHECK, every deploy
  // parses this instruction (app/Models/Application.php 2704-2743 at v4.5.0),
  // sets custom_healthcheck_found, and then sleeps start_period before polling
  // Docker's health status `retries` times, `interval` apart
  // (app/Jobs/ApplicationDeploymentJob.php 2743-2792). So these four numbers
  // are the release window, and they are read here with Coolify's patterns -
  // quoted from Application.php 2723-2726 - rather than with ours.
  const COOLIFY = {
    interval: /--interval=([0-9]+[a-zµ]*)/,
    timeout: /--timeout=([0-9]+[a-zµ]*)/,
    startPeriod: /--start-period=([0-9]+[a-zµ]*)/,
    retries: /--retries=(\d+)/,
  };

  it('reads interval 10s, timeout 5s, start period 60s and retries 3', () => {
    const line = healthcheck();
    const read = Object.fromEntries(
      Object.entries(COOLIFY).map(([key, pattern]) => [key, pattern.exec(line)?.[1]]),
    );

    // THE INTERVAL IS THE ONE THAT COULD GO WRONG: Coolify has no start
    // interval of its own, and a pattern that captured "2s" here would make
    // it poll five times faster than the steady-state probe runs.
    expect(read).toEqual({ interval: '10s', timeout: '5s', startPeriod: '60s', retries: '3' });
  });
});
