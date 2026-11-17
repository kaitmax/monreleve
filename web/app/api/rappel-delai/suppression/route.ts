// web/app/api/rappel-delai/suppression/route.ts
//
// POST /api/rappel-delai/suppression - FW-DELAI-RAPPEL, R1002: the one button
// on the delete link's page (app/(public)/rappel-delai/suppression/page.tsx)
// posts here, and THIS is what deletes the address and the date.
//
// NO GET. The link in the messages opens the page, never this; a GET here is
// answered 405 by the framework and changes nothing, so a mail client that
// fetches links cannot delete a request (tests/db/rappel-delai-suppression
// .test.ts asserts the row survives every GET).
//
// R267's SECOND SITE, CHECKED AND NOT CHANGED: the alert list's unsubscribe
// (app/api/alertes/desinscription/route.ts) is still a GET that acts at once.
// Its own header argues why that is right there - one click is the promise,
// RFC 8058 asks for it, and an unsubscribed row is kept and can be undone by
// subscribing again - none of which holds for a reminder whose only message
// a scanner could cancel.
//
// 303 to the comparator with the outcome's fragment, relative (R364). R1003:
// "deleted now" and "no row for this link" land on the SAME outcome; a
// refusal from the database lands on its own, because claiming a deletion
// that did not happen would make the person stop expecting a message.

import type { NextRequest, NextResponse } from 'next/server';
import { relativeRedirect } from '@/lib/http/redirect';
import { deleteReminderByToken } from '@/lib/rappel/confirm';
import { LANDING_STATES, landingFor, type LandingState } from '@/lib/rappel/landing';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let state: LandingState = LANDING_STATES.deleteFailed;

  try {
    const token = (await request.formData()).get('token');

    state = await deleteReminderByToken(typeof token === 'string' ? token : '');
  } catch {
    // The body was not a form, or the database refused: nothing was deleted.
    state = LANDING_STATES.deleteFailed;
  }

  return relativeRedirect(landingFor(state));
}
