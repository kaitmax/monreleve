// web/lib/fr/params.ts
//
// The notice a mangled link shows. SPEC 9.4: "invalid values fall back to
// default and surface a dismissible notice, never a blank page (Facebook
// mangles URLs; degrading beats 404)."
//
// WHO READS THIS. Somebody who clicked a link in a Facebook thread and landed
// on a calculator that is not quite showing what the sender saw. They did
// nothing wrong, the sender did nothing wrong, and a platform rewrote the URL
// between them - so the notice explains, names what was dropped, and gets out
// of the way. It does not apologise, it does not tell them to ask the sender
// to resend it, and it never suggests the numbers on screen are wrong: the
// ones that survived are exactly as correct as they were in the sender's
// browser.
//
// IT NAMES THE PARAMS, and that is a deliberate choice about audience. The
// alternative - "certains parametres" - is friendlier and useless: a reader
// who can see that `taux` was dropped can retype their rate, and a reader who
// cannot is no worse off for the word being there. The names are the public
// contract (SPEC 9.4); they are already in the address bar.
//
// TODO-COPY: realistic French, not reviewed.

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it (R91). */
const n = (mark: string): string => `${NB}${mark}`;

export const PARAM_NOTICE = {
  /**
   * The heading. INFO, not warning: nothing is broken, and the result below is
   * a real answer to the values that arrived.
   */
  lead: 'Lien incomplet',

  /**
   * Values that arrived but could not be read. They fell back to the
   * calculator's defaults, which is why there is still a result.
   */
  invalid: (names: readonly string[]): string =>
    `Ces valeurs du lien n${String.fromCharCode(0x2019)}ont pas pu être lues et ont repris leur ` +
    `valeur par défaut${n(':')} ${names.join(', ')}.`,

  /**
   * Params this calculator does not know. Usually a tracking parameter a
   * platform appended, which is harmless and worth saying so.
   */
  ignored: (names: readonly string[]): string =>
    `Ces paramètres ne sont pas utilisés par le calculateur${n(':')} ${names.join(', ')}.`,

  /** What to do about it, in one line. */
  advice:
    'Vous pouvez corriger les champs ci-dessus' +
    `${n(';')} le lien que vous partagerez sera à jour.`,

  /** The dismiss control. SPEC 9.4 requires the notice to be dismissible. */
  dismiss: 'Masquer cet avertissement',
} as const;

/**
 * The share row. SPEC 9.4's growth mechanic, in two buttons.
 *
 * "COPIER LE LIEN" IS FIRST because it is the one that always works. The
 * native share sheet is better where it exists and does not exist on most
 * desktops, so the button that is always there leads.
 *
 * THE CONFIRMATION IS A SENTENCE, NOT A WORD. It is announced through a polite
 * live region and it STAYS - the prompt's "not a toast that vanishes" - so it
 * has to read as a statement rather than as a label that happened to change.
 *
 * TODO-COPY: realistic French, not reviewed.
 */
export const SHARE_COPY = {
  /** The row's own heading, so the two buttons are not loose on the page. */
  heading: 'Partager ce calcul',

  /** Says WHAT is copied. "Copier" alone leaves the reader guessing. */
  copy: 'Copier le lien',

  /**
   * Present tense, and it names what was copied: a reader who tabs back to
   * this region a minute later should still learn something from it.
   */
  copied: `Lien copié dans le presse-papiers${n(':')} il contient vos valeurs.`,

  /**
   * The clipboard can refuse - a permissions policy, a non-secure context, a
   * browser that simply says no. The address bar still holds the link, so the
   * message points at it rather than apologising.
   */
  copyFailed:
    `La copie a échoué${n(':')} vous pouvez copier l’adresse depuis la barre ` +
    'du navigateur.',

  /** Only rendered where navigator.share exists. */
  share: 'Partager',

  /** The title the native sheet shows above the link. */
  shareTitle: 'Mon calcul de télétravail frontalier',
} as const;
