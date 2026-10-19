// web/app/api/v1/entries/route.ts
//
// POST /api/v1/entries - the offline queue flushing. FW23 increment 3.
//
// ============================================================================
// THE ORDER OF THESE CHECKS IS PART OF THE CONTRACT
// ============================================================================
//
//   1. authenticate      no token, no further reading. An unauthenticated
//                        caller must not be able to make the server parse
//                        anything, and the refusal names which rule fired.
//   2. bound the body    before JSON.parse, because parsing is the expensive
//                        thing a large body buys.
//   3. scan for coordinates ON THE RAW OBJECT, BEFORE VALIDATION. If the
//                        schema ran first, a payload rejected for any other
//                        reason would never be scanned - and the one
//                        interesting fact about it, that a client is sending
//                        coordinates, would go unrecorded (SPEC 13.1, D18).
//   4. validate          unknown keys rejected, not stripped.
//   5. write             tenancy from the token, never the payload.
//
// EVERY REFUSAL CARRIES A STABLE ASCII CODE AND FRENCH FOR A HUMAN (R198).
// The code is what the Android client branches on and is frozen by FW23; the
// message may be rewritten freely. A client branching on the French breaks
// when the copy improves.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { authenticate, unauthorised } from '@/lib/auth/bearer';
import { MAX_BATCH_BODY_BYTES, entriesBatchSchema } from '@/lib/entries/schema';
import { findLocationKeys } from '@/lib/entries/no-coordinates';
import { writeEntries } from '@/lib/entries/write';
import { parseReadQuery } from '@/lib/entries/read-query';
import { readYear } from '@/lib/entries/read';
import { parisDayOf } from '@/lib/entries/day';

/**
 * NEVER CACHED, AND SAID TWICE ON PURPOSE.
 *
 * An authenticated GET is the one shape a framework or a proxy will happily
 * treat as static, and the failure mode is one person's year served to another.
 * `dynamic` tells Next; the headers tell everything between here and the
 * device. Neither is trusted alone, and a test asserts the headers on the
 * SERVED response rather than reading this file back.
 */
export const dynamic = 'force-dynamic';

function refuse(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ status: 'error', code, message }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);

  if (!auth.ok) {
    return unauthorised(auth.code);
  }

  const raw = await request.text();

  // BOUNDED BEFORE PARSED. Byte length, not character count: a body of
  // multi-byte characters is larger on the wire than its string length
  // suggests, and the limit is about what this route will read.
  if (Buffer.byteLength(raw, 'utf8') > MAX_BATCH_BODY_BYTES) {
    return refuse('payload_too_large', AUTH_API_COPY.payloadTooLarge, 413);
  }

  let body: unknown;

  try {
    body = JSON.parse(raw);
  } catch {
    return refuse('malformed_body', AUTH_API_COPY.malformedBody);
  }

  // SPEC 13.1 / D18. Before validation, and on the whole body - see the header.
  const coordinates = findLocationKeys(body);

  if (coordinates.length > 0) {
    // THE KEYS, NEVER THEIR VALUES. A coordinate this product refuses to store
    // must not survive in the error about refusing to store it, nor in the log
    // line about the error.
    console.error(
      `[entries] payload refused: location keys present (${coordinates.sort().join(', ')})`,
    );

    return refuse('coordinates_refused', AUTH_API_COPY.coordinateRefused);
  }

  const parsed = entriesBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: 'error',
        code: 'invalid_payload',
        message: AUTH_API_COPY.invalidPayload,
        // THE ISSUES ARE RETURNED because the caller is a client author who
        // can act on them, and because "invalid payload" with no detail sends
        // them to read our source instead of their own. They name paths and
        // rules, never a user's data.
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  // ==========================================================================
  // A DAY THAT HAS NOT HAPPENED IS ITS OWN REFUSAL (R410, and R198 one
  // endpoint over, which is where this reasoning already lives)
  // ==========================================================================
  //
  // The schema proves `dayDate` is a REAL calendar day. It has no upper
  // bound, so tomorrow parses perfectly - and KMP-2 found what happens next:
  // late.ts measures how long AFTER a day it was recorded, so for a day that
  // has not started the gap is NEGATIVE, which is not greater than seven
  // days, so the entry is classified ON TIME. The green marker, on a day
  // nobody has worked.
  //
  // SPEC 11.2 ALREADY SAYS WHAT A FUTURE DAY IS, and it is none of the three
  // qualities: the calendar bar is green, amber, grey, and NO BAR for
  // weekends, holidays and future days. This implements that, rather than
  // inventing a rule.
  //
  // THE CLIENT ALREADY REFUSES THESE (CalendarModel: "in the engine's period
  // and not in the future: the only days a tap may record"). That is exactly
  // why the server needs it too - the device's clock is not the authority
  // here, any more than it is for `firstRecordedAt`.
  //
  // TODAY IS COMPUTED IN PARIS (R411). In UTC this rule would refuse a
  // perfectly ordinary entry every night: at 00:15 Paris it is still
  // yesterday in UTC, so the day the reader is actually in would read as the
  // future. `parisDayOf` is the one home for that question (R206) - the same
  // module the reminder job uses, for the same reason.
  //
  // STRING COMPARISON, deliberately: both sides are YYYY-MM-DD, which sorts
  // lexicographically as it sorts chronologically. Parsing either into a
  // Date to compare them would reintroduce an instant, and an instant is
  // what has a timezone.
  const today = parisDayOf(new Date());
  const ahead = parsed.data.entries.filter((entry) => entry.dayDate > today);

  if (ahead.length > 0) {
    // THE COUNT AND THE SERVER'S OWN DAY, never the reader's days. The log
    // is for whoever is wondering why a client is being refused, and it does
    // not need a record of when anybody worked.
    console.warn(`[entries] payload refused: ${ahead.length} day(s) after ${today}`);

    // REFUSED WHOLE, matching how the schema treats a duplicate pair inside
    // one batch: a partly-written batch is the state a client cannot
    // reconcile, and this is a client bug rather than a per-row condition.
    return refuse('future_day', AUTH_API_COPY.futureDay);
  }

  const result = await writeEntries(auth.userId, parsed.data.entries);

  if (!result.ok) {
    return refuse(
      result.code ?? 'write_failed',
      result.code === 'conflict' ? AUTH_API_COPY.batchConflict : AUTH_API_COPY.writeFailed,
      result.code === 'conflict' ? 409 : 500,
    );
  }

  // 200 AND A COUNT OF EACH OUTCOME. The client reconciles its queue from
  // this: `written` are new, `duplicates` were already here and are
  // acknowledged rather than retried (D30, AC3).
  return NextResponse.json(
    {
      status: 'ok',
      written: result.written,
      duplicates: result.duplicates,
      // R217: THE ROWS, so a client can clear the pending state SPEC 13.2
      // describes without a second request. Additive under the freeze - a
      // client built per section 6.4 ignores keys it does not know.
      entries: result.entries,
    },
    { status: 200 },
  );
}

