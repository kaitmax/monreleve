// web/app/api/rappel-delai/suppression/route.ts
//
// GET /api/rappel-delai/suppression?token=... - FW-DELAI-RAPPEL, R916: the
// delete link in every message removes the address and the date AT ONCE.
//
// ONE CLICK, NO CONFIRMATION STEP: the message says the link deletes, and a
// page asking to press something else would make that untrue. The cost of a
// GET is that a link-scanning mail client can delete a reminder nobody meant
// to delete - unlike the alert unsubscribe, the person may not notice before
// the date. That is a QUESTION in the report, not a decision taken here.
//
// 303 to the comparator with the outcome's fragment, relative (R364). The
// two outcomes are "deleted" and "no reminder matches this link", which is
// also the honest answer to a token never issued (no oracle, R915).

import type { NextRequest, NextResponse } from 'next/server';
import { relativeRedirect } from '@/lib/http/redirect';
import { deleteReminderByToken } from '@/lib/rappel/confirm';
import { LANDING_STATES, landingFor, type LandingState } from '@/lib/rappel/landing';

export async function GET(request: NextRequest): Promise<NextResponse> {
  let state: LandingState = LANDING_STATES.deleteUnknown;

  try {
    state = await deleteReminderByToken(request.nextUrl.searchParams.get('token') ?? '');
  } catch {
    // Never claim a deletion that may not have happened: the person would stop
    // expecting the message and still receive it.
    state = LANDING_STATES.deleteUnknown;
  }

  return relativeRedirect(landingFor(state));
}
