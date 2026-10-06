// web/lib/fr/verification.ts
//
// The verification page's own words. FW-VERIFY (R330).
//
// ============================================================================
// IT CONFIRMS A DOCUMENT; IT DOES NOT CERTIFY ONE
// ============================================================================
//
// R330: the page vouches that the document is UNALTERED, never that its contents
// are correct, and it never says certifie, atteste, conforme, valide or approuve
// (the vocabulary ban). So the wording here says what is true - this releve
// CORRESPONDS to the one the service issued on a date - and nothing more. The
// field LABELS are not here: they are the document's own, taken from DOSSIER_COPY
// so the page and the releve cannot name the same figure two different ways
// (R206). Only the strings unique to confirming a document live below.
//
// NO COLON, SEMICOLON OR PERCENT in these strings, deliberately: the figures
// that carry those marks are formatted at render time (formatPercent sets the
// no-break space), so this file adds nothing to the R91 codepoint census.

import { APP_NAME } from '@/lib/fr';

// LOCAL apostrophe, as every lib/fr module defines its own (R126).
const APOS = String.fromCharCode(0x2019);

export const VERIFICATION_COPY = {
  title: `Vérification d${APOS}un relevé`,

  intro:
    `Cette page confirme qu${APOS}un relevé correspond à celui émis par ${APP_NAME}. ` +
    `Elle n${APOS}affiche que ce qui figure sur le document.`,

  /**
   * The vouch. R330: it says the document is the one the service issued on a
   * date - not that the figures are right. "correspond" and "émis", never a
   * banned word. The date arrives already formatted.
   */
  vouch: (date: string): string =>
    `Ce relevé correspond à celui émis par ${APP_NAME} le ${date}.`,

  /** The label for the one field the document does not have: the version. */
  version: 'Version',

  /**
   * A newer version exists. R330: say THAT one was issued and WHEN - never its
   * figures, which belong to its own code.
   */
  superseded: (date: string): string =>
    `Une version plus récente de ce relevé a été émise le ${date}.`,

  /**
   * The one neutral answer for an unknown, withdrawn or malformed code. R330:
   * identical for "never existed" and "erased", so it reveals neither.
   */
  unknown: `Aucun relevé ne correspond à ce code, ou il a été retiré.`,

  /** The rate-limit refusal. It reveals nothing about whether a code exists. */
  rateLimited:
    `Trop de vérifications depuis cet appareil. Veuillez réessayer dans quelques minutes.`,
} as const;
