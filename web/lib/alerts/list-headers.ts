// web/lib/alerts/list-headers.ts
//
// RFC 8058 one-click unsubscribe. FW27 increment 5, assigned by R141.
//
// ============================================================================
// WHY A HEADER WHEN THE MESSAGE ALREADY CARRIES THE LINK
// ============================================================================
//
// The link in the body is for a person. These headers are for the MAIL CLIENT:
// Gmail, Outlook and Apple Mail each render their own unsubscribe control from
// them, at the top of the message, before the reader has to look for anything.
// A reader who cannot find the way off a list marks it as spam instead, and
// that is a domain-level cost paid by every later message.
//
// ============================================================================
// THE POST IS SAFE IN THE DIRECTION A PREFETCH CANNOT HURT
// ============================================================================
//
// RFC 8058 has the mail client POST without asking a human. That is the same
// hazard FW14 weighed for the GET link and answered the same way: the action
// is IDEMPOTENT and REVERSIBLE, the row is kept rather than deleted, and the
// reader can subscribe again. A prefetch that unsubscribes somebody costs them
// one re-subscription.
//
// IT IS THE OPPOSITE OF FW22's MAGIC LINK, where a prefetch BURNS a credential
// and the person cannot sign in. Same mechanism, opposite direction, and the
// direction is what decides.
//
// ============================================================================
// ONE URI, NOT TWO
// ============================================================================
//
// RFC 2369 permits a `mailto:` alternative beside the https one, and RFC 8058
// §2 requires the one-click POST to go to an https URI. A mailto: this product
// does not read would be a published promise nobody keeps - the same defect as
// an assetlinks.json served before it can be believed (R205). So the header
// carries exactly the URI that works.

/** The body RFC 8058 §3.1 specifies for the one-click POST. */
export const ONE_CLICK_BODY = 'List-Unsubscribe=One-Click';

/**
 * The two headers every list message carries.
 *
 * `url` must be the absolute https URL of the unsubscribe endpoint, token
 * included - it is what the mail client POSTs to, with no human present to
 * supply anything else.
 */
export function listUnsubscribeHeaders(url: string): Readonly<Record<string, string>> {
  return {
    // Angle brackets are part of the syntax (RFC 2369), not decoration.
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': ONE_CLICK_BODY,
  };
}
