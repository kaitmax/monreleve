// web/lib/fr/releve-annuel.ts
//
// The offer page for the Relevé annuel de télétravail - SPEC 12's document,
// which does not exist yet.
//
// R166: IT IS A DEAD LINK FROM A LIVE PAGE. The calculator's `compliant`
// contextual link has pointed here since FW12, so the reader who reaches the
// best outcome the product has is the one who gets a 404.
//
// EVERY SENTENCE ABOUT THE DOCUMENT IS FUTURE OR CONDITIONAL (R138, R166).
// "Le relevé contient" is false today. This is the discipline the analytics
// sentence is already under - describing what the code does, not what it will
// do - applied to a product claim instead of a privacy one, and inverted: here
// the code does nothing yet, so the tense is the future.
//
// R172: THE TENSE IS NOW A FUNCTION OF THE FACT, and this page is the reason
// the rule is worth its weight. It was the only one of FW20's three that was
// RIGHT, which is exactly why it was going to become wrong: the day the
// document ships, a page still saying "n'existe pas encore" is the same
// contradiction pointing the other way, and nothing would have caught it
// either. Seven strings here change with `dossierExists` and one with
// `trackerExists`.
//
// HALF-DERIVED WOULD BE WORSE THAN NOT DERIVED. A lead reading "Ce document
// existe" above a heading reading "Ce qu'il contiendra" is R172's own defect
// inside one page instead of between three, so every string whose truth
// depends on the flag takes it - headings included. My own R154 work already
// made the mistake of checking bodies and not headings once.
//
// EVERY STATEMENT TRACES TO SPEC 12. The structure list below is its numbered
// sections 1 to 6 and its CSV column list, in a reader's words. Anything SPEC
// 12 does not specify is not written - R146 case (c), one surface over. In
// particular: no date, no "bientôt", no waiting list, no price (that is
// /tarifs), and no picture of a document nobody has produced.
//
// THE VOCABULARY RULE IS SPEC 12's OWN and it is stricter here than anywhere:
// "The document never uses certifié, attesté, conforme, validé, or approuvé.
// It says déclaré, enregistré, horodaté." A page selling the document has no
// licence the document itself lacks.

import type { ProductState } from '@/lib/content/product-state';
import { cardinal, n } from './compose';

/**
 * SPEC 12's structure, top to bottom, in a reader's words.
 *
 * HOISTED OUT OF THE OBJECT so the sentence that counts it can read its
 * length. It said "Six parties" as a typed word, which is R163's defect
 * exactly: not a figure R147 can see, but a value derived from something in
 * the same file, and adding a seventh part would have left the prose lying
 * with every suite green.
 */
const CONTENTS = [
  'Votre identification' +
    n(':') +
    ' nom, canton, taux d’activité, méthode de calcul retenue, période ' +
    'couverte et date de génération du document.',
  'Quatre totaux' +
    n(':') +
    ' jours ouvrés, jours en Suisse, jours de télétravail, jours de ' +
    'mission.',
  'Votre part annuelle, en toutes lettres, avec la phrase qui nomme les ' +
    'deux seuils et non le seul qui vous concerne.',
  'Le détail mois par mois' +
    n(':') +
    ' Suisse, domicile, missions en France, missions hors de France, et le ' +
    'cumul déclarable.',
  'L’annexe des journées, dépliée en entier' +
    n(':') +
    ' chaque journée avec sa date, sa portion, sa nature, son horodatage ' +
    'd’enregistrement, son éventuel marquage de saisie tardive, et la ' +
    'façon dont elle est arrivée là. Les journées sans saisie y figurent ' +
    'comme non renseignées plutôt que d’être passées sous silence.',
  'Le pied de page légal, qui redit ce que le document est et n’est pas.',
] as const;

// The count in words (cardinal) moved to ./compose (R206): FW34 needs the same
// helper for the home page, and it now takes the gender. "parties" is feminine,
// so this file asks for "Une".

