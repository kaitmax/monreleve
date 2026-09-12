// web/scripts/dev-routes.mjs
//
// RULING R129's two constants, in one place.
//
// The flag next.config.ts reads and the directory the dev-enabled build
// writes to. Shared rather than written twice because the failure mode of two
// copies is silent: check-budgets would measure `.next`, find the production
// build, report no dev routes, and pass GATE W and GATE I by having nothing
// to judge - which reads exactly like success.

/** The env var next.config.ts checks. Set only by the test and dev builds. */
export const DEV_ROUTES_FLAG = 'FRONTALIER_DEV_ROUTES';

/** Where the dev-enabled build goes. Never .next: R98. */
export const DEV_DIST_DIR = '.next-dev-routes';
