// web/lib/fr/mon-releve.ts
//
// Every word of the website's account area. FW-WEB-ACCOUNT (R908).
//
// THE PAGE'S NAME IS THE PRODUCT'S NAME. The queue calls the page "Mon releve"
// in ASCII (a transport constraint, R155/R168); its accented form is APP_NAME,
// read here rather than typed, so the two cannot drift (R181).
//
// TWO RULES SHAPE THE ERRORS, AND THEY POINT IN OPPOSITE DIRECTIONS ON PURPOSE:
//
//   - THE CODE STEP NAMES WHAT WENT WRONG. A wrong code, an expired code and a
//     spent code each get their own sentence, because the person holding the
//     code does something different for each (retype it, ask for another). The
//     existing /api/v1/auth/code route already distinguishes them (R198); the
//     page says in French what its codes say.
//   - A DEAD SESSION DOES NOT SAY WHY. Expired, revoked or unknown, the person
//     whose cookie no longer works reads ONE sentence (R210): telling an
//     unauthenticated caller which case fired would tell whoever holds a
//     stolen value whether the real session is still alive.
//
// THE ADDRESS STEP NEVER SAYS WHETHER AN ACCOUNT EXISTS (R901). Since Web
// Ruling 30 the server sends a code ONLY to an address the application already
// knows (lib/auth/request.ts, requestKnownAddressSignIn) - and answers every
// address alike. So the page after it cannot say a code is on its way: for an
// unknown address none is. It says the one thing true of both - a code is sent
// IF the address is an account's - and where an account is created.
//
// NO FIGURE IS TYPED (R153). The code's length, the session's life and the
// code's validity are values in lib/auth; the copy names them without numbers.

import { APP_NAME } from '@/lib/fr';

const APOS = String.fromCharCode(0x2019);
const NB = String.fromCharCode(0x00a0);
/** A punctuation mark with the no-break space French sets before it (R91). */
const n = (mark: string): string => `${NB}${mark}`;

