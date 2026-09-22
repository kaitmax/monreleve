// web/app/api/v1/account/delete/route.ts
//
// POST /api/v1/account/delete. FW26 increment 4.
//
// ============================================================================
// POST, NOT DELETE, AND THE REASON IS THE CLIENT
// ============================================================================
//
// `DELETE /api/v1/account` would read better. It is a POST because SPEC §11.5
// requires a confirmation naming what is destroyed, and a confirmed action
// that carries a body is a POST everywhere else in this API - the client sends
// `{ "confirm": "SUPPRIMER" }`, and a request that reaches this route by
// accident does not erase anybody.
//
// The confirmation is NOT security. A caller with a valid token can always
// send the word. It is there so that a mis-wired client, a retried request or
// a curious developer with a shell does not destroy an account by making the
// obvious call - which is the realistic failure, and the one D11's "the
// confirmation names what is destroyed" is written against.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { authenticate, unauthorised } from '@/lib/auth/bearer';
import { DELETE_CONFIRMATION, deleteAccount } from '@/lib/account/delete';

export const dynamic = 'force-dynamic';

// DELETE_CONFIRMATION LIVES IN lib/account/delete.ts, not here.
//
// A Next.js route module may export only its handlers and a fixed set of
// config keys; any other export fails the BUILD with "not assignable to type
// 'never'". `tsc --noEmit` passes it happily, so this is one of the few things
// only `pnpm build` catches - which is why the gate runs both.

function refuse(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ status: 'error', code, message }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);

  if (!auth.ok) return unauthorised(auth.code);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return refuse('malformed_body', AUTH_API_COPY.malformedBody);
  }

  const confirm =
    typeof body === 'object' && body !== null && 'confirm' in body
      ? (body as { confirm?: unknown }).confirm
      : undefined;

  if (confirm !== DELETE_CONFIRMATION) {
    return refuse('confirmation_required', AUTH_API_COPY.invalidPayload);
  }

  try {
    const receipt = await deleteAccount(auth.userId);

    // THE RECEIPT IS THE POINT OF THE RESPONSE. "ok" would tell somebody their
    // account is gone; this tells them what went with it, which is what D11's
    // confirmation promised and the last chance to say it.
    return NextResponse.json(
      { status: 'ok', removed: receipt.removed },
      { status: 200, headers: { 'cache-control': 'no-store, private' } },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);

    // THE APPEND-ONLY TRIGGER REACHING THIS HANDLER WOULD BE A DESIGN FAILURE,
    // not a runtime one: it means the cascade was not recognised as a cascade.
    // It is named rather than folded into a generic 500 so the next reader is
    // told which rule refused, instead of being handed "delete failed".
    if (message.includes('append-only')) {
      console.error(`[account] erasure refused by the append-only guard: ${message}`);

      return refuse('erasure_blocked', AUTH_API_COPY.writeFailed, 500);
    }

    console.error('[account] deletion failed:', message);

    return refuse('write_failed', AUTH_API_COPY.writeFailed, 500);
  }
}
