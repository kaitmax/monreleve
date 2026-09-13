// web/app/api/alertes/confirm/route.ts
//
// GET /api/alertes/confirm?token=... - the far end of the double opt-in.
// FW14 increment 4.
//
// IT CONSUMES THE TOKEN AND REDIRECTS, rather than rendering. Two reasons,
// and the second is the one that matters:
//
//   The page that says what happened is a real route under (public), so it
//   gets PublicShell, the design system and the same header and footer as
//   everything else - for free, and without this handler knowing any of that.
//
//   AND THE TOKEN LEAVES THE URL. After the redirect the reader is on
//   /alertes/confirmation/confirmee with no secret in the address bar, so the
//   token is not in their history, not in a bookmark, and not in a Referer
//   header if they follow a link from that page. A handler that rendered
//   would leave a live-until-used credential sitting in the URL of a page
//   somebody might screenshot.
//
// GET, NOT POST, because it is a link in an email and a link in an email is a
// GET. That makes it prefetchable by mail clients, which is exactly why
// lib/alerts/confirm.ts conditions its write on the hash it read: the second
// arrival finds nothing to do rather than confirming twice.

import { NextResponse, type NextRequest } from 'next/server';
import { confirmByToken } from '@/lib/alerts/confirm';
import { CONFIRMATION_PATH, CONFIRM_STATES } from '@/lib/alerts/status';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token') ?? '';

  let state: string = CONFIRM_STATES.unknown;

  try {
    state = CONFIRM_STATES[await confirmByToken(token)];
  } catch {
    // The database refused. "Invalide" is the honest answer to give a reader
    // here: we cannot say their subscription is confirmed, and telling them
    // it failed for a technical reason gives them nothing to act on that
    // "try again" does not.
    state = CONFIRM_STATES.unknown;
  }

  return NextResponse.redirect(
    new URL(`${CONFIRMATION_PATH}/${state}`, request.nextUrl.origin),
    303,
  );
}
