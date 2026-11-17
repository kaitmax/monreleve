// web/lib/rappel/landing.ts
//
// FW-DELAI-RAPPEL: where the two links in the messages lead, and where they
// land. The confirmation link is consumed by an /api/ handler that answers
// 303 to the comparator with one of these fragments;
// app/(public)/calculateur-lamal-cmu/ReminderOutcomes.tsx renders every
// outcome hidden and CSS :target reveals the one named.
//
// A FRAGMENT, NOT A PAGE OF ITS OWN, for the outcomes (Queue Ruling 23's
// probe): a new route with a stylesheet of its own puts its CSS chunk in the
// webpack runtime every route loads (+9 B each, measured), and the calculator
// page has 54 B. A fragment never reaches the server, so the comparator stays
// static (FW13), and an unknown fragment reveals nothing - a stranger cannot
// put a false outcome on somebody's screen by naming one we never wrote.
//
// THE DELETE LINK OPENS A PAGE, AND ONLY ITS BUTTON DELETES (R1002). The
// confirmation carries both links, so a mail client that fetches links to
// build a preview could delete a request before anybody read the message -
// the only message. So the link is a GET that changes nothing
// (app/(public)/rappel-delai/suppression/page.tsx, one button, a plain form),
// and the POST it sends is what deletes. That page is not in
// lib/content/routes.ts (Web Ruling 9): the registry ships whole to the
// calculator page.

import { COMPARATOR_PATH } from '@/lib/content/routes';

/** R1002: the delete link in every message - a page with one button; opening it deletes nothing. */
export const DELETE_PATH = '/rappel-delai/suppression';

/** R1002: where that page's one button posts. The POST is what deletes. */
export const DELETE_ENDPOINT = '/api/rappel-delai/suppression';

export const LANDING_STATES = {
  /** The confirmation link worked; the reminder is programmed. */
  confirmed: 'confirme',
  /** A real confirmation link past its days; the request is deleted. */
  expired: 'expire',
  /** Confirmed fewer than fourteen days before the date (R916, kept by R1000); deleted. */
  tooLate: 'trop-tard',
  /** Never issued, or already used. One answer for both (R915). */
  unknown: 'invalide',
  /**
   * The delete button was pressed. R1003: "deleted now" and "no row for this
   * link" read the same - a link works for as long as its row exists, so a
   * link that matches no row means nothing is kept under it.
   */
  deleted: 'supprime',
  /** The database refused the delete. Nothing changed, and the outcome says so. */
  deleteFailed: 'suppression-impossible',
} as const;

export type LandingState = (typeof LANDING_STATES)[keyof typeof LANDING_STATES];

/** The element id, and so the fragment, for an outcome. */
export function landingFragment(state: LandingState): string {
  return `rappel-${state}`;
}

/** The relative Location a handler answers with (R364: never an origin). */
export function landingFor(state: LandingState): string {
  return `${COMPARATOR_PATH}#${landingFragment(state)}`;
}
