// web/lib/deploy/placeholders.mjs
//
// ============================================================================
// THE ONE HOME FOR EVERY PLACEHOLDER CREDENTIAL (R206)
// ============================================================================
//
// Where two places must say the same thing, ONE holds the text and the other
// holds a KEY. These four strings now have exactly one home, and everything
// that refuses them imports it:
//
//   lib/export/print-token.ts   re-exports PLACEHOLDER_SECRET
//   lib/push/fcm.ts             re-exports the three FCM values
//   scripts/entrypoint.mjs      refuses them BEFORE the server starts (R250)
//
// WHY THE ENTRYPOINT FORCED THIS. R250 requires the IMAGE to refuse to start
// on a placeholder, and the entrypoint runs before Next does - it cannot
// import a TypeScript module. The tempting answer was to type the four
// strings into the entrypoint and add a test asserting they match. R206
// forbids exactly that: "never two strings a test compares - because that
// test only proves they were equal when somebody last looked."
//
// WHY .mjs RATHER THAN .ts. This file is read by a plain `node` process with
// no compilation step, so it has to be JavaScript. TypeScript reads it
// through placeholders.d.mts, which tests/unit/meta/declaration-parity.test.ts
// asserts against this file's real exports (R185) rather than trusting.
//
// ============================================================================
// WHY A PLACEHOLDER IS WORSE THAN AN ABSENT VALUE
// ============================================================================
//
// An absent credential is legible: every "is this configured?" check says no,
// and each feature takes its designed degraded path - the mailer collects in
// memory, the push sender refuses to schedule, the print route answers
// `not_configured`.
//
// A PLACEHOLDER PRESENTS AS CONFIGURED. It is a value, it is a string, it has
// the right shape, and every naive check passes. `AUTH_SECRET` left at the
// value below is a signing key published in this repository - which is not a
// signing key at all, and the only reason it is survivable today is that
// print-token.ts compares against it BY VALUE and refuses.
//
// That per-module refusal is right and stays. What it cannot do is stop the
// deployment: each module discovers the problem when somebody first uses the
// feature, which in production is a reader, later, quietly. R250 moves the
// discovery to the one moment it costs nothing - before the container serves.

/** The value `.env.example` ships for AUTH_SECRET. */
export const PLACEHOLDER_SECRET = 'change-me-local-only-not-for-deployment';

/** The values `.env.example` ships for Firebase Cloud Messaging. */
export const PLACEHOLDER_PROJECT_ID = 'your-firebase-project-id';
export const PLACEHOLDER_CLIENT_EMAIL =
  'service-account@your-firebase-project-id.iam.gserviceaccount.com';
export const PLACEHOLDER_PRIVATE_KEY = 'REPLACE_WITH_THE_SERVICE_ACCOUNT_PRIVATE_KEY';

/**
 * Every variable a deployment supplies, with what it is and how it fails.
 *
 * ============================================================================
 * TWO SEVERITIES, AND THE SPLIT IS R83'S ARGUMENT, NOT A PREFERENCE
 * ============================================================================
 *
 *   'required'    absent OR placeholder stops the container starting. There
 *                 is no useful degraded behaviour: without DATABASE_URL there
 *                 is no product, and a restart cannot invent one.
 *   'degradable'  ABSENT is a designed state that the product reports through
 *                 /api/ready (503 while degraded) and through its own logs.
 *                 The container starts. A PLACEHOLDER still refuses, because
 *                 a placeholder is not a state the product designed for - it
 *                 is a misconfiguration wearing a configured value.
 *
 * R83 IS WHY 'degradable' DOES NOT CRASH. Readiness returning 503 stops a
 * deploy and leaves the running version serving, which is the outcome wanted;
 * liveness returns 200 whenever the process answers, because an orchestrator
 * RESTARTS what fails liveness and a restart cannot supply a missing variable.
 * Turning every absent variable into a crash would convert a clean "this
 * deploy did not go out" into a crash-loop, which is the worse failure and
 * the one R83 exists to avoid.
 *
 * `placeholder: null` means the variable has no published placeholder - there
 * is nothing to compare against, so only absence is a verdict.
 *
 * ============================================================================
 * `secret`: THE ONE HOME OF WHICH VARIABLES ARE SECRETS (R858, R206)
 * ============================================================================
 *
 * `secret: true` marks a value whose disclosure is a credential leak: a
 * password, a signing key, an API key. It decides one check today:
 * `pnpm test:container` fails when any secret NAME appears in the built
 * image's `docker history`, because a build argument is recorded there WITH
 * ITS VALUE (REPORT-FW-CHROMIUM.txt section 4 found two of these marked
 * build-time in Coolify). docs/deploy.md section 2 points here rather than
 * keeping a list of its own.
 *
 * `false` is a statement too, not a default: FCM_CLIENT_EMAIL names a service
 * account without being able to act as one, and the Android pair is
 * published by /.well-known/assetlinks.json itself. The set is asserted in
 * tests/unit/meta/env-contract.test.ts, so un-marking a secret - which would
 * quietly stop the history check looking for it - is a test failure.
 */
