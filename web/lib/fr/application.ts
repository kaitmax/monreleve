// web/lib/fr/application.ts
//
// SPEC 9.1's /application, and the hardest page on the site to keep honest.
//
// THE APP DOES NOT EXIST. There is no android/ directory in this repository -
// the siblings of web/ are docs, fixtures, prompts, relay and tasks - and the
// AN series that builds one has not started. So every sentence about what it
// does is written in the future, DERIVED from PRODUCT_STATE.appExists rather
// than typed, and e2e asserts no present-tense claim survives on the page.
// R138's tense discipline, applied to a product claim instead of a privacy
// one.
//
// WHAT FD12 SPECIFIES AND THIS PAGE DOES NOT CARRY, each for the same reason.
// The brief describes the page the app deserves once it ships:
//
//   store badges      There is nothing to download. A Google Play badge on a
//                     page for an unbuilt app is the most concrete lie the
//                     site could tell, because a reader would click it.
//   two screenshots   FD12 specifies the exact pixels of an Aujourd'hui
//                     screen and an exported PDF. Neither exists, and drawing
//                     them would be an illustration of a product rather than
//                     a picture of one - R146 case (c).
//   "Gratuit en 2027" Priced on /tarifs, from PRODUCT_STATE, where the list
//                     of what is free derives from what is built.
//
// FD12 IS NOT WRONG, IT IS EARLY. Its structure is kept in full: the two
// modes as equals, the refusals band before any argument to install, the
// closing pointer to the calculator rather than to a store. What is dropped
// is what cannot be true yet, and the report says so rather than letting a
// future reader think the brief was ignored.
//
// ---------------------------------------------------------------------------
// THE TRAP IS THE TWO MODE CARDS, and FD12 names it precisely: manual and
// automatic are MECHANICALLY IDENTICAL. Same dimensions, same weights, same
// grey icon squares, and THE SAME GREEN CHECK ON EVERY LINE - including the
// line about needing access to the device's position.
//
// A REQUIREMENT IS NOT A DRAWBACK. The moment that line renders as a warning,
// manual becomes the safe choice and automatic the risky one, and the page
// has quietly taken a side on a decision that is the reader's. It is the
// same defect as a highlighted middle column in a pricing table, which SPEC
// D3 refuses on /tarifs - here it would be dressed as candour.
//
// SO THE TWO CARDS COME OUT OF ONE SHAPE. Not two objects that happen to
// match today: one type, one renderer, one list of lines per card, and a test
// asserting the rendered geometry and glyph counts agree. Two objects written
// side by side are two objects somebody edits one of.
// ---------------------------------------------------------------------------

import type { ProductState } from '@/lib/content/product-state';

const NB = String.fromCharCode(0x00a0);
const n = (mark: string): string => `${NB}${mark}`;

/**
 * One logging mode.
 *
 * NO `recommended`, NO `badge`, NO `tone` FIELD. The type is the guard: there
 * is no way to express "this one is better" in it, so no future edit can add
 * the distinction without adding the field, and adding the field is a visible
 * decision rather than a styling tweak.
 */
export interface LoggingMode {
  readonly id: 'manuelle' | 'automatique';
  readonly title: string;
  /**
   * THE TENSE IS A FUNCTION OF THE FACT, like every other sentence here.
   *
   * THE READ-THROUGH FOUND THIS, in my own work, after the page was built.
   * The lead said the application does not exist and the refusals band was
   * entirely in the future, while both cards described it in the PRESENT:
   * "la journee est enregistree", "l’application compare ... et vous
   * propose", "Fonctionne hors connexion". That is the defect
   * lib/fr/releve-annuel.ts argues against in its own comment - half-derived
   * is worse than not derived, because a lead saying one thing above a
   * section saying another is R172 inside a single page.
   */
  readonly body: (state: ProductState) => string;
  /**
   * The facts about this mode.
   *
   * EVERY ONE RENDERS WITH THE SAME AFFIRMATIVE GLYPH, including
   * the one naming the background-location requirement. There is no `kind`
   * here for the same reason there is no `recommended` above.
   */
  readonly lines: (state: ProductState) => readonly string[];
}

