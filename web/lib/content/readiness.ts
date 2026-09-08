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

import { servingWithoutOrigin } from './site';

export interface ReadinessCheck {
  /** Stable identifier, safe to alert on. */
  readonly name: string;
  readonly ok: boolean;
  /** Present when the check failed: what is wrong and what to set. */
  readonly detail?: string;
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

/**
 * Every readiness check, passing ones included.
 *
 * Reporting the passes matters as much as the failures: a deploy log that
 * lists which checks RAN is what makes it possible to notice one silently
 * ceasing to be evaluated. The same reason the contrast audit reports its own
 * coverage rather than only its violations.
 */
export function readiness(): Readiness {
  const checks: ReadinessCheck[] = [
    servingWithoutOrigin()
      ? { name: 'site-origin', ok: false, detail: ORIGIN_DETAIL }
      : { name: 'site-origin', ok: true },
  ];

  // The database check belongs here when there is a database (FW12 onward).
  // Deliberately not stubbed: a check that always passes is indistinguishable
  // from a check nobody wrote, and it would make `ready` mean less than it
  // says.

  return { ready: checks.every((check) => check.ok), checks };
}