export const DEPLOYMENT_VARIABLES = Object.freeze([
  Object.freeze({
    name: 'DATABASE_URL',
    severity: 'required',
    placeholder: null,
    secret: true,
    what: 'PostgreSQL connection string; the entries table is the product',
  }),
  Object.freeze({
    name: 'AUTH_SECRET',
    severity: 'required',
    placeholder: PLACEHOLDER_SECRET,
    secret: true,
    what: 'signs the short-lived token that lets /releve/print render one year',
  }),
  Object.freeze({
    name: 'NEXT_PUBLIC_SITE_URL',
    severity: 'degradable',
    placeholder: null,
    secret: false,
    what: 'the absolute site origin; unset serves the localhost stand-in, and /api/ready answers 503',
  }),
  Object.freeze({
    name: 'RESEND_API_KEY',
    severity: 'degradable',
    placeholder: null,
    secret: true,
    what: 'unset collects confirmation mail in memory and delivers nothing',
  }),
  Object.freeze({
    name: 'FCM_PROJECT_ID',
    severity: 'degradable',
    placeholder: PLACEHOLDER_PROJECT_ID,
    secret: false,
    what: 'unset means the reminder job is not scheduled at all, which is reported by name',
  }),
  Object.freeze({
    name: 'FCM_CLIENT_EMAIL',
    severity: 'degradable',
    placeholder: PLACEHOLDER_CLIENT_EMAIL,
    secret: false,
    what: 'the service account the push assertion is signed as',
  }),
  Object.freeze({
    name: 'FCM_PRIVATE_KEY',
    severity: 'degradable',
    placeholder: PLACEHOLDER_PRIVATE_KEY,
    secret: true,
    what: 'the service account private key, newlines escaped as \\n',
  }),
  Object.freeze({
    name: 'ANDROID_PACKAGE_NAME',
    severity: 'degradable',
    placeholder: null,
    secret: false,
    what: 'unset withholds /.well-known/assetlinks.json entirely, which R205 requires',
  }),
  Object.freeze({
    name: 'ANDROID_SHA256_CERT_FINGERPRINTS',
    severity: 'degradable',
    placeholder: null,
    secret: false,
    what: 'the signing certificate fingerprints App Links verify against',
  }),
]);

/**
 * One variable's verdict: `ok`, `absent`, or `placeholder`.
 *
 * R198: THE TWO FAILURES ARE NAMED SEPARATELY because they send whoever is
 * reading the log to different places. `absent` means somebody has not
 * supplied a value; `placeholder` means somebody supplied THE EXAMPLE, which
 * is a different mistake with a different fix and a different urgency.
 *
 * An empty or whitespace-only string is ABSENT, not a value. A variable set
 * to "" in an orchestrator is the ordinary way a field gets cleared, and
 * treating it as configured would be the permissive default in the guard that
 * exists to catch a permissive default.
 */