export const RELEVE_COPY = {
  title: 'Le relevé annuel de télétravail',

  description: (state: ProductState): string =>
    state.dossierExists
      ? 'Le document que ce produit existe pour produire' +
        n(':') +
        ' ce qu’il contient, et ce qu’il ne prétend pas être.'
      : 'Le document que ce produit existe pour produire' +
        n(':') +
        ' ce qu’il contiendra, et ce qui n’existe pas encore.',

  /**
   * THE FIRST SENTENCE SAYS IT DOES NOT EXIST, before anything describes it.
   * A page that opens by listing contents and mentions the absence at the
   * bottom has told the reader the opposite of the truth for three paragraphs.
   *
   * And when it does exist, the first sentence is the one that has to stop
   * saying so - which is why this is a branch rather than a correction
   * somebody will have to remember to make.
   */
  lead: (state: ProductState): string =>
    state.dossierExists
      ? 'Cette page décrit ce que contient ce document et ce qu’il ne ' +
        'prétend pas être, pour que vous sachiez si c’est ce que vous ' +
        'cherchez.'
      : 'Ce document n’existe pas encore. Cette page décrit ce qu’il ' +
        'contiendra et ce qu’il ne prétendra pas être, pour que vous ' +
        'sachiez dès maintenant si c’est ce que vous cherchez.',

  purposeHeading: (state: ProductState): string =>
    state.dossierExists ? 'À quoi il sert' : 'À quoi il servira',

  purposeBody:
    'À montrer, journée par journée, ce que vous avez déclaré et quand vous ' +
    'l’avez déclaré. Un décompte reconstitué en fin d’année est une ' +
    'affirmation' +
    n(';') +
    ' un décompte dont chaque journée porte la date à laquelle elle a été ' +
    'enregistrée est autre chose. C’est la seule différence entre les deux ' +
    'documents, et c’est toute la raison d’être de celui-ci.',

  contentsHeading: (state: ProductState): string =>
    state.dossierExists ? 'Ce qu’il contient' : 'Ce qu’il contiendra',

  contentsIntro: (state: ProductState): string =>
    `${cardinal(CONTENTS.length, 'une')} parties, dans cet ordre.` +
    (state.dossierExists ? '' : ' Rien de ce qui suit n’est encore produit.'),

  contents: CONTENTS,

  vocabularyHeading: (state: ProductState): string =>
    state.dossierExists ? 'Ce qu’il ne dit jamais' : 'Ce qu’il ne dira jamais',

  /**
   * IT DOES NOT NAME THE FORBIDDEN WORDS, EVEN TO DISCLAIM THEM.
   *
   * The first draft said "il ne dira pas que vos journées sont certifiées,
   * attestées ou conformes" - a disclaimer, and still a violation:
   * tests/support/vocabulary.ts matches /certifi(?!cat)/, which permits the
   * NOUN "certificat" and refuses every verb form regardless of the sentence
   * around it. That strictness is deliberate and already argued there.
   *
   * It is also the right call for this page. A sentence listing the three
   * words a document will not use puts them in front of a reader in the
   * context of that document, which is most of the damage the rule exists to
   * prevent. Saying what it WILL say is stronger and shorter.
   */
  vocabularyBody: (state: ProductState): string =>
    (state.dossierExists
      ? 'Il ne prétend pas valoir preuve officielle, parce qu’il n’est pas ' +
        'en mesure de le prétendre. Il dit que vos journées ont été ' +
        'déclarées, enregistrées et horodatées, et rien de plus. '
      : 'Il ne prétendra pas valoir preuve officielle, parce qu’il n’est ' +
        'pas en mesure de le prétendre. Il dira que vos journées ont été ' +
        'déclarées, enregistrées et horodatées, et rien de plus. ') +
    'Un document qui promet davantage que ce que son registre porte est un ' +
    'document qu’une administration a raison d’écarter.',

  stateHeading: 'Où en est ce document',

  /**
   * THE SENTENCE FW20 GOT RIGHT, and the one this increment exists to stop
   * getting wrong later. It names what is missing, and what is missing is now
   * read off the flags rather than typed.
   */
  stateBody: (state: ProductState): string => {
    const missing = [
      state.trackerExists ? null : 'le registre journalier',
      state.dossierExists ? null : 'le document qui en découle',
    ].filter((one): one is string => one !== null);

    if (missing.length === 0) {
      return (
        'Le registre et le document existent tous les deux. Cette page ' +
        'décrit ce que vous pouvez produire à partir de vos journées.'
      );
    }

    // Concatenated rather than interpolated, for the reason tarifs.ts states:
    // an operator inside a template literal lands inside the quoted span
    // R91's source scan reads, and reads there as a French typography
    // offence.
    const only = missing[0] ?? '';
    const subject =
      missing.length > 1
        ? missing.join(' et ') + ' ne sont pas construits'
        : only + ' n’est pas construit';

    return (
      'Le calculateur fonctionne aujourd’hui et vous donne votre part ' +
      'annuelle. ' +
      subject.charAt(0).toUpperCase() +
      subject.slice(1) +
      '. Cette page sera remplacée par le document lui-même quand il ' +
      'existera, et aucune date n’est annoncée ici tant qu’elle n’est pas ' +
      'tenue.'
    );
  },

  calculatorLink: 'Calculer ma part de télétravail',
  sourcesLink: 'Voir ce qui est vérifié, et ce qui ne l’est pas',
} as const;
