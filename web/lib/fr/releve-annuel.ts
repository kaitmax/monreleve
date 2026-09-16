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

const NB = String.fromCharCode(0x00a0);
const n = (mark: string): string => `${NB}${mark}`;

export const RELEVE_COPY = {
  title: 'Le relevé annuel de télétravail',

  description:
    'Le document que ce produit existe pour produire : ce qu’il contiendra, ' +
    'et ce qui n’existe pas encore.',

  /**
   * THE FIRST SENTENCE SAYS IT DOES NOT EXIST, before anything describes it.
   * A page that opens by listing contents and mentions the absence at the
   * bottom has told the reader the opposite of the truth for three paragraphs.
   */
  lead:
    'Ce document n’existe pas encore. Cette page décrit ce qu’il contiendra ' +
    'et ce qu’il ne prétendra pas être, pour que vous sachiez dès ' +
    'maintenant si c’est ce que vous cherchez.',

  purposeHeading: 'À quoi il servira',

  purposeBody:
    'À montrer, journée par journée, ce que vous avez déclaré et quand vous ' +
    'l’avez déclaré. Un décompte reconstitué en fin d’année est une ' +
    'affirmation' +
    n(';') +
    ' un décompte dont chaque journée porte la date à laquelle elle a été ' +
    'enregistrée est autre chose. C’est la seule différence entre les deux ' +
    'documents, et c’est toute la raison d’être de celui-ci.',

  contentsHeading: 'Ce qu’il contiendra',

  contentsIntro:
    'Six parties, dans cet ordre. Rien de ce qui suit n’est encore produit.',

  /** SPEC 12's structure, top to bottom, in a reader's words. */
  contents: [
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
  ],

  vocabularyHeading: 'Ce qu’il ne dira jamais',

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
  vocabularyBody:
    'Il ne prétendra pas valoir preuve officielle, parce qu’il n’est pas en ' +
    'mesure de le prétendre. Il dira que vos journées ont été déclarées, ' +
    'enregistrées et horodatées, et rien de plus. Un document qui promet ' +
    'davantage que ce que son registre porte est un document qu’une ' +
    'administration a raison d’écarter.',

  stateHeading: 'Où en est ce document',

  stateBody:
    'Le calculateur fonctionne aujourd’hui et vous donne votre part ' +
    'annuelle. Le registre journalier et le document qui en découle ne sont ' +
    'pas construits. Cette page sera remplacée par le document lui-même ' +
    'quand il existera, et aucune date n’est annoncée ici tant qu’elle ' +
    'n’est pas tenue.',

  calculatorLink: 'Calculer ma part de télétravail',
  sourcesLink: 'Voir ce qui est vérifié, et ce qui ne l’est pas',
} as const;