export function classifyVariable(variable, raw) {
  if (raw === undefined || raw === null || raw.trim() === '') return 'absent';
  if (variable.placeholder !== null && raw.trim() === variable.placeholder) return 'placeholder';

  return 'ok';
}

/**
 * Every variable classified, and whether this environment may serve.
 *
 * PURE, so a test can reach every branch without a container (R233). The
 * entrypoint is the half that talks to process.env and exits.
 */
export function classifyEnvironment(env) {
  const results = DEPLOYMENT_VARIABLES.map((variable) => ({
    name: variable.name,
    severity: variable.severity,
    what: variable.what,
    verdict: classifyVariable(variable, env[variable.name]),
  }));

  // A PLACEHOLDER REFUSES AT EITHER SEVERITY. That is the whole of R250: the
  // example value is never a deployment's answer, whatever the variable is
  // for.
  const refusals = results.filter(
    (result) =>
      result.verdict === 'placeholder' ||
      (result.verdict === 'absent' && result.severity === 'required'),
  );

  const degraded = results.filter(
    (result) => result.verdict === 'absent' && result.severity === 'degradable',
  );

  return { results, refusals, degraded, mayServe: refusals.length === 0 };
}

/**
 * Does the origin this image was BUILT for match the one it is being RUN with?
 *
 * ============================================================================
 * WHY THIS EXISTS: 41 FAILURES, MEASURED
 * ============================================================================
 *
 * NEXT_PUBLIC_SITE_URL is read at runtime by the server bundle, so
 * /api/health reports whatever `docker run` passed and everything looks
 * correct. It is ALSO read during `next build`, when every static route's
 * <head> is rendered - and a canonical computed then is frozen into HTML that
 * no runtime value can reach.
 *
 * The e2e suite pointed at an image built without it failed 41 of 284 while
 * the same source under `next start` passed all 284. Correct CSS, correct
 * scripts, a correct /api/health, and zero canonicals.
 *
 * SO THE IMAGE IS ENVIRONMENT-SPECIFIC, and the failure this guards is
 * promoting a staging image to production: canonicals pointing at staging,
 * green in every test, invisible in every log.
 *
 * @returns {'ok'|'mismatch'|'unbuilt'|'unknown'}
 */
export function classifyOrigin(baked, runtime) {
  const built = (baked ?? '').trim();
  const running = (runtime ?? '').trim();

  // No record at all: an image built before this file existed, or by
  // something that is not the Dockerfile. R133 - "could not look" and "found
  // nothing" must not read alike.
  if (baked === null || baked === undefined) return 'unknown';

  // Built with no origin. Static canonicals are already missing, whatever is
  // passed now, so serving it anywhere that matters is wrong.
  if (built === '') return running === '' ? 'ok' : 'unbuilt';

  return built === running ? 'ok' : 'mismatch';
}

/** What the entrypoint prints. Pure, so a test can read it. */
export function describeEnvironment(report) {
  const lines = [];

  if (report.refusals.length > 0) {
    lines.push('');
    lines.push('  THIS CONTAINER WILL NOT START (R250).');
    lines.push('');

    for (const refusal of report.refusals) {
      lines.push(
        refusal.verdict === 'placeholder'
          ? `    ${refusal.name}: set to the PLACEHOLDER from .env.example.`
          : `    ${refusal.name}: ABSENT, and it is required.`,
      );
      lines.push(`      ${refusal.what}`);
    }

    lines.push('');
    lines.push('    A placeholder is not an absent value: it presents as configured,');
    lines.push('    so every naive check passes. Refusing here costs a failed deploy;');
    lines.push('    the running version keeps serving. Not refusing costs a reader.');
  }

  if (report.degraded.length > 0) {
    lines.push('');
    lines.push('  STARTING WITH DEGRADED FEATURES, which /api/ready reports:');

    for (const entry of report.degraded) lines.push(`    ${entry.name}: ${entry.what}`);
  }

  if (report.refusals.length === 0 && report.degraded.length === 0) {
    lines.push('');
    lines.push('  every deployment variable is supplied.');
  }

  return lines.join('\n');
}
