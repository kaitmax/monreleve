// web/lib/verification/origin.ts
//
// The dedicated setting that turns on the printed verification link. FW-VERIFY (R332).
//
// ============================================================================
// NO QR, NO PRINTED ADDRESS, UNTIL A PERMANENT DOMAIN IS NAMED
// ============================================================================
//
// A printed releve carries its link for years. R332: the QR code and the
// printed verification address appear ONLY when a DEDICATED setting names the
// permanent production origin - not the general site URL, which an operator may
// set before committing to it. Default: neither prints, and the release audit
// lists it as a NEEDS item.
//
// This is R205 on a URL: a thing is served only when it can be believed. A
// releve must never point at localhost, a temporary host, or a domain the
// operator may not keep - so an http origin, a localhost origin, a value with a
// path or query, or a malformed one all return null, exactly as an unset one
// does. The document then carries no code, no address and no QR, which is the
// honest state of a product whose permanent home is not yet decided.
//
// SEPARATE FROM NEXT_PUBLIC_SITE_URL ON PURPOSE. That variable is the site's
// origin for sitemaps and canonicals (R81); reusing it would turn the QR on the
// moment the site got an address, which is earlier than the deliberate decision
// R332 requires. A reader who scans a code printed against a domain the operator
// later drops is stranded forever, so this gate is its own switch.

/** The name of the dedicated setting. */
export const VERIFICATION_ORIGIN_ENV = 'MONRELEVE_VERIFICATION_ORIGIN';

/**
 * The permanent verification origin, or null when it is not set to a value that
 * can be believed. Returns a bare origin with no trailing slash.
 */
export function verificationOrigin(
  value: string | undefined = process.env[VERIFICATION_ORIGIN_ENV],
): string | null {
  if (value === undefined || value.trim() === '') return null;

  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  // HTTPS ONLY: a permanent production origin is https. http reads as a
  // temporary or local host, which R332 forbids a releve from pointing at.
  if (url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase();

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost')
  ) {
    return null;
  }

  // A BARE ORIGIN, nothing more: a path, query or fragment means the value is
  // not an origin and the printed link would be wrong.
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') return null;

  // url.origin carries no trailing slash, so the printed link joins cleanly.
  return url.origin;
}

/** The verification URL a document prints for a code, given a believable origin. */
export function verificationUrlFor(origin: string, code: string): string {
  return `${origin}/verifier/${code}`;
}
