// web/lib/fr/tarifs.ts
//
// SPEC D3: "/tarifs is one honest page - Gratuit en 2027. Payant des 2028
// (CHF 39-49/an prevu)." SPEC 9.1 repeats it: "one page, one product, no tier
// grid".
//
// THE PRICE RANGE IS SPEC'S, AND IT STAYS. The FW20 prompt said "no 'from'
// price", which was my own gloss written before reading D3; SPEC is normative
// and states the range as part of the sentence. It is marked `prevu` -
// planned - which is what makes it honest: a stated intention about 2028, not
// a price anybody is being charged. R138's tense discipline, applied to a
// commercial claim.
//
// NO TIER GRID, NO CHECKOUT, NO FEATURE COMPARISON. D3 names the A/B price
// test it replaced and says why: that was a phased-rollout experiment and
// "does not belong in the build". A page with two columns and a highlighted
// recommendation is that experiment arriving through the back door.
//
// WHAT A READER ACTUALLY WANTS TO KNOW is whether the thing they are about to
// rely on will be taken away or start charging mid-year, so the page answers
// that rather than selling. Nothing here is a threshold, so R147 has nothing
// to find.

const NB = String.fromCharCode(0x00a0);
const n = (mark: string): string => `${NB}${mark}`;

export const TARIFS_COPY = {
  title: 'Tarifs',

  description:
    'Gratuit en 2027, payant dès 2028. Une page, un produit, aucune grille ' +
    'de tarifs.',

  /**
   * SPEC D3, verbatim. The one sentence this page exists to carry, and the
   * e2e test asserts it is present rather than only that a grid is absent -
   * an absence assertion is satisfied by a page that renders nothing (R169's
   * corollary, one surface over).
   */
  position: 'Gratuit en 2027. Payant dès 2028 (CHF 39-49/an prévu).',

  /**
   * IT LISTS WHAT EXISTS. The first draft said "le calculateur, les guides ET
   * LE RELEVÉ sont gratuits", which prices a document /releve-annuel says is
   * not built - and a free price on an absent thing still asserts the thing.
   * Found by the read-through, between pages rather than on one.
   */
  positionDetail:
    'Le calculateur et les guides sont gratuits pour toute l’année 2027. ' +
    'Aucun paiement n’est demandé, aucun moyen de paiement n’est collecté, ' +
    'et rien ne change en cours d’année.',

  whyHeading: 'Pourquoi c’est gratuit cette année',

  whyBody:
    'Parce que ce site est jeune et que ses règles n’ont pas encore été ' +
    'relues par un professionnel. Faire payer un outil dont la page ' +
    '« à propos » explique que personne n’a validé ses règles serait ' +
    'difficile à défendre. L’année 2027 sert à corriger cela.',

  laterHeading: 'Ce qui se passera en 2028',

  laterBody:
    'Le produit deviendra payant, dans l’ordre de grandeur indiqué ' +
    'ci-dessus. Le montant exact n’est pas arrêté' +
    n(';') +
    ' il le sera avant que quoi que ce soit ne soit facturé, et il sera ' +
    'écrit ici.',

  noGridHeading: 'Il n’y a pas de formules',

  noGridBody:
    'Un seul produit, une seule offre. Pas de version limitée, pas d’option ' +
    'à cocher, pas de tableau comparatif dont la colonne du milieu est mise ' +
    'en avant. Ce qui existe sur ce site est disponible pour tout le monde, ' +
    'et ce qui n’existe pas encore est décrit comme tel.',

  sourcesLink: 'Voir ce qui est vérifié, et ce qui ne l’est pas',
} as const;
