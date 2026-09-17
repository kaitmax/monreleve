// web/lib/fr/a-propos.ts
//
// The page that says who is behind this and what that is worth.
//
// WHAT IT IS NOT. No founder story, no mission statement, no team. SPEC 9.1
// gives this page one job and todo.md gives it one subject - "who reviewed the
// rules" - and the honest answer today is nobody. A page about a product whose
// whole argument is that it claims no more than its record supports cannot
// open with a paragraph about a journey.
//
// R160's DISCIPLINE, APPLIED TO A PAGE RATHER THAN A CHIP. Every guide's chip
// now reads "Relecture experte : en attente" because naming the team implied a
// review that has not happened. The same sentence, at length, is this page:
// the rules on this site have been transcribed against their primary sources
// and read by nobody with professional standing to validate them. todo.md's
// TODO-REVIEWER placeholder is not a sentence a reader can read; this is.
//
// THE MIDDLE SECTION IS THE PRODUCT'S ACTUAL DIFFERENTIATOR, stated plainly:
// how a figure gets onto this site. A primary source, a fetch date, a row -
// and if none can be found, it is not written. Most competitors have neither a
// dated source list nor a named reviewer. This site has the first and an
// honest account of lacking the second, and saying so is worth more than any
// claim it could make instead.
//
// NO FIGURE ANYWHERE (R147). Nothing here is a threshold, and a page about how
// figures are handled is the last place to type one.

import type { ProductState } from '@/lib/content/product-state';

const NB = String.fromCharCode(0x00a0);
const n = (mark: string): string => `${NB}${mark}`;

export const A_PROPOS_COPY = {
  title: 'À propos',

  description:
    'Qui tient ce site, comment une information réglementaire y arrive, et ' +
    'ce qui a été vérifié ou non.',

  /**
   * IT DESCRIBES WHAT THE SITE DOES TODAY, and the first draft did not. It
   * said the site "calcule une part de télétravail ET TIENT UN REGISTRE DE
   * JOURNÉES" - a register that /releve-annuel, written in the same task,
   * says is not built. Two pages asserting what a third denies.
   *
   * Found by the read-through, which is the only thing that could: each
   * sentence is plausible alone, every test passed, and the contradiction
   * only exists between pages.
   *
   * FW20 FIXED THE SENTENCE AND LEFT THE MECHANISM, which is R149's signal.
   * A hand-corrected sentence is correct until the next hand edits it, so
   * R172 makes the clause a function of the fact: the register appears here
   * when, and only when, `trackerExists` says it exists. The refusal half -
   * "il ne donne pas de conseil" - is unconditional and stays outside the
   * branch, because it is true of every state this product can be in.
   */
  lead: (state: ProductState): string => {
    const does = [
      state.calculatorExists ? 'calcule votre part de télétravail annuelle' : null,
      state.trackerExists ? 'tient le registre horodaté de vos journées' : null,
    ].filter((clause): clause is string => clause !== null);

    // THE EMPTY CASE IS WRITTEN OUT rather than left to produce "Ce site .".
    // It is unreachable - `calculatorExists` is asserted against the route
    // that renders the form - and writing it anyway is what stops the flip
    // test passing on ungrammatical output. A test that only asks whether the
    // string CHANGED is satisfied by a string that changed into nonsense.
    const opening = does.length > 0 ? `Ce site ${does.join(' et ')}.` : 'Ce site ne fait rien.';

    return (
      `${opening} Il ne donne pas de conseil, et il ne remplace ni votre ` +
      'employeur, ni votre administration fiscale, ni un avocat.'
    );
  },

  // -- who has read the rules ---------------------------------------------
  reviewHeading: 'Personne n’a validé ces règles',

  reviewBody:
    'Les règles appliquées par ce site ont été transcrites depuis leurs ' +
    'sources primaires, avec la date de chaque relevé. Elles n’ont pas été ' +
    'relues par un professionnel du droit fiscal ou de la sécurité sociale. ' +
    'C’est la raison pour laquelle chaque guide porte la mention ' +
    '« Relecture experte' +
    n(':') +
    ' en attente » plutôt que le nom de quelqu’un.',

  reviewConsequence:
    'Concrètement' +
    n(':') +
    ' une transcription fidèle peut reposer sur une lecture discutable, et ' +
    'trois lectures sont déjà signalées comme telles. Elles sont listées ' +
    'avec le reste sur la page des sources.',

  // -- how a figure gets here ---------------------------------------------
  methodHeading: 'Comment un chiffre arrive sur ce site',

  methodIntro:
    'Une information réglementaire ne s’écrit ici qu’au terme des mêmes ' +
    'trois étapes, sans exception.',

  method: [
    {
      heading: 'Une source primaire',
      body:
        'Le texte de l’administration qui publie la règle, jamais un article ' +
        'qui la rapporte. Un site spécialisé peut indiquer où chercher' +
        n(';') +
        ' il ne peut pas servir de source.',
    },
    {
      heading: 'Une date de relevé',
      body:
        'Le jour où cette source a été lue, consigné avec la règle. Une ' +
        'règle sans date est une règle dont personne ne sait si elle est ' +
        'encore vraie.',
    },
    {
      heading: 'Une ligne sur la page des sources',
      body:
        'La règle, sa valeur, sa source et son état, visibles par tout le ' +
        'monde. Ce qui n’y figure pas n’est utilisé nulle part sur ce site.',
    },
  ],

  methodRefusal:
    'Et si aucune source primaire ne peut être trouvée, le chiffre n’est pas ' +
    'écrit. Pas approximé, pas repris ailleurs, pas assorti d’une réserve' +
    n(':') +
    ' absent. La page des sources nomme ce qui manque, pour que son absence ' +
    'se remarque.',

  // -- the closing pointer -------------------------------------------------
  sourcesLink: 'Voir les sources et leur état',
} as const;