// ============================================================================
// GET /api/v1/entries?year=YYYY - the read path. FW23 increment 4.
// ============================================================================
//
// THE ORDER IS THE SAME CONTRACT AS POST'S, AND FOR THE SAME REASONS:
//
//   1. authenticate            no token, nothing else is read.
//   2. scan for coordinates    ON THE QUERY STRING, BEFORE VALIDATION. A
//                              `?lat=` is BOTH a coordinate and an unknown
//                              parameter; validating first would answer
//                              `unknown_parameter` and the one interesting
//                              fact - that a client is sending coordinates -
//                              would go unrecorded (SPEC 13.1, D18).
//   3. validate the query      unknown parameters refused, not ignored.
//   4. read                    tenancy from the token, never the query.
//
// WHAT THE COORDINATE SCAN BUYS HERE, STATED HONESTLY. A query string is in the
// request line, so a `?latitude=` has ALREADY been written to any reverse
// proxy's access log before this handler runs. The refusal is a signal to a
// client author that the field is not wanted; it is NOT a guarantee that no
// coordinate was logged. Writing it as the latter would be the overclaim this
// product refuses everywhere else - declare what the record supports.

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);

  if (!auth.ok) {
    return unauthorised(auth.code);
  }

  const url = new URL(request.url);

  // THE PARAMETER NAMES, AS AN OBJECT, so the same scanner that guards the POST
  // body guards this one. `findLocationKeys` reads keys and never values, which
  // is what makes handing it the whole map safe: a coordinate this product
  // refuses to store must not survive in the error about refusing to store it.
  const coordinates = findLocationKeys(Object.fromEntries(url.searchParams));

  if (coordinates.length > 0) {
    console.error(
      `[entries] read refused: location keys in the query string (${coordinates.sort().join(', ')})`,
    );

    return refuse('coordinates_refused', AUTH_API_COPY.coordinateRefused);
  }

  const query = parseReadQuery(url);

  if (!query.ok) {
    if (query.code === 'unknown_parameter') {
      return NextResponse.json(
        {
          status: 'error',
          code: 'unknown_parameter',
          message: AUTH_API_COPY.unknownParameter,
          // NAMED, so a refusal triggered by something outside the client's
          // control is diagnosable from the client's own crash report.
          parameters: query.keys,
        },
        { status: 400 },
      );
    }

    return refuse('invalid_year', AUTH_API_COPY.invalidYear);
  }

  try {
    const entries = await readYear(auth.userId, query.year);

    return NextResponse.json(
      { status: 'ok', year: query.year, entries },
      {
        status: 200,
        headers: {
          'cache-control': 'no-store, private',
          vary: 'Authorization',
        },
      },
    );
  } catch (cause) {
    console.error(
      `[entries] read of ${query.year} failed:`,
      cause instanceof Error ? cause.message : String(cause),
    );

    // NEVER A PARTIAL 200. A short array carrying a success code is the one
    // answer this route must not give: the client cannot tell it from a year
    // with missing days, which is the fact the product exists to report.
    return refuse('read_failed', AUTH_API_COPY.readFailed, 500);
  }
}
