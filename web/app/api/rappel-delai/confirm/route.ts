// web/app/api/rappel-delai/confirm/route.ts
//
// GET /api/rappel-delai/confirm?token=... - FW-DELAI-RAPPEL, R915: the far end
// of the confirmation. Nothing is ever sent for a request until this link has
// been opened.
//
// IT CONSUMES THE TOKEN AND REDIRECTS (303), as the alert flow's confirm
// route does: the token leaves the address bar, and the reader lands on the
// comparator at "Votre délai", where the outcome is shown by its fragment
// (lib/rappel/landing.ts). RELATIVE, never an origin (R364).
//
// A GET, because it is a link in a message; prefetching is why the write is
// conditioned on the hash it read (lib/rappel/confirm.ts).

import type { NextRequest, NextResponse } from 'next/server';
import { relativeRedirect } from '@/lib/http/redirect';
import { confirmReminderByToken } from '@/lib/rappel/confirm';
import { LANDING_STATES, landingFor, type LandingState } from '@/lib/rappel/landing';

export async function GET(request: NextRequest): Promise<NextResponse> {
  let state: LandingState = LANDING_STATES.unknown;

  try {
    state = await confirmReminderByToken(request.nextUrl.searchParams.get('token') ?? '');
  } catch {
    // The database refused: "invalide" is the honest answer - we cannot say
    // the reminder is programmed.
    state = LANDING_STATES.unknown;
  }

  return relativeRedirect(landingFor(state));
}
