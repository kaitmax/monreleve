// web/lib/rappel/landing.ts
//
// FW-DELAI-RAPPEL: where the two links in the messages land. The /api/
// handlers consume the token and answer 303 to the comparator with one of
// these fragments; app/(public)/calculateur-lamal-cmu/ReminderOutcomes.tsx
// renders every outcome hidden and CSS :target reveals the one named.
//
// A FRAGMENT, NOT A PAGE OF ITS OWN (Queue Ruling 23's probe): a new route
// puts its CSS chunk in the webpack runtime every route loads (+9 B each,
// measured), and the calculator page has 54 B. A fragment never reaches the
// server, so the comparator stays static (FW13), and an unknown fragment
// reveals nothing - a stranger cannot put a false outcome on somebody's
// screen by naming one we never wrote.

import { COMPARATOR_PATH } from '@/lib/content/routes';

export const LANDING_STATES = {
  /** The confirmation link worked; the reminder is programmed. */
  confirmed: 'confirme',
  /** A real confirmation link past its days; the request is deleted. */
  expired: 'expire',
  /** Confirmed fewer than fourteen days before the date (R916's question); deleted. */
  tooLate: 'trop-tard',
  /** Never issued, or already used. One answer for both (R915). */
  unknown: 'invalide',
  /** The delete link removed the address and the date. */
  deleted: 'supprime',
  /** No row carries that delete link. One answer for "gone" and "never". */
  deleteUnknown: 'introuvable',
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
