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
    { status: 'ok', written: result.written, duplicates: result.duplicates },
    { status: 200 },
  );
}