export const MON_RELEVE_COPY = {
  /** The page's own name, and its <title>. */
  title: APP_NAME,

  /** The area is not indexed; this is its description for a reader's tab. */
  description: `Votre espace ${APP_NAME}${n(':')} vos chiffres de l${APOS}année et vos fichiers.`,

  // --------------------------------------------------------------------------
  // Step one: the address
  // --------------------------------------------------------------------------
  signIn: {
    title: `Se connecter à ${APP_NAME}`,
    lead:
      `Pas de mot de passe${n(':')} nous vous envoyons par e-mail un code à usage ` +
      `unique.`,
    emailLabel: 'Adresse e-mail',
    submit: 'Recevoir mon code',
    /**
     * The area is read-only, and the person is told before they sign in, so
     * nobody signs in looking for a way to note a day and finds none (R904).
     */
    readOnlyNote:
      `Cet espace permet de consulter vos chiffres et de télécharger vos ` +
      `fichiers. Vos journées se notent dans l${APOS}application.`,
  },

  // --------------------------------------------------------------------------
  // Step two: the code
  // --------------------------------------------------------------------------
  code: {
    title: 'Vérifiez votre messagerie',
    /**
     * The address arrives decrypted from the step seal; never from the URL in clear.
     *
     * CONDITIONAL, AND THAT IS THE POINT (Web Ruling 30, W12). C9 wrote "a code
     * was requested for this address; it arrives by e-mail in a few moments",
     * true when the server mailed every address. It now mails only an
     * account's, and answers both alike, so the sentence says what holds for
     * both: a code is sent if an account uses this address. The second
     * sentence tells a person with no account why nothing arrives.
     */
    requested: (email: string): string =>
      `Si un compte ${APP_NAME} utilise l${APOS}adresse ${email}, un code de ` +
      `connexion vient de lui être envoyé par e-mail. Le compte se crée depuis ` +
      `l${APOS}application.`,
    change: 'Modifier l’adresse',
    codeLabel: 'Code reçu par e-mail',
    /**
     * THE LINK IN THE SAME E-MAIL OPENS THE APPLICATION, not this page - it is
     * the App Link the app signs in with (R195), and it consumes the same
     * request as the code. Saying so here is what stops a person on a
     * computer from tapping it and losing the code they were about to type.
     */
    help:
      `Le code ne fonctionne qu${APOS}une fois. Sur le site, saisissez le code${n(';')} ` +
      `le lien du même e-mail sert à ouvrir l${APOS}application.`,
    submit: 'Valider le code',
    restart: 'Demander un nouveau code',
  },

  /**
   * What the address page says when it is reached again with a reason.
   * Keys are the closed set of `etat` values the handlers redirect with.
   */
  states: {
    'adresse-invalide': 'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.',
    'demande-expiree': `Votre demande a expiré. Saisissez à nouveau votre adresse pour recevoir un nouveau code.`,
    // R210: one sentence for an expired, a revoked and an unknown session.
    'session-terminee': `Votre session a pris fin. Connectez-vous à nouveau pour continuer.`,
    deconnecte: 'Vous êtes déconnecté.',
    indisponible: `La connexion est momentanément indisponible. Réessayez plus tard.`,
    /**
     * Reached only AFTER a correct code, so it is not an enumeration oracle:
     * the person has proven the address is theirs (R901). Since Web Ruling 30
     * no code is sent to an address without an account, so this is reached
     * only when the account was deleted between the two steps. The website
     * never creates an account (Web Ruling 30, R904), so it says where one is
     * created instead.
     */
    'aucun-compte':
      `Aucun compte n${APOS}est associé à cette adresse. Le compte se crée depuis ` +
      `l${APOS}application${n(';')} le site permet ensuite de le consulter.`,
  },

  /** What the code page says when the exchange was refused. Keys are the `erreur` values. */
  errors: {
    'code-invalide': `Ce code ne correspond pas. Vérifiez-le et réessayez.`,
    'code-expire': `Ce code a expiré. Demandez-en un nouveau.`,
    'trop-d-essais': `Trop d${APOS}essais pour ce code. Demandez-en un nouveau.`,
    limite: `Trop de tentatives depuis cette connexion. Patientez quelques minutes avant de réessayer.`,
    format: `Le code ne contient que des chiffres. Vérifiez-le et réessayez.`,
  },

  /** The 403 a cross-origin request gets (R902). Plain text: nobody's form posts here legitimately. */
  crossOrigin: `Requête refusée${n(':')} elle ne provient pas de ce site.`,

  // --------------------------------------------------------------------------
  // The signed-in page
  // --------------------------------------------------------------------------
  page: {
    signedInAs: (email: string): string => `Connecté avec ${email}`,
    signOut: 'Se déconnecter',
    /**
     * The year the figures are for, as its section's heading. The page shows
     * two years, the current tax year and the one before, with no selector
     * (Web Ruling 32) - so C9's two links between them are gone.
     */
    yearHeading: (year: number): string => `Votre année ${year}`,
    /**
     * WHERE THE NUMBERS COME FROM, said once. They are the engine's, on the
     * server, from the days recorded in the application - the same figures the
     * application shows (R903). The page never claims to have counted them.
     */
    figuresNote:
      `Ces chiffres sont calculés par le serveur à partir des journées ` +
      `enregistrées dans l${APOS}application${n(';')} ce sont ceux qu${APOS}elle affiche.`,
    /** R516's rule, here: an empty year says so before any figure. */
    emptyYear: (year: number): string =>
      `Aucune journée n${APOS}est encore enregistrée pour ${year}. Les chiffres ` +
      `ci-dessous le reflètent.`,
    /** No name or no canton: the dossier cannot be built, and the page says what to do. */
    incomplete:
      `Pour afficher vos chiffres et télécharger vos fichiers, renseignez votre ` +
      `nom et votre canton dans l${APOS}application.`,
    /** A year before the person's activity began. */
    beforeActivity: (year: number): string =>
      `Votre activité commence après ${year}${n(':')} il n${APOS}y a pas de chiffres ` +
      `pour cette année.`,
    /**
     * Each year has its own two downloads, so each button names its year: four
     * buttons with two names would be ambiguous to a screen reader listing the
     * page's controls. The year is a label, interpolated raw (never grouped).
     */
    downloadPdf: (year: number): string => `Télécharger le relevé ${year} (PDF)`,
    downloadCsv: (year: number): string => `Télécharger les journées ${year} (CSV)`,
    /**
     * THE PDF DOWNLOAD IS A WRITE, AND THE PERSON IS TOLD. Every PDF the
     * service produces is recorded as an issuance and supersedes the current
     * version (R329) - which is why it is a POST behind the same-origin check.
     */
    downloadsNote:
      `Chaque PDF téléchargé est enregistré comme une nouvelle version du ` +
      `relevé de l${APOS}année.`,
    exportFailed: `Le fichier n${APOS}a pas pu être produit. Réessayez dans un instant.`,
  },
} as const;

/** The closed set of address-page states. */
export type SignInState = keyof typeof MON_RELEVE_COPY.states;

/** The closed set of code-page errors. */
export type CodeError = keyof typeof MON_RELEVE_COPY.errors;

export function isSignInState(value: unknown): value is SignInState {
  return typeof value === 'string' && Object.hasOwn(MON_RELEVE_COPY.states, value);
}

export function isCodeError(value: unknown): value is CodeError {
  return typeof value === 'string' && Object.hasOwn(MON_RELEVE_COPY.errors, value);
}
