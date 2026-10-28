// web/lib/fr/lamal.ts
//
// Every word of /calculateur-lamal-cmu. FW-COMPARATEUR, R658 (the prompt's
// R642). Accented and authoritative (R155); the report transliterates it and
// points here.
//
// WHAT THIS PAGE NEVER SAYS (R673): which option to choose; « recommandé »;
// an insurer's name; a single LAMal figure; a converted figure without its
// rate and date. There is NO badge (R674): one factual sentence says where
// the French figure falls against the Swiss range - below, above, between.
//
// NO FIGURE IS TYPED HERE (R147, R153, R171). The rate, the allowance, the
// PASS, the franchise, the insurer count, the years and the exchange rate all
// arrive as arguments from lib/lamal, which reads them from the generated
// premium modules and from years.ts, each with its row in
// docs/regulatory-sources.md (L1-L14). Words that name a rule - « trois
// mois », « huit heures » - are the rule's own words, from rows D1 and L6.
//
// TODO-COPY: realistic French, not reviewed by counsel; the two reviewer
// questions (PARK-28, PARK-30) are worded as the site's reading, never as a
// rule.

const NB = String.fromCharCode(0x00a0);
const NNB = String.fromCharCode(0x202f);

/** A punctuation mark with the no-break space French sets before it. */
const n = (mark: string): string => `${NB}${mark}`;

/**
 * R664 (G1): the premium dataset as its publisher names it - author and
 * title - for the attribution under the Swiss figures and on /sources. The
 * link is PREMIUM_DATASET_URL in lib/lamal/years.ts.
 */
export const PREMIUM_DATASET = {
  author: 'Office fédéral de la santé publique OFSP',
  title: 'Primes de l’assurance-maladie',
} as const;

