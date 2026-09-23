// web/lib/export/print-token.ts
//
// The token that lets one request render one person's one year. FW25 inc. 2.
//
// ============================================================================
// WHY A URL TOKEN AT ALL, WHEN A BEARER HEADER WOULD BE SAFER
// ============================================================================
//
// Every other /v1 route takes `Authorization: Bearer`. A header never reaches
// an access log, a browser history or a referrer, so it is the better place for
// a credential and the bearer guard is already proven.
//
// The print route cannot use one, for a reason that is not a technical
// limitation but a requirement: THE DOCUMENT HAS TO BE OPENABLE BY A PERSON. A
// human checking the rendered dossier - which is what FW25's increment 4 is
// for, and what nobody can do by curl - types a URL into a browser, and a
// browser sends no Authorization header for a typed URL.
//
// So the credential travels in the URL, and everything below is about bounding
// what that costs.
//
// ============================================================================
// SHORT-LIVED, NOT SINGLE-USE, AND THE REASON IS A RULE RATHER THAN A PREFERENCE
// ============================================================================
//
// AC3 permits either. Single-use is the stronger property: a leaked URL is
// already spent. It requires SERVER-SIDE STATE to record consumption - a row,
// therefore a Prisma model, therefore a schema change, which CLAUDE.md makes an
// ASK-FIRST item. That ruling was not sought for this, so single-use is not
// available to this increment.
//
// What a 120-second window actually costs, said plainly rather than waved away:
// a token captured from a reverse-proxy access log within two minutes of being
// minted can be replayed to read that one year of that one person. It cannot be
// extended, it authorises no other year, no other account and no write, and it
// carries no bearer privileges.
//
// THE TOKEN IS SCOPED TO A YEAR, not only to a person, which is what makes the
// 403 in AC3 meaningful: a token minted for 2026 presented against 2027 is
// refused rather than quietly serving the year it was minted for.

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Two minutes.
 *
 * The PDF route mints a token and drives Chromium at it immediately; the
 * render takes seconds. The window is sized for a slow machine and a retry,
 * not for a person to copy the URL somewhere.
 */
export const PRINT_TOKEN_TTL_MS = 120 * 1000;

/**
 * The value `.env.example` ships.
 *
 * R133 AS A POSITIVE GUARD: the code refuses this string explicitly rather than
 * hoping nobody deploys it. A signing key everybody has is not a signing key,
 * and a placeholder copied into production is the ordinary way that happens.
 *
 * RE-EXPORTED, NOT DECLARED (R206). FW28 needed the same string in
 * scripts/entrypoint.mjs, which runs before Next and cannot import TypeScript,
 * so the text moved to lib/deploy/placeholders.mjs and both sides now name it
 * rather than carrying a copy. Every existing importer is unaffected.
 */
import { PLACEHOLDER_SECRET } from '@/lib/deploy/placeholders.mjs';

export { PLACEHOLDER_SECRET };

export type PrintTokenFailure =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'wrong_year'
  | 'not_configured';

export type PrintTokenResult =
  | { readonly ok: true; readonly userId: string; readonly year: number }
  | { readonly ok: false; readonly code: PrintTokenFailure };

/**
 * The signing key, or null when there is not one.
 *
 * IT RETURNS NULL RATHER THAN FALLING BACK. R205's shape applied to a key: a
 * route that signs with a default is worse than a route that refuses, because
 * the refusal is visible and the default is not. An unset secret is a
 * deployment that is not finished, and the honest answer is to say so.
 */
function secret(): string | null {
  const value = process.env.AUTH_SECRET;

  if (value === undefined || value === '') return null;
  if (value === PLACEHOLDER_SECRET) return null;

  return value;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

/** Constant-time comparison, so a wrong signature leaks no timing. */
function sameSignature(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  // timingSafeEqual throws on a length mismatch, which would itself be a
  // timing signal - so the lengths are compared first and the result is
  // folded in rather than returned early.
  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
}

/**
 * Mint a token for one person and one year.
 *
 * Returns null when there is no signing key, so the caller reports
 * `not_configured` rather than serving something unsigned.
 */
export function mintPrintToken(userId: string, year: number, now = Date.now()): string | null {
  const key = secret();

  if (key === null) return null;

  const payload = `${userId}.${year}.${now + PRINT_TOKEN_TTL_MS}`;

  return `${Buffer.from(payload).toString('base64url')}.${sign(payload, key)}`;
}

/**
 * Read a token back.
 *
 * R198: every refusal names WHICH rule fired. An expired token and a forged one
 * are different facts, and a route that answered "invalid" to both would send
 * whoever is debugging to look at the wrong thing.
 */
export function readPrintToken(
  token: string | null,
  year: number,
  now = Date.now(),
): PrintTokenResult {
  const key = secret();

  if (key === null) return { ok: false, code: 'not_configured' };
  if (token === null || token === '') return { ok: false, code: 'missing_token' };

  const parts = token.split('.');

  if (parts.length !== 2) return { ok: false, code: 'invalid_token' };

  const [encoded, signature] = parts as [string, string];
  const payload = Buffer.from(encoded, 'base64url').toString();

  if (!sameSignature(signature, sign(payload, key))) {
    return { ok: false, code: 'invalid_token' };
  }

  // ONLY NOW is the payload trusted enough to read. Parsing before verifying
  // would make the shape of an attacker's string decide which branch runs.
  const fields = payload.split('.');

  if (fields.length !== 3) return { ok: false, code: 'invalid_token' };

  const [userId, tokenYear, expiresAt] = fields as [string, string, string];
  const expiry = Number(expiresAt);

  if (!Number.isFinite(expiry)) return { ok: false, code: 'invalid_token' };
  if (now > expiry) return { ok: false, code: 'expired_token' };

  // THE YEAR IS PART OF THE GRANT. A token minted for 2026 does not authorise
  // 2027, and answering with the minted year instead would serve a document
  // nobody asked for under a URL that says otherwise.
  if (Number(tokenYear) !== year) return { ok: false, code: 'wrong_year' };

  return { ok: true, userId, year };
}
