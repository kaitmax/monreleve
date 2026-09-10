// web/lib/fr/provisional.ts
//
// RULING R110's copy: the notice that appears when the user's own input
// depends on a regulatory reading still awaiting expert review.
//
// WHAT IT HAS TO DO, and it is a narrow brief. Name WHICH reading is pending,
// say that review is pending, and stop. It must not apologise, must not
// estimate a probability, and must not tell the reader the number is wrong -
// the calculation follows the reading the tax administration's own published
// cases support; what is unsettled is whether that reading generalises.
//
// SPEC 20 IS AT ITS MOST DANGEROUS HERE. This is copy about the status of a
// rule, which is the single most tempting place to write "conforme" - and the
// vocabulary guard is pointed directly at these strings in
// tests/unit/pages/calculateur-accordion.test.tsx. Declare, enregistre,
// horodate; never certifie, atteste, conforme.
//
// NO FIGURES (R73). The readings concern an order and a proration, not a
// threshold, so there is nothing here that could go stale - but the rule holds
// anyway and no number appears.
//
// TODO-COPY: realistic French, not reviewed by counsel - which is a little
// pointed for copy that is itself about pending review, and true.

import type { ProvisionalId } from '@/lib/content/provisional';

export interface ProvisionalItem {
  /** Which reading, in a phrase that completes the lead sentence. */
  readonly interpretation: string;
  /** What is unsettled, and what it changes. */
  readonly body: string;
}

export const PROVISIONAL_COPY = {
  /**
   * The heading. Not "attention" and not a warning word: this is a statement
   * about a rule's status, not about a mistake the user has made.
   */
  lead: 'Une lecture encore soumise à validation',

  /**
   * The link out, and it says what is at the other end.
   *
   * NOT "EN SAVOIR PLUS" AND NOT THE PATH. SPEC 16 wants a link whose
   * accessible name says where it goes, and a reader who has just been told
   * that a reading of the rules is unsettled wants to know what they will
   * find: the reading itself, its source, and what is pending about it.
   * "/sources" is a path, which is a fact about the site rather than about
   * the destination.
   */
  readMore: 'Lire cette lecture et sa source',

  /** Said once, whichever readings are involved. */
  pending:
    "Cette lecture attend la validation d’un expert. Le calcul suit les cas " +
    "publiés par l’administration fiscale, et votre résultat peut évoluer si " +
    'la lecture retenue change.',

  items: {
    P1: {
      interpretation: "l’ordre d’imputation des jours de mission",
      body:
        'Vos jours de mission concernent à la fois la France et un pays ' +
        "tiers. Le calcul impute d’abord les jours en France sur le quota " +
        'annuel, puis ceux du pays tiers. Cet ordre détermine la part de ' +
        'chacun qui reste dans le régime.',
    },
    P3: {
      interpretation: 'la réduction du quota de missions au décompte exact',
      body:
        'Vous utilisez le décompte exact avec un temps partiel ou une année ' +
        'incomplète. Le calcul réduit le quota de jours de mission dans la ' +
        'même proportion, comme il le fait pour la base simplifiée.',
    },
  } satisfies Record<ProvisionalId, ProvisionalItem>,
} as const;
