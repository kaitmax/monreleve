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

  /**
   * The callback's refusal. One sentence for four causes - unknown, expired,
   * already used, wrong address - because the reader does the same thing in
   * all four, and because saying which would tell whoever holds a stale link
   * whether it was ever valid.
   */
  invalidLink:
    `Ce lien n${APOS}est plus valable. Les liens de connexion expirent après ` +
    `quelques minutes et ne fonctionnent qu${APOS}une fois${n(';')} demandez-en un ` +
    `nouveau depuis l${APOS}application.`,

  /**
   * The refresh route's refusal. ONE SENTENCE FOR EVERY CAUSE - unknown,
   * expired, already rotated, revoked, and replayed.
   *
   * R210 ASKS THAT A REPLAY BE DISTINGUISHABLE FROM AN EXPIRY, AND THIS IS
   * NOT WHERE THAT HAPPENS. Saying "ce lien a deja servi" here would tell an
   * unauthenticated caller which case fired, and the caller holding a
   * replayed token is the thief: they would learn that the legitimate client
   * is still active, which is the one thing the refusal must not confirm.
   *
   * SO THE SENTENCE IS WRITTEN FOR THE STALE USER, who is the common case and
   * the one R210 protects: calm, factual, and actionable. Somebody whose
   * session simply lapsed is told it lapsed.
   *
   * THE REPLAY IS SURFACED AFTER RE-AUTHENTICATION, not instead of this. The
   * reason is recorded on DeviceSession.revokedReason = TOKEN_REPLAYED, and a
   * person who signs in again has proven they own the address - at which
   * point telling them a session was ended for security costs an attacker
   * nothing. FW26 builds the account screen where that belongs; no field is
   * added to this response for it today, because a field no client reads is a
   * promise to a client that will eventually read it (R187).
   */
  invalidRefresh: `Session expirée${n(':')} reconnectez-vous depuis l${APOS}application.`,

  /**
   * A payload carrying a coordinate. SPEC 13.1 / D18.
   *
   * IT NAMES NO VALUE, ONLY THE RULE. The keys are echoed to the client so a
   * developer can find them; the VALUES never are - not in the response, not
   * in a log line. A coordinate this product refuses to store must not survive
   * in an error message about refusing to store it, which is the shape of
   * mistake that makes a promise technically true and practically false.
   */
  coordinateRefused:
    `Cette requête contient des données de localisation. Le service n${APOS}en ` +
    `accepte aucune${n(':')} ni latitude, ni longitude, ni altitude, ni vitesse. ` +
    `La détection de pays se fait sur votre appareil et la position n${APOS}en ` +
    `sort jamais.`,

  payloadTooLarge:
    `Cet envoi est trop volumineux. Découpez-le en plusieurs envois plus ` +
    `petits${n(';')} l${APOS}application le fait normalement toute seule.`,

  invalidPayload:
    `Cet envoi ne correspond pas à ce que le service attend. Le détail des ` +
    `champs en cause accompagne cette réponse.`,

  /**
   * Two items for one day in one batch, or one client id used twice.
   *
   * IT NAMES THE CLIENT'S MISTAKE RATHER THAN OUR FAILURE. « Latest server
   * receipt wins » cannot settle a tie inside a single batch, because both
   * items arrived at the same instant - so the server refuses rather than
   * picking one by array order, which would be a rule nobody wrote.
   */
  batchConflict:
    `Cet envoi contient deux versions d${APOS}une même journée. L${APOS}application ` +
    `doit n${APOS}en envoyer qu${APOS}une${n(';')} réessayez depuis l${APOS}application.`,

  writeFailed:
    `Le service n${APOS}a pas pu enregistrer cet envoi. Rien n${APOS}a été modifié${n(';')} ` +
    `l${APOS}application réessaiera.`,

  /**
   * The read path's year parameter. FW23 increment 4.
   *
   * IT DESCRIBES THE SHAPE AND NAMES NO YEAR. R153: a figure typed where a
   * constant cannot reach it is the copy that goes stale - and an example year
   * in an error message is stale the moment it passes.
   */
  invalidYear:
    `L${APOS}année demandée est absente ou mal formée${n(':')} elle s${APOS}écrit ` +
    `sur quatre chiffres.`,

  /**
   * A query parameter the route does not know.
   *
   * REFUSED RATHER THAN IGNORED, for the reason `.strict()` exists on the write
   * payload: a client sending something the server silently drops has been told
   * it worked. A client that sends a filter we ignore receives a whole year and
   * believes it received a slice.
   *
   * THE OFFENDING KEYS ACCOMPANY THE ANSWER, because this refusal can be
   * triggered by something outside the client's control - a proxy appending a
   * cache-buster - and a total failure whose cause is invisible is a hunt
   * through somebody else's infrastructure. Named, it is in the client's own
   * crash report.
   */
  unknownParameter:
    `Cette requête contient un paramètre que le service ne connaît pas. Les ` +
    `paramètres en cause accompagnent cette réponse.`,

  readFailed:
    `Le service n${APOS}a pas pu lire ces journées${n(';')} l${APOS}application ` +
    `réessaiera.`,

  signedOut: `Vous êtes déconnecté de cet appareil.`,

  revokedAll: `Vous êtes déconnecté de tous vos appareils.`,

  /**
   * AN-ONBOARD: the six-digit code exchange refusals.
   *
   * A WRONG-CODE MESSAGE SAYS HOW TO RECOVER, never just « erreur » (the relay's
   * O1). The same message answers an unknown address as answers a wrong guess -
   * no enumeration - which is why it does not say « ce code » as if one existed.
   */
  invalidCode:
    `Ce code n${APOS}est pas valable. Vérifiez les six chiffres et réessayez, ou ` +
    `demandez un nouveau code depuis l${APOS}application.`,

  /** The request existed but its window passed. The link and the code expire together. */
  codeExpired:
    `Ce code a expiré. Les codes de connexion ne sont valables que quelques ` +
    `minutes${n(';')} demandez-en un nouveau depuis l${APOS}application.`,

  /**
   * The per-request attempt limit was reached, so the request is dead - even for
   * the right code. The person asks for a new one.
   */
  tooManyAttempts:
    `Trop de tentatives pour ce code. Par sécurité, il n${APOS}est plus ` +
    `valable${n(':')} demandez un nouveau code depuis l${APOS}application.`,

  /** The edge's own per-address / per-network limit on the exchange endpoint. */
  codeRateLimited:
    `Trop de demandes depuis cet appareil. Patientez un instant avant de réessayer.`,
} as const;
