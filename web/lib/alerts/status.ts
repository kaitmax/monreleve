// web/lib/alerts/status.ts
//
// How the server tells the reader what happened, without a cookie and without
// JavaScript. FW14 increment 2.
//
// THE CONSTRAINT THAT DECIDES THIS. SPEC D12 forbids a cookie on a public
// route - /confidentialite says so in its first sentence, and e2e asserts it
// from a network trace - and R136 forbids a client island. So the status
// cannot be stored, and it cannot be fetched. What is left is the URL: the
// handler redirects (303, so a refresh does not re-post) and the page renders
// the message from a query parameter.
//
// WHICH COLLIDES WITH SPEC 9.4, and that collision is the interesting part.
// The calculator's nine param names are a frozen public contract, and the
// codec reports anything else as an UNKNOWN PARAMETER in a notice: "Ces
// paramètres ne sont pas utilisés par le calculateur". Redirecting to
// ?alerte=ok would therefore greet a reader who had just subscribed with a
// notice telling them their subscription was an unrecognised parameter.
//
// So `alerte` is RESERVED rather than unknown: not a scenario parameter, not
// an error, and never carried into a shared link. lib/params/schema.ts holds
// the list and lib/params/codec.ts skips it.
//
// THE VALUES ARE FRENCH AND MEANINGFUL because they are visible in the
// address bar of somebody who just used the form. "?alerte=ok" is legible;
// "?a=3" is not, and a reader who cannot read their own URL cannot tell a
// status from a tracking code.

import { ALERTES_COPY } from '@/lib/fr/alertes';

/**
 * THE STATUS TRAVELS AS A FRAGMENT, NOT A QUERY PARAMETER.
 *
 * A query parameter would have to be read on the server to be rendered
 * there, and FW13 measured what that costs on this route: any use of
 * searchParams - page, generateMetadata, or a Suspense child - makes it
 * dynamic in Next 15.5.25 and emits <title> and <link rel="canonical"> into
 * the BODY of SPEC 14's target-query page.
 *
 * A FRAGMENT NEVER REACHES THE SERVER. So the page stays static, renders
 * every status message hidden, and CSS :target reveals the one the fragment
 * names. No JavaScript is required for that, which is what makes the error
 * case readable for a reader who has none - the alternative was a mistyped
 * address producing no message at all.
 *
 * The operator chose this over an island-only status and over accepting a
 * dynamic calculator.
 */
export const statusFragment = (status: AlertStatus): string => `alerte-${status}`;

export const ALERT_STATUS = {
  /** Accepted. The same value for a new address and one already known. */
  ok: 'ok',
  /** The field was empty. */
  missing: 'adresse-manquante',
  /** Something arrived and it was not an address. */
  invalid: 'adresse-invalide',
  /** The hidden source field was missing or unknown. Our bug, not theirs. */
  form: 'formulaire',
  /** Too many attempts from this address. */
  rate: 'trop-de-tentatives',
  /** The database or the mailer refused. */
  unavailable: 'indisponible',
} as const;

export type AlertStatus = (typeof ALERT_STATUS)[keyof typeof ALERT_STATUS];

const MESSAGES: Readonly<Record<AlertStatus, string>> = {
  [ALERT_STATUS.ok]: ALERTES_COPY.submitted,
  [ALERT_STATUS.missing]: ALERTES_COPY.errors.emailMissing,
  [ALERT_STATUS.invalid]: ALERTES_COPY.errors.emailInvalid,
  [ALERT_STATUS.form]: ALERTES_COPY.errors.sourceInvalid,
  [ALERT_STATUS.rate]: ALERTES_COPY.errors.tooMany,
  [ALERT_STATUS.unavailable]: ALERTES_COPY.errors.unavailable,
};

/** Every status that is not `ok` is rendered as an error. */
export function isFailure(status: AlertStatus): boolean {
  return status !== ALERT_STATUS.ok;
}

/**
 * The sentence for a status, or null when the parameter is absent or is
 * something nobody here wrote.
 *
 * NULL RATHER THAN A DEFAULT MESSAGE. A stranger can put ?alerte=anything in
 * a link and send it; rendering an unknown value as "something went wrong"
 * would let them put a false failure on somebody else's screen, and
 * rendering the VALUE would let them put words there outright.
 */
export function statusMessage(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  return Object.hasOwn(MESSAGES, value) ? MESSAGES[value as AlertStatus] : null;
}

/** Which status a failed parse maps to, so the handler has no opinion. */
export function statusForError(error: string): AlertStatus {
  if (error === ALERTES_COPY.errors.emailMissing) return ALERT_STATUS.missing;
  if (error === ALERTES_COPY.errors.emailInvalid) return ALERT_STATUS.invalid;
  if (error === ALERTES_COPY.errors.tooMany) return ALERT_STATUS.rate;

  return ALERT_STATUS.form;
}

/**
 * The confirmation and unsubscribe outcomes, as PATH SEGMENTS.
 *
 * A SEGMENT RATHER THAN A QUERY PARAMETER, and FW13 is why. Reading
 * searchParams in a page makes the route dynamic in Next 15.5.25, which emits
 * <title> and <link rel="canonical"> into the BODY instead of the head -
 * measured five ways in FW13 increment 2. These pages are transactional and
 * noindex-worthy, so the SEO cost would be nil, but the defect would still be
 * there for the next person to find and misdiagnose.
 *
 * With a segment and generateStaticParams, each outcome is its own statically
 * rendered page: head intact, cacheable, and an unknown segment is a 404
 * rather than a page rendering an attacker's string.
 */
export const CONFIRM_STATES = {
  confirmed: 'confirmee',
  expired: 'expiree',
  unknown: 'invalide',
} as const;

export const UNSUBSCRIBE_STATES = {
  unsubscribed: 'ok',
  unknown: 'invalide',
} as const;

export const CONFIRMATION_PATH = '/alertes/confirmation';
export const UNSUBSCRIBE_PATH = '/alertes/desinscription';
