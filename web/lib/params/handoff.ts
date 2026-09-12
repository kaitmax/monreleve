// web/lib/params/handoff.ts
//
// THE ONLY CLIENT STORAGE IN THE PUBLIC PRODUCT. FW13 increment 5.
//
// There is one key, it is written by one component, and nothing on the web
// reads it. Its reader is the Android app: SPEC 10 hands the calculator's
// scenario across through install-referrer parameters, and the app pre-fills
// onboarding from them on first run. This key is the other half of that -
// the state is already on the device when the reader comes back through a
// store install, rather than having to survive a URL the store may not carry.
//
// WHY IT REUSES THE URL CODEC RATHER THAN INVENTING A SHAPE. SPEC 9.4 froze
// nine param names the moment a link could be pasted into a Facebook group,
// and SPEC 10's handoff carries canton, taux and telework days - three of
// those same nine. Two spellings of one scenario would be two public contracts
// to keep in step, with the second one owned by a codebase that ships on a
// different schedule. So the payload is a query string produced by the same
// encode() the address bar uses, and a name that is wrong here is wrong in a
// place somebody would notice.
//
// VERSION IN THE KEY, NOT ONLY IN THE PAYLOAD. The reader is an app the user
// may not have updated in a year. A v1 app looking for a v1 key finds v1 or
// finds nothing; it can never find a v2 payload and misread it. The version is
// repeated INSIDE the payload as well, so a blob recovered without its key -
// in a bug report, in a support thread - still says what it is.
//
// WHAT IT MUST NEVER CARRY. Nothing personal. The scenario is a canton code
// and some day counts, which is not personal data; an email address would be,
// and so would a name, a device id, or anything free-text. The guarantee here
// is structural rather than careful: the payload is whatever encode() produces
// and encode() can only produce the nine names, so there is no field for
// anything else to arrive in. tests/unit/pages/storage-handoff.test.tsx
// asserts that as a whitelist.
//
// LOCALSTORAGE IS NOT A COOKIE. SPEC D12 forbids cookies on public routes and
// e2e/home.spec.ts proves it from a network trace - but that test reads
// context.cookies(), so it says nothing about this file either way. The
// distinction is real and it is deliberate: a cookie is attached to every
// request to the origin, which makes it a tracking mechanism whether or not
// anybody intended one, while this never leaves the device until the reader
// installs an app and that app reads it.

import { type TeleworkInput } from '@/lib/calc-engine';
import { encode } from '@/lib/params/codec';

/** Bumped only when the payload's shape changes in a way a reader would trip on. */
export const HANDOFF_VERSION = 1;

/** One key. The version is part of it, so an old reader cannot find a new shape. */
export const HANDOFF_KEY = `frontalier.calculateur.v${HANDOFF_VERSION}`;

/** What the app will find. Two fields, and one of them is a version. */
export interface Handoff {
  readonly version: number;

  /** The scenario, in SPEC 9.4's nine frozen names. */
  readonly params: string;
}

/** The payload as it is stored, exported so the test asserts the real thing. */
export function handoffPayload(input: TeleworkInput): string {
  const handoff: Handoff = {
    version: HANDOFF_VERSION,
    params: encode(input).toString(),
  };

  return JSON.stringify(handoff);
}

/**
 * Write it, and never let it matter if it fails.
 *
 * Safari in private mode, a browser with site data turned off, a device whose
 * quota is full: setItem THROWS in all three, and it is the ordinary case for
 * an in-app browser opened from a social feed - which is the majority of this
 * product's readers. The handoff is a convenience for an app they may never
 * install. The answer on screen is the product, and an exception here must not
 * reach it.
 */
export function writeHandoff(input: TeleworkInput): void {
  try {
    window.localStorage.setItem(HANDOFF_KEY, handoffPayload(input));
  } catch {
    // Deliberately silent. There is nothing to tell the reader - they did not
    // ask for this, nothing they can see is affected, and a notice about
    // storage would be the first thing on the page that is about us rather
    // than about them.
  }
}
