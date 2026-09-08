// web/lib/content/site.ts
//
// The absolute site origin. FW10 needs one in three places - metadataBase, the
// sitemap's absolute URLs, and robots.txt's sitemap reference - and no
// document decides which domain this product lives at. That is an open
// question gated at Checkpoint C (SPEC section 22).
//
// THE DECISION IS DEFERRED, THE MECHANISM IS NOT, which is the distinction
// ruling R77 draws: the chain should stop on decisions rather than on
// plumbing. Which domain is a decision and stays open. Whether the sitemap,
// the canonicals and robots.txt all read one constant is not a decision, and
// settling it now means Checkpoint C changes one environment variable instead
// of hunting three call sites.
//
// WHY THE DEFAULT IS localhost AND NOT A PLACEHOLDER DOMAIN. example.com, or
// the product name with a guessed TLD, would be a CLAIM - and a plausible one,
// which is worse, because a reader would not question it. localhost is the
// explicit absence of a domain and reads correctly as "undecided". It is also
// what the dev server uses anyway, so nothing has to be special-cased to make
// the build work today.
//
// WHAT THIS DOES *NOT* DO, AND WHY - because the first version of this file
// did it and was wrong.
//
// It used to THROW when the variable was unset and NODE_ENV was production,
// on the reasoning that a sitemap of localhost URLs is not provisional output
// but WRONG output: a crawler given it indexes nothing, and the failure is
// silent because the file is well-formed and every other gate is green.
//
// That reasoning is right about the risk and wrong about the trigger.
// `next build` sets NODE_ENV=production, so the guard fired on every LOCAL
// build - `pnpm build` is part of this project's Definition of Done - and no
// local build publishes anything. Measured: "Failed to collect page data
// for /".
//
// There is no intrinsic signal that separates "a build that will be served to
// the public" from "a production build on a laptop", and inventing one would
// be inventing a deploy contract that FW29 owns. So the absence is handled by
// being IMPOSSIBLE TO MISTAKE rather than by refusing to build: the fallback
// is localhost, which reads as undecided, and a provided value is still
// validated strictly. The residual risk - a deploy that forgets the variable -
// is real, is not closed here, and is written up as a question rather than
// papered over.

/**
 * The stand-in used until Checkpoint C decides the domain. Exported so tests
 * and callers can recognise it rather than string-matching a literal.
 */
export const PROVISIONAL_ORIGIN = 'http://localhost:3000';

const INVALID =
  'It must be an absolute http(s) origin with a scheme and no trailing ' +
  'slash, for example https://example.invalid. A bare hostname or a path ' +
  'yields a RELATIVE url in the sitemap, which is invalid rather than ' +
  'merely wrong - and well-formed enough that nothing else in the pipeline ' +
  'would object.';

/**
 * The origin to build absolute URLs from.
 *
 * Takes no arguments: the earlier signature carried a `production` flag for
 * a refusal that no longer exists, and a parameter nothing reads is a lie
 * about what the function depends on.
 */
export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  // Unset means undecided, in every environment. See the module comment for
  // why this does not throw in a production build.
  if (configured === undefined || configured === '') return PROVISIONAL_ORIGIN;

  // Validated rather than trusted. The mistake this catches is a bare
  // hostname or a path - "frontalier.fr" instead of "https://frontalier.fr" -
  // which yields a RELATIVE url in the sitemap: invalid rather than merely
  // wrong, and again well-formed enough that nothing else complains.
  let parsed: URL;

  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL is not a URL: ${configured}. ${INVALID}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`NEXT_PUBLIC_SITE_URL must be http or https: ${configured}`);
  }

  // No trailing slash: everything downstream concatenates a path, and
  // "https://host//mentions-legales" is a different URL from the single-slash
  // form - a duplicate-content problem rather than a cosmetic one.
  return `${parsed.protocol}//${parsed.host}`;
}

// ---------------------------------------------------------------------------
// RULING R81 - A PRODUCTION SERVER NEVER SERVES A FALLBACK ORIGIN
// ---------------------------------------------------------------------------
//
// This is the control the first version of this file tried and failed to
// build. The risk was always real - a published sitemap of localhost URLs is
// well-formed, indexes nothing, and trips no other gate - and the mistake was
// the trigger: NODE_ENV=production is set by `next build`, so guarding on it
// broke every local build for a condition that publishes nothing.
//
// R81 supplies the signal that was missing: FRONTALIER_RUNTIME=1, set by
// FW28's Dockerfile. It marks "this process is SERVING", which is exactly the
// distinction NODE_ENV could not make. Build-time fallback stays, so
// `pnpm build` and CI are untouched.

/** True in a container that is serving. Set by FW28's Dockerfile, never locally. */
export function isRuntime(): boolean {
  return process.env.FRONTALIER_RUNTIME === '1';
}

/** True when no origin was configured and the localhost stand-in is in play. */
export function isProvisionalOrigin(): boolean {
  return siteOrigin() === PROVISIONAL_ORIGIN;
}

/**
 * The condition R81 names: a serving process with no configured origin.
 *
 * Everything that would otherwise publish a localhost URL keys off THIS rather
 * than off isProvisionalOrigin alone, so a developer running `pnpm build` and
 * `pnpm start` locally still gets a working site.
 */
export function servingWithoutOrigin(): boolean {
  return isRuntime() && isProvisionalOrigin();
}

/**
 * Why canonicals key off isProvisionalOrigin and NOT servingWithoutOrigin,
 * which looks inconsistent and is not.
 *
 * Next evaluates `metadata` for a statically prerendered route at BUILD time
 * and bakes the result into the HTML. A canonical therefore cannot react to a
 * runtime marker at all - by the time FRONTALIER_RUNTIME is visible, the tag
 * has already been written. Forcing the route dynamic to make it react would
 * trade static delivery for a tag, on a site whose whole delivery model is
 * static.
 *
 * So the canonical is omitted whenever the origin it would be built from is
 * the stand-in, which is the condition that actually matters: a canonical
 * pointing at localhost is worse than no canonical, because a crawler treats
 * it as an instruction rather than as an absence.
 *
 * The two per-request surfaces - /sitemap.xml and /api/health - can and do
 * read the runtime marker, because a route handler runs per request.
 */
export function canonicalsAvailable(): boolean {
  return !isProvisionalOrigin();
}