export const APPLICATION_COPY = {
  title: 'L’application',

  description: (state: ProductState): string =>
    state.appExists
      ? 'Enregistrez vos journées et exportez un relevé daté' +
        n(':') +
        ' les deux modes de saisie, et ce que l’application ne fait pas.'
      : 'Ce que l’application fera, ce qu’elle ne fera jamais, et pourquoi ' +
        'elle n’existe pas encore.',

  /**
   * THE FIRST SENTENCE SAYS IT DOES NOT EXIST, before anything describes it -
   * /releve-annuel's discipline, on the page most likely to be read as an
   * advertisement.
   */
  lead: (state: ProductState): string =>
    state.appExists
      ? 'Une journée se note en un geste, ou l’application la détecte et vous ' +
        'la propose le soir. Chaque saisie porte un horodatage attribué par ' +
        'le serveur.'
      : 'Cette application n’existe pas encore. Cette page décrit ce qu’elle ' +
        'fera, ce qu’elle ne fera jamais, et ce que vous pourrez faire sans ' +
        'elle en attendant.',

  // -- the two modes -------------------------------------------------------
  modesHeading: 'Deux façons d’enregistrer, un seul relevé',

  modesIntro: (state: ProductState): string =>
    state.appExists
      ? 'Vous choisissez à l’installation et vous pouvez changer à tout ' +
        'moment. Les deux modes produisent exactement le même document.'
      : 'Le choix se fera à l’installation et pourra changer à tout moment. ' +
        'Les deux modes produiront exactement le même document.',

  /**
   * FD12's two cards, as data.
   *
   * THE LINES ARE PARALLEL IN NUMBER AND IN FORM - three each, each an
   * affirmative statement of what the mode does or requires. "Nécessite
   * l'accès à la position, y compris en arrière-plan" is written as plainly
   * as "Aucune autorisation à accorder", because the reader deciding between
   * them is entitled to the same register on both sides.
   */
  modes: [
    {
      id: 'manuelle',
      title: 'Saisie manuelle',
      body: (state) =>
        state.appExists
          ? 'Trois boutons sur l’écran d’accueil' +
            n(':') +
            ' en Suisse, à domicile, en mission. Un geste par jour, et la ' +
            'journée est enregistrée.'
          : 'Trois boutons sur l’écran d’accueil' +
            n(':') +
            ' en Suisse, à domicile, en mission. Un geste par jour, et la ' +
            'journée sera enregistrée.',
      lines: (state) =>
        state.appExists
          ? [
              'Aucune donnée de localisation n’est utilisée',
              'Aucune autorisation à accorder',
              'Fonctionne hors connexion',
            ]
          : [
              'Aucune donnée de localisation ne sera utilisée',
              'Aucune autorisation à accorder',
              'Fonctionnera hors connexion',
            ],
    },
    {
      id: 'automatique',
      title: 'Détection automatique',
      body: (state) =>
        state.appExists
          ? 'L’application compare votre position à la frontière pendant ' +
            'vos heures de travail et vous propose la journée le soir. Vous ' +
            'confirmez ou vous corrigez.'
          : 'L’application comparera votre position à la frontière pendant ' +
            'vos heures de travail et vous proposera la journée le soir. ' +
            'Vous confirmerez ou vous corrigerez.',
      lines: (state) =>
        state.appExists
          ? [
              'Rien n’est enregistré sans votre confirmation',
              'Les jours de mission restent saisis à la main',
              'Nécessite l’accès à la position, y compris en arrière-plan',
            ]
          : [
              'Rien ne sera enregistré sans votre confirmation',
              'Les jours de mission resteront saisis à la main',
              'Nécessitera l’accès à la position, y compris en arrière-plan',
            ],
    },
  ] satisfies readonly LoggingMode[] as readonly LoggingMode[],

  modesFooter:
    'Le relevé indiquera, pour chaque journée, si elle a été saisie à la ' +
    'main, détectée puis confirmée, ou corrigée par vous.',

  // -- what it will never do ----------------------------------------------
  refusalsHeading: 'Ce que l’application ne fera pas',

  /**
   * SPEC 13, in a reader's words, and nothing beyond it.
   *
   * IT COMES BEFORE ANY ARGUMENT TO INSTALL, which is FD12's instruction and
   * the right order regardless: a page asking for background location that
   * puts its limits after the pitch has arranged them to be read last.
   */
  refusals: [
    {
      heading: 'Elle n’enregistrera aucune coordonnée',
      body:
        'La position sera comparée à la frontière sur votre téléphone, puis ' +
        'immédiatement oubliée. Une seule conclusion par jour sera ' +
        'conservée' +
        n(':') +
        ' Suisse ou domicile.',
    },
    {
      heading: 'Elle ne gardera aucun historique de déplacements',
      body:
        'Ni trajet, ni adresse, ni lieu de travail. Il n’existera aucune ' +
        'carte de vos mouvements, ni dans l’application, ni sur nos serveurs.',
    },
    {
      heading: 'Elle ne partagera rien',
      body:
        'Ni avec votre employeur, ni avec une administration, ni avec un ' +
        'tiers. Vous serez seul à exporter votre relevé.',
    },
    {
      heading: 'Elle n’écrira jamais une journée seule',
      body:
        'Une journée détectée restera une proposition tant que vous ne ' +
        'l’aurez pas confirmée. Sans confirmation, la journée restera non ' +
        'renseignée.',
    },
  ],

  privacyLink: 'Lire la politique de confidentialité',

  // -- where it stands -----------------------------------------------------
  stateHeading: 'Où en est cette application',

  /**
   * THE HONEST PARAGRAPH, derived so it cannot become the stale one.
   *
   * NO DATE, NO "BIENTOT", NO WAITING LIST. /releve-annuel makes the same
   * refusal in the same words, and it is the same reason: a date announced
   * here is a promise this repository cannot keep, and the AN series has not
   * started.
   */
  stateBody: (state: ProductState): string => {
    if (state.appExists) {
      return (
        'L’application est disponible. Le calculateur reste utilisable sans ' +
        'elle, et les guides expliquent les règles qu’elle applique.'
      );
    }

    return (
      'Elle n’est pas construite, et aucune date n’est annoncée ici tant ' +
      'qu’elle n’est pas tenue. Le calculateur fonctionne aujourd’hui et ' +
      'vous donne votre part annuelle sans rien installer' +
      n(';') +
      ' c’est ce qui existe, et c’est par là qu’il vaut mieux commencer.'
    );
  },

  calculatorLink: 'Calculer ma part de télétravail',
  dossierLink: 'Voir ce que contiendra le relevé',
} as const;
