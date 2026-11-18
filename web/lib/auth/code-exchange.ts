// web/lib/auth/code-exchange.ts
//
// The code exchange's edge budget, ONE IMPLEMENTATION FOR BOTH DOORS.
// FW-WEB-ACCOUNT (R901).
//
// Until FW-WEB-ACCOUNT this lived privately in app/api/v1/auth/code/route.ts.
// The website's sign-in now exchanges the same six-digit code, and R901 says
// "through the existing auth routes and FW-CODE-CAP's budget - not a second
// budget". Two copies of these keys would be two budgets the day either was
// renamed, so the route and the website both call this, and
// tests/db/web-sign-in.test.ts proves it from the outside: attempts spent
// through one door are refused at the other.
//
// THERE ARE TWO LIMITS, AND ONLY THIS ONE IS HERE. The per-address daily
// budget (MAX_CODE_ATTEMPTS_PER_DAY, in PostgreSQL) and the per-request limit
// (MAX_CODE_ATTEMPTS) live inside consumeCode, which both doors also call. This
// is the in-memory backstop in front of them.

import { checkRate, clientKey } from '@/lib/alerts/rate-limit';

/**
 * A BACKSTOP, SET WELL ABOVE THE PER-REQUEST COUNTER. The per-code guard is
 * consumeCode's five-attempt limit; this edge window exists only to stop a
 * source hammering the endpoint across many requests. Twenty per ten minutes
 * is far more than any honest person needs (even someone who exhausts one
 * code's five tries, asks for a new one, and tries again stays under it) and
 * far below what a script would want - so a legitimate fat-fingered user meets
 * `too_many_attempts`, never `rate_limited`, and only abuse meets this.
 */
export const EXCHANGE_RATE_LIMIT = 20;

/** An address as both doors key it: trimmed and lower-cased, one bucket per person. */
export function normaliseAddress(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * The existing rate limits per address and per network source, namespaced so
 * the exchange does not share the request form's or the alert form's buckets.
 * Both are checked and both are counted: by IP to stop one source hammering
 * many addresses, by address to stop many sources hammering one.
 */
export function codeExchangeAllowed(email: string, headers: Headers, now: number = Date.now()): boolean {
  const ip = clientKey(headers);
  const byAddress = checkRate(`auth:code:email:${email}`, now, EXCHANGE_RATE_LIMIT);
  const byIp = checkRate(`auth:code:ip:${ip}`, now, EXCHANGE_RATE_LIMIT);

  return byAddress.allowed && byIp.allowed;
}
