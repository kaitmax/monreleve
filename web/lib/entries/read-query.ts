// web/lib/entries/read-query.ts
//
// What GET /api/v1/entries accepts in its query string. FW23 increment 4.
//
// ============================================================================
// THE QUERY STRING IS STRICT, FOR THE SAME REASON THE BODY IS
// ============================================================================
//
// schema.ts refuses unknown keys because "stripping is a lie with a success
// code". A query string is the same argument pointed at the URL: a client that
// sends `?since=2026-04-01` expecting a delta, and receives a whole year with a
// 200, has been told its filter worked. It will ship that way.
//
// AND THE ASYMMETRY DECIDES WHEN. Strict -> lenient is a server deploy that
// breaks nobody. Lenient -> strict breaks every client already sending
// something we ignored. So it is strict NOW or never.
//
// THE COST IS REAL AND IS NOT PRETENDED AWAY. A query string, unlike a POST
// body, survives intermediaries: a proxy that appends a cache-buster would make
// every read fail, totally, with the cause outside this repository. That is why
// the refusal NAMES THE OFFENDING KEYS - it converts a total failure with an
// unknowable cause into one whose cause is in the client's own crash report,
// and the fix stays a one-line deploy.

/** The only parameter this route reads. */
const ALLOWED = new Set(['year']);

/**
 * A year is exactly four ASCII digits.
 *
 * NO SEMANTIC RANGE, DELIBERATELY. Bounding the accepted year by a floor and
 * "the current year plus one" would create a WRITE-ONLY REGION OF THE RECORD:
 * the write path accepts any valid calendar day, so a year outside the window
 * could be written and never read back. It would also make the answer for a
 * given year a function of the server clock - ?year=2029 refused today and
 * served tomorrow - and a client that cached the refusal would be wrong.
 *
 * In a product whose whole claim is an honest record, an unreadable region of
 * that record is not a rate-limiting nicety.
 *
 * The regex is anchored and ASCII-only, so ' 2026', '+2026', '2026.0' and
 * '٢٠٢٦' are all refused. `Number.parseInt` would accept the first three.
 */
const YEAR = /^\d{4}$/u;

export type QueryResult =
  | { readonly ok: true; readonly year: number }
  | { readonly ok: false; readonly code: 'unknown_parameter'; readonly keys: string[] }
  | { readonly ok: false; readonly code: 'invalid_year' };

/**
 * Read the query string.
 *
 * UNKNOWN PARAMETERS ARE CHECKED BEFORE THE YEAR IS. A request carrying both a
 * bad year and a stray parameter is answered about the parameter, because that
 * is the one the client author does not already know about - and because
 * answering about the year would let a stray parameter survive unmentioned
 * behind a fixable error.
 */
export function parseReadQuery(url: URL): QueryResult {
  const unknown = [...new Set([...url.searchParams.keys()].filter((key) => !ALLOWED.has(key)))];

  if (unknown.length > 0) {
    return { ok: false, code: 'unknown_parameter', keys: unknown.sort() };
  }

  // `getAll`, NOT `get`. `?year=2026&year=2027` is a client asking two
  // questions in one request, and `get` would answer the first without saying
  // it had ignored the second - the strip this whole file exists to refuse.
  const values = url.searchParams.getAll('year');

  if (values.length !== 1) {
    return { ok: false, code: 'invalid_year' };
  }

  const raw = values[0] ?? '';

  if (!YEAR.test(raw)) {
    return { ok: false, code: 'invalid_year' };
  }

  return { ok: true, year: Number(raw) };
}
