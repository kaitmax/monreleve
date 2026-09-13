// web/lib/fr/alertes.ts
//
// The alert list, in French. FW14.
//
// WHO READS THIS. Somebody who has just been told how many telework days they
// have left and would like to know when the rule changes. They are not a
// customer, they have not made an account, and they have given one thing: an
// address. Everything here is written for a reader who can walk away at any
// point and should never feel that walking away is difficult.
//
// THE REGISTER IS THE PRODUCT'S (SPEC 6.5): plain, specific, no exclamation
// marks, no "super", no promises about frequency we have not decided to keep.
// The list exists to say when the rules change, and the copy says exactly
// that and nothing more generous.
//
// TODO-COPY: realistic French, not reviewed.

const NB = String.fromCharCode(0x00a0);
const APOS = String.fromCharCode(0x2019);

/** A punctuation mark with the no-break space French sets before it (R91). */
const n = (mark: string): string => `${NB}${mark}`;

export const ALERTES_COPY = {
  /**
   * The capture card's own heading. Not a call to action - a description of
   * what the thing is, so a reader who does not want it can skip it in one
   * glance.
   */
  heading: `Être prévenu quand la règle change`,

  /**
   * ONE SENTENCE, AND IT NAMES THE ONLY THING WE WILL SEND. A vaguer promise
   * ("nos actualités") would let the list drift into anything later without
   * the reader having agreed to it.
   */
  intro:
    `Les seuils et les accords fiscaux changent. Laissez votre adresse et ` +
    `nous vous écrivons quand c${APOS}est le cas${n(':')} rien d${APOS}autre.`,

  /** The field. Labelled, never a placeholder standing in for a label. */
  emailLabel: `Votre adresse e-mail`,

  /** The button. A verb, and the same verb the confirmation email echoes. */
  submit: `Me prévenir`,

  /**
   * Under the field, before anything is submitted. The double opt-in is not a
   * surprise to spring after the fact.
   */
  helper:
    `Vous recevrez un message de confirmation${n(';')} tant que vous ne l${APOS}avez ` +
    `pas ouvert, vous n${APOS}êtes pas inscrit.`,

  errors: {
    /**
     * The field was empty. Distinct from a malformed address on purpose:
     * telling somebody who typed nothing to "corriger leur saisie" is
     * telling them nothing.
     */
    emailMissing: `Indiquez une adresse e-mail pour recevoir les alertes.`,

    /** Something arrived, and it is not an address. */
    emailInvalid:
      `Cette adresse ne semble pas valide. Vérifiez qu${APOS}elle contient un ` +
      `«${NB}@${NB}» et un nom de domaine.`,

    /**
     * The hidden source field was missing or unknown. The reader cannot have
     * caused this by typing, so it does not tell them to check their address
     * - and it never echoes the value, because a reflected value is how a
     * reflected payload starts.
     */
    sourceInvalid:
      `Ce formulaire n${APOS}a pas pu être traité. Rechargez la page et ` +
      `réessayez${n(';')} si cela persiste, écrivez-nous.`,

    /**
     * Rate limited. Says what happened and when to come back, rather than
     * implying the reader did something wrong.
     */
    tooMany:
      `Trop de tentatives depuis cette connexion. Patientez quelques minutes ` +
      `avant de réessayer.`,

    /**
     * Anything else: the database is down, the mail service refused. The
     * reader did nothing wrong and there is nothing for them to fix, so it
     * says so and does not pretend the subscription worked.
     */
    unavailable:
      `Le service est momentanément indisponible. Réessayez dans quelques ` +
      `instants${n(';')} votre calcul, lui, reste affiché.`,
  },

  /**
   * THE SUCCESS MESSAGE IS THE SAME FOR A NEW ADDRESS AND FOR ONE ALREADY ON
   * THE LIST, and that is a security property rather than laziness.
   *
   * If a new address said "inscription enregistrée" and a known one said
   * "vous êtes déjà inscrit", then anybody could type an address into this
   * form and learn from the answer whether that person is on the list. That
   * is address enumeration, and on a list about cross-border tax compliance
   * the membership itself is the sensitive part: it says something about
   * where somebody works.
   *
   * So the page says the same thing either way - a confirmation email is on
   * its way if it is needed - and the difference is handled silently on the
   * server. tests/db/subscribe-enumeration.test.ts holds this, and
   * tests/db/subscribe-route.test.ts asserts the four answers are identical.
   */
  submitted:
    `C${APOS}est noté. Si cette adresse doit être confirmée, un message vient ` +
    `de partir${n(';')} ouvrez-le pour terminer votre inscription.`,

  /**
   * THE CONFIRMATION PAGE, once the link has been opened.
   *
   * Three outcomes and three pages, because the reader's next action
   * differs in each. A page that said "quelque chose s'est mal passé" for
   * all three would leave somebody whose link simply aged out with no idea
   * that subscribing again would work.
   */
  confirmation: {
    ok: {
      heading: `Votre inscription est confirmée`,
      body:
        `Vous recevrez un message lorsque les règles du télétravail ` +
        `frontalier changent. Chaque message contient un lien de ` +
        `désinscription en un clic.`,
    },
    expired: {
      heading: `Ce lien a expiré`,
      body:
        `Les liens de confirmation sont valables sept jours. Le vôtre a ` +
        `dépassé ce délai${n(';')} inscrivez-vous à nouveau et vous en ` +
        `recevrez un neuf.`,
    },
    unknown: {
      heading: `Ce lien n${APOS}est plus valable`,
      /**
       * ONE PAGE FOR "never existed" AND "already used", deliberately.
       * Telling them apart would let anybody feed tokens to the endpoint
       * and learn which were once real, and the reader's next step is the
       * same either way.
       */
      body:
        `Il a peut-être déjà servi${n(':')} un lien de confirmation ne ` +
        `fonctionne qu${APOS}une fois. Si vous n${APOS}êtes pas sûr d${APOS}être ` +
        `inscrit, recommencez${n(';')} vous ne recevrez pas deux fois le ` +
        `même message.`,
    },
  },

  /** The way off the list, and the page that says it worked. */
  unsubscribe: {
    /** The line in every send. Short, and it does not argue. */
    emailLink: `Se désinscrire en un clic`,

    done: {
      heading: `Vous êtes désinscrit`,
      /**
       * NO "are you sure", NO win-back, NO survey. The reader clicked a
       * link that said it would unsubscribe them in one click, and a page
       * that then asked them to confirm would have made that untrue.
       */
      body:
        `Nous ne vous écrirons plus. Votre adresse reste enregistrée ` +
        `uniquement pour ne pas vous réinscrire par erreur${n(';')} vous ` +
        `pouvez revenir quand vous voulez.`,
    },
    unknown: {
      heading: `Ce lien de désinscription n${APOS}est plus valable`,
      body:
        `Utilisez le lien du message le plus récent que vous avez reçu. ` +
        `Si vous n${APOS}en avez plus, écrivez-nous et nous vous retirerons ` +
        `de la liste.`,
    },
  },

} as const;