export const LAMAL_COPY = {
  /**
   * R660 (the prompt's R644): the query family the Search Console export
   * shows - « droit d'option frontalier suisse », « droit d'option assurance
   * maladie frontalier », « choix de l'assurance maladie ». In the title and
   * description, not stuffed into the visible copy.
   */
  /**
   * R675 (the operator's Q6, 28.10.2026): about 60 characters, the
   * operator's own example, taken from relay/FW-COMPARATEUR-RULINGS-2026-10-28.txt
   * with the product's typography (U+2019, U+00A0 before : and ?).
   */
  metaTitle: 'Droit d’option frontalier' + n(':') + ' LAMal ou CMU, quel coût' + n('?'),

  metaDescription: (years: string): string =>
    'Avant d’exercer le droit d’option, comparez sur une année le coût de ' +
    'l’assurance maladie suisse et celui de la cotisation maladie française ' +
    `d’un frontalier, pour ${years}, à partir des primes publiées par l’OFSP ` +
    'et de la formule du Code de la sécurité sociale.',

  title: 'Comparateur LAMal / CMU',

  intro:
    'Le droit d’option vous fait choisir entre l’assurance maladie suisse et ' +
    'l’assurance maladie française. Cette page estime, sur une année ' +
    'complète, ce que coûterait chacune pour votre foyer' +
    n(':') +
    ' la prime suisse, d’après les primes publiées par l’Office fédéral de la ' +
    'santé publique pour les résidents de France, et la cotisation française, ' +
    'd’après la formule du Code de la sécurité sociale.',

  /** Shown when the island has not run: the page still explains itself. */
  noScript:
    'Le calcul se fait dans votre navigateur et demande JavaScript. Rien de ' +
    'ce que vous saisissez n’est envoyé ni enregistré.',

  // ---- the irrevocability banner (rows D1-D6, CLEISS) --------------------

  /**
   * ABOVE THE RESULT, IN THE ERROR STYLE (SPEC 9.6), and rendered whether or
   * not there is a result. Worded from rows D1-D6 - the window, the four
   * events that open it, the irrevocability, what reopens it, the default.
   */
  banner: {
    heading: 'Ce choix ne se reprend pas',
    body:
      'Le droit d’option ne s’exerce qu’une fois et il est irrévocable' +
      n(':') +
      ' seuls une reprise d’activité en Suisse, un transfert de résidence en ' +
      'France ou un passage à la retraite du seul régime suisse permettent d’y ' +
      'revenir. Il s’exerce dans un délai de trois mois, qui court à compter ' +
      'd’une prise d’activité en Suisse, d’une reprise d’activité après une ' +
      'période de chômage, d’une prise de résidence en France ou d’un passage ' +
      'du statut de travailleur à celui de pensionné. Sans choix dans ce ' +
      'délai, l’affiliation se fait d’office en Suisse.',
    link: { text: 'Le guide du droit d’option', href: '/guides/droit-option-lamal-cmu' },
  },

  // ---- the form ---------------------------------------------------------

  form: {
    heading: 'Votre situation',

    year: {
      label: 'Année comparée',
      helper:
        'Les primes suisses et le plafond de la sécurité sociale française ' +
        'de la même année.',
    },

    income: {
      /** R670 (G7), verbatim. */
      label: 'Votre revenu fiscal de référence de l’avant-dernière année',
      helper: (year: number): string =>
        `Pour ${year}${NB}: les revenus de ${year - 2}, qui figurent sur ` +
        `votre avis d’impôt de ${year - 1}.`,
      suffix: '€',
    },

    persons: {
      legend: 'Les personnes à assurer',
      helper:
        'Vous d’abord, puis les membres de votre famille qui suivront votre ' +
        'choix' +
        n(':') +
        ' ceux qui résident en France sans activité professionnelle propre ni ' +
        'pension du seul régime suisse. Un conjoint qui travaille relève de sa ' +
        'propre affiliation.',
      you: 'Vous — année de naissance',
      other: (position: number): string => `Personne ${position} — année de naissance`,
      accident: 'Avec la couverture accidents',
      /** R667 (G4): why the frontalier's default is what it is, in one sentence. */
      accidentDefaultYou:
        'Décochée par défaut pour vous' +
        n(':') +
        ' employé au moins huit heures par semaine chez un même employeur, ' +
        'vous êtes assuré contre les accidents par la loi sur ' +
        'l’assurance-accidents, et la couverture accidents de l’assurance ' +
        'maladie peut alors être suspendue.',
      add: 'Ajouter une personne',
      remove: (position: number): string => `Retirer la personne ${position}`,
    },

    submit: 'Comparer',
  },

  /** Field errors, keyed by what went wrong. */
  errors: {
    income: `Indiquez un montant en euros, sans centimes, par exemple 42${NNB}000.`,
    birthYear: (year: number): string =>
      `Indiquez une année de naissance à quatre chiffres, au plus tard ${year}.`,
  },

  /** A year the site holds no premiums for: refused, never answered with another year (R657). */
  refusal: {
    heading: (year: number): string => `Pas de comparaison pour ${year}`,
    body: (year: number): string =>
      `Les primes ${year} des assureurs suisses pour les résidents de France ne ` +
      'figurent pas sur ce site. Il ne compare pas une année avec les chiffres ' +
      'd’une autre.',
  },

  // ---- the result -------------------------------------------------------

  result: {
    heading: (year: number): string => `Estimation pour ${year}`,
    perYear: 'par an',

    /**
     * R674 (the operator, 28.10.2026): NO BADGE. « Moins cher selon ces
     * hypothèses » stopped working once the Swiss side became a range - between
     * the lowest and the highest total there is no cheaper side. ONE factual
     * sentence instead, chosen by the case, each a fact about the numbers with
     * no label pointing toward a choice. Verbatim from
     * relay/FW-COMPARATEUR-RULINGS-2026-10-28.txt; `depends` below is the third.
     */
    below: 'La cotisation française est inférieure au total suisse le plus bas.',
    above: 'La cotisation française est supérieure au total suisse le plus haut.',

    depends:
      'Selon l’assureur suisse, l’un ou l’autre est moins cher' +
      n(':') +
      ' la cotisation française se situe entre le total le plus bas et le ' +
      'total le plus haut des assureurs suisses.',

    swiss: {
      heading: 'Assurance maladie suisse (LAMal)',
      lowest: 'Total le plus bas',
      median: 'Total médian',
      highest: 'Total le plus haut',
      basis: (insurers: number, adultFranchise: string, childFranchise: string): string =>
        `Primes mensuelles × 12, pour tout votre foyer, chez chacun des ` +
        `${insurers} assureurs qui assurent des résidents de France. Franchise ` +
        `de ${adultFranchise} par an pour un adulte ou un jeune adulte, ` +
        `${childFranchise} pour un enfant.`,
      conversion: (rate: string, date: string): string =>
        `En euros au taux de référence de la BCE du ${date}${NB}: 1${NB}€ = ${rate}.`,
      /**
       * R664 (G1): the attribution the terms make mandatory - author, title,
       * link. The title is the link; the author and the title are read from
       * PREMIUM_DATASET below, which /sources renders too.
       */
      attributionBefore: 'Source' + n(':') + ' ' + PREMIUM_DATASET.author + ', «' + NB,
      attributionAfter: (year: number): string =>
        `${NB}», primes ${year}, opendata.swiss. Taux de change${NB}: Banque centrale européenne.`,
      priminfo: {
        lead: 'Aucun assureur n’est nommé ici. Pour les comparer et en choisir un' + n(':') + ' ',
        text: 'priminfo.admin.ch',
      },
    },

    french: {
      heading: 'Assurance maladie française (cotisation Urssaf)',
      amount: 'Cotisation',
      formula: (rate: string, allowance: string, pass: string, year: number): string =>
        `${rate} × (revenu − ${allowance} du plafond de la sécurité sociale ` +
        `${year}, ${pass}), arrondi à l’euro.`,
      /** R671 (G8), the label the ruling fixes. */
      passAnnounced: (year: number): string =>
        `Plafond ${year} annoncé par l’Urssaf, arrêté à paraître.`,
      household: 'Une seule cotisation, quel que soit le nombre de personnes rattachées.',
      /** PARK-28: the site's reading where the texts are silent. */
      floored: (allowance: string): string =>
        `Votre revenu est inférieur à ${allowance} du plafond${NB}: la formule ` +
        'donne un montant négatif, affiché ici comme 0' +
        NB +
        '€. Aucun texte ne fixe de minimum' +
        n(';') +
        ' c’est la lecture de ce site, soumise à une relecture experte.',
      source:
        'Source' +
        n(':') +
        ' Code de la sécurité sociale, articles L380-3-1 et D380-2' +
        n(';') +
        ' Urssaf.',
    },

    /** "Estimation indicative, ne constitue pas un conseil", as the calculator says it - authored for this surface (R165, R183). */
    legal:
      'Estimation fournie à titre indicatif, sur la base des informations ' +
      'que vous avez saisies. Elle ne constitue pas un conseil et n’engage ni ' +
      'l’administration française, ni l’administration suisse, ni aucun ' +
      'assureur.',
  },

  // ---- what the comparison leaves out (R654, the prompt's R638) ----------

  limitsHeading: 'Ce que ce comparatif ne compare pas',

  /**
   * VISIBLE, NOT BEHIND A CLICK. Each item rests on a row: D1-D10 (CLEISS),
   * L5-L11. Nothing here is a rule the site cannot source; where a cost is
   * simply not counted, the item says so and names no amount.
   */
  limits: (franchise: string, rateDate: string): readonly string[] => [
    'Les soins remboursés. Les deux systèmes ne couvrent pas les mêmes soins ' +
      'de la même façon' +
      n(';') +
      ' ce comparatif ne met en regard que ce que chacun coûte. Et l’option ne ' +
      'porte que sur la couverture maladie' +
      n(':') +
      ' les accidents du travail, l’invalidité et la perte de gain liée à la ' +
      'maladie ou à la maternité relèvent dans tous les cas du droit suisse.',
    `Ce qui reste à votre charge quand vous vous soignez. La prime suisse est ` +
      `celle de la franchise ordinaire, ${franchise}` +
      n(';') +
      ' la franchise elle-même, et ce qui reste à payer dans l’un ou l’autre ' +
      'système, ne sont comptés d’aucun côté.',
    'Une assurance complémentaire, d’un côté comme de l’autre.',
    'Les membres de la famille qui ne suivent pas votre choix. Seuls ceux ' +
      'qui résident en France sans activité professionnelle propre ni pension ' +
      'du seul régime suisse le suivent' +
      n(';') +
      ' un conjoint qui travaille, en France comme en Suisse, relève de sa ' +
      'propre affiliation et n’est pas compté ici.',
    'L’effet du choix sur chacun. Il vaut pour tout le foyer qui le suit, et ' +
      'ce qu’il change pour chacun, au-delà du coût, n’est pas mesuré.',
    'Une déclaration d’impôt commune. L’Urssaf demande alors les revenus qui ' +
      'vous concernent personnellement, et la moitié des revenus perçus en ' +
      'commun' +
      n(':') +
      ' le revenu fiscal de référence de tout le foyer surestime votre ' +
      'cotisation.',
    'Une année incomplète. Le comparatif porte sur une année entière' +
      n(';') +
      ' une affiliation en cours d’année est calculée au prorata des jours.',
    'Le choix d’un assureur. Chaque total suisse additionne les primes d’un ' +
      'même assureur pour tout le foyer' +
      n(';') +
      ' le plus bas, le médian et le plus haut encadrent les offres sans en ' +
      'désigner aucune.',
    `Le cours du franc. La conversion en euros utilise un seul taux, celui de ` +
      `la BCE du ${rateDate}, et les primes sont fixées en francs.`,
    'Le moment du choix. Il se fait une fois, dans le délai de trois mois, ' +
      'et ne se reprend pas' +
      n(':') +
      ' l’encadré ci-dessus le rappelle.',
  ],

  sourcesLink: { text: 'Sources et vérifications', href: '/sources' },

  /** The guide link, after the result (R659: the comparator links back to the guide). */
  guideLink: {
    lead: 'Le délai, les situations qui l’ouvrent, ce qui le rouvre' + n(':') + ' ',
    text: 'le guide du droit d’option',
    href: '/guides/droit-option-lamal-cmu',
  },

  /** "2026 et 2027" for the description, from the data's years (R171). */
  yearsList: (years: readonly number[]): string =>
    years.length <= 1
      ? years.map(String).join('')
      : years.slice(0, -1).join(', ') + ' et ' + String(years[years.length - 1]),
} as const;

