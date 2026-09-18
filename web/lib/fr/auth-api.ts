// web/lib/fr/auth-api.ts
//
// What the API says to a human. FW22.
//
// SEPARATE FROM lib/fr/auth.ts, which is the email. These strings are API
// response bodies, and the protocol is explicit about the split: "Errors are
// French where a human reads them and stable codes where a client does."
//
// SO EVERY ERROR RESPONSE CARRIES BOTH. The `code` is ASCII, stable, and what
// the Android client branches on - it must never be translated, reworded or
// reordered, because a client in the field is reading it. The `message` is
// French, may be rewritten freely, and is what reaches a person when
// something surfaces in the interface or in a support conversation.
//
// A CLIENT THAT BRANCHES ON THE FRENCH IS A CLIENT THAT BREAKS when the copy
// improves. That is why the code exists, and why these two live in different
// fields rather than one string doing both jobs.
//
// R153: no figure is quoted here. A JSON string cannot interpolate from
// RuleSet any more than an email template can.
//
// TODO-COPY: realistic French, not reviewed.

const APOS = String.fromCharCode(0x2019);
const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it (R91). */
const n = (mark: string): string => `${NB}${mark}`;

export const AUTH_API_COPY = {
  /**
   * The one answer a sign-in request gets.
   *
   * IT DELIBERATELY SAYS "SI" - "if an account exists". Not because the
   * sentence is coy, but because it is the only accurate thing to say: the
   * server genuinely has not checked, and will not until the link is used.
   * A message promising "un lien vient de vous être envoyé" would be a claim
   * the server cannot make about an address it has not looked up, which is
   * the same overstatement this product refuses everywhere else.
   */
  linkSent:
    `Si un compte existe pour cette adresse, un lien de connexion vient d${APOS}y ` +
    `être envoyé. Il est valable quelques minutes et ne fonctionne qu${APOS}une fois.`,

  malformedBody: `Requête illisible${n(':')} le corps attendu est du JSON.`,

  /**
   * The 401 body.
   *
   * IT SAYS NOTHING ABOUT WHICH RULE FIRED, deliberately. That is the `code`
   * field's job, and it is the CLIENT that acts on it. A human reading this
   * string is a developer with the response in front of them or somebody in a
   * support conversation; neither is helped by "jeton expiré" on a request the
   * app should already have refreshed and retried without anyone noticing.
   */
  unauthorised: `Authentification requise${n(':')} cette requête doit porter un jeton valide.`,
} as const;
