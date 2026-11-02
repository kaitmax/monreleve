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
// docs/regulatory-sources.md (L1-L17). Words that name a rule - « trois
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

/**
 * Rows D1-D6 (CLEISS, corroborated by ameli): the four events that open the
 * three-month option period, as the banner has always worded them. ONE HOME
 * (R206): the banner's sentence, the "Le délai de trois mois" list and the
 * helper's choices are all built from these - FW-CALCS-A2, R748.
 */
const OPTION_EVENTS = [
  { article: 'une', noun: 'prise d’activité en Suisse' },
  { article: 'une', noun: 'reprise d’activité après une période de chômage' },
  { article: 'une', noun: 'prise de résidence en France' },
  { article: 'un', noun: 'passage du statut de travailleur à celui de pensionné' },
] as const;

/** "d’une A, d’une B, d’une C ou d’un D" - the banner's enumeration. */
const eventsFrom = (): string => {
  const items = OPTION_EVENTS.map(({ article, noun }) => `d’${article} ${noun}`);

  return items.slice(0, -1).join(', ') + ' ou ' + (items[items.length - 1] ?? '');
};

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** "2027-03-01" -> "1er mars": the ordinal for the first, the month in words. */
const dayMonth = (iso: string): string => {
  const day = Number(iso.slice(8, 10));

  const dayText = day === 1 ? '1er' : String(day);
  const month = MONTHS[Number(iso.slice(5, 7)) - 1] ?? '';

  return `${dayText}${NB}${month}`;
};

/** "2027-02-28" -> "28 février 2027". */
const longDate = (iso: string): string => `${dayMonth(iso)} ${iso.slice(0, 4)}`;

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
    'complète ou à partir d’une date d’affiliation, ce que coûterait ' +
    'chacune pour votre foyer' +
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
      eventsFrom() +
      '. Sans choix dans ce délai, l’affiliation se fait d’office en Suisse.',
    link: { text: 'Le guide du droit d’option', href: '/guides/droit-option-lamal-cmu' },
  },

  // ---- the three-month period (R748; rows D1-D6, L17) --------------------

  /**
   * FW-CALCS-A2, R748: "Le délai de trois mois" and its helper, in the
   * design's words. S3 IS NOT FOUND - how the three months are counted - so
   * the end date carries « environ » and the warning, which stays whatever
   * S3 later says (R748: "Either way, the warning to confirm with the fund
   * stays"). The warning is the design file's accented sentence (R168: never
   * the relay prompt's transliteration).
   */
  deadline: {
    heading: 'Le délai de trois mois',
    intro:
      'Vous disposez de trois mois pour exercer l’option. Le délai court à ' +
      'compter de l’un de ces événements' +
      n(':'),
    /** The four events as list items, punctuated as the design sets them. */
    events: OPTION_EVENTS.map(({ article, noun }, index) => {
      const end = index === OPTION_EVENTS.length - 1 ? '.' : n(';');

      return `${article} ${noun}${end}`;
    }),
    /** The same four, as the helper's choices. */
    choices: OPTION_EVENTS.map(({ noun }) => capitalised(noun)),
    helperHeading: 'Votre délai',
    event: 'L’événement',
    date: 'Sa date',
    stepsLabel: 'Votre délai, étape par étape',
    startLead: (date: string): string => `Le ${date}${NB}:`,
    startLeadEmpty: 'À la date de l’événement' + n(':'),
    startRest: (choice: number): string => {
      const noun = OPTION_EVENTS[choice]?.noun ?? '';

      return `${noun}, le délai commence.`;
    },
    choose: 'Vous pouvez choisir l’assurance maladie française',
    until: (date: string): string => `jusqu’au ${date} environ.`,
    untilEmpty: 'dans les trois mois qui suivent.',
    office: 'Sans choix au terme du délai, affiliation d’office en Suisse.',
    warning:
      'Date indicative' +
      n(':') +
      ' la façon exacte de compter les trois mois n’est pas vérifiée ici. ' +
      'Confirmez-la auprès de votre caisse d’assurance maladie avant de vous y fier.',
    months: MONTHS,
    /** "2027-02-28" -> "28 février 2027"; "2027-03-01" -> "1er mars 2027". */
    longDate,
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

    /**
     * FW-CALCS-A2, R743: a joint tax return. URSSAF 6b (row L8): « indiquez
     * le montant des revenus vous concernant personnellement. Si vous avez
     * perçus des revenus en commun au sein du foyer fiscal, veuillez en
     * mentionner la moitié. » The words are the design's.
     */
    declaration: {
      legend: 'Votre déclaration d’impôt',
      individual: 'Individuelle',
      joint: 'Commune',
      personal: 'Vos revenus personnels de l’avant-dernière année',
      common: 'Les revenus perçus en commun dans le foyer',
      rule: 'L’Urssaf retient vos revenus personnels et la moitié des revenus perçus en commun.',
      here: (amount: string): string => `Ici${NB}: ${amount}.`,
    },

    /**
     * FW-CALCS-A2, R744: an affiliation that starts during the year. The
     * helper says what each side counts - the French prorata by days (row
     * L9), the Swiss whole months after the start month (R744's fallback,
     * row L16).
     */
    affiliation: {
      legend: (year: number): string => `Votre affiliation en ${year}`,
      wholeYear: 'Toute l’année',
      fromDate: 'À partir d’une date',
      start: 'Date de début d’affiliation',
      helper:
        'Cotisation française au prorata des jours' +
        n(';') +
        ' primes suisses pour les mois entiers qui suivent le mois de début.',
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
    /** R744: the start date must fall inside the compared year. */
    start: (year: number): string => `Indiquez une date de début d’affiliation en ${year}.`,
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

    /** R744: the heading for an affiliation from a date, to the year's end. */
    headingFrom: (year: number, startIso: string): string =>
      `Estimation pour ${year}, du ${dayMonth(startIso)} au ${dayMonth(`${year}-12-31`)}`,
    /** R744: "par an" becomes the period each side actually counts. */
    forMonths: (months: number): string => `pour ${months}${NB}mois`,
    forDays: (days: number): string => `pour ${days}${NB}jours`,

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
      /** `months` is MONTHS_PER_YEAR for the whole year (row L3), fewer from a date (R744). */
      basis: (months: number, insurers: number, adultFranchise: string, childFranchise: string): string =>
        `Primes mensuelles × ${months}, pour tout votre foyer, chez chacun des ` +
        `${insurers} assureurs qui assurent des résidents de France. Franchise ` +
        `de ${adultFranchise} par an pour un adulte ou un jeune adulte, ` +
        `${childFranchise} pour un enfant.`,
      conversion: (rate: string, date: string): string =>
        `En euros au taux de référence de la BCE du ${date}${NB}: 1${NB}€ = ${rate}.`,
      /**
       * R747: the slider moved - the figure is its hypothesis, and the ECB
       * rate stands beside it with its date (row L14: a modified rate is said
       * to be modified).
       */
      hypothesis: (rate: string, ecbRate: string, date: string): string =>
        `Hypothèse du curseur${NB}: 1${NB}€ = ${rate} (taux de référence de la BCE du ${date}${NB}: ${ecbRate}).`,
      /** R744's fallback, said where the months are counted (S2 not established, row L16). */
      startMonth:
        'Mois de début non compté' +
        n(':') +
        ' règle non vérifiée. Seuls les mois entiers qui suivent la date de ' +
        'début sont comptés ici.',
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
      /** R744: the prorata line, citing D380-2 (row L9; the ÷ 365 is URSSAF 6a's). */
      prorata: (days: number, yearDays: number): string =>
        `Au prorata${NB}: × ${days}${NB}jours ÷ ${yearDays}, comme le prévoit ` +
        'l’article D380-2 pour une affiliation en cours d’année.',
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

    /**
     * FW-CALCS-A2, R745: every insurer's total as a dot, the French
     * contribution as a labelled line. The number of insurers is an argument,
     * read from the dataset (R171) - never typed, never spelled out.
     */
    chart: {
      heading: (count: number): string => `Les ${count} assureurs suisses face à la cotisation française`,
      intro: 'Chaque point est le total de votre foyer chez un assureur, en euros. Aucun n’est nommé.',
      french: (amount: string): string => `France${NB}: ${amount}`,
      /**
       * The one counting sentence for a count (lib/lamal/scenario.ts's
       * countAgainst): all above, none above - every total below - or how
       * many. A tie is neither above nor below, so with ties and nothing
       * above it reads « inférieure à 0 des … », which is true.
       */
      sentence: (above: number, below: number, count: number): string =>
        above === count
          ? `La cotisation française est inférieure aux ${count} totaux suisses.`
          : below === count
            ? `La cotisation française est supérieure aux ${count} totaux suisses.`
            : `La cotisation française est inférieure à ${above} des ${count} totaux suisses.`,
      /** The chart's one label (role="img"): the same facts as the picture, in a sentence. */
      label: (count: number, lowest: string, highest: string, french: string, sentence: string): string =>
        `${count} totaux suisses, de ${lowest} à ${highest}` +
        n(';') +
        ` cotisation française${NB}: ${french}. ${sentence}`,
    },

    /**
     * FW-CALCS-A2, R746 (S1, row L15): the Swiss annual cap on what is paid on
     * top of the premiums. The design's words, except where they claimed more
     * than LAMal art. 64 supports: the cap covers the franchise and the
     * quote-part, and the hospital contribution (al. 5) is not capped.
     */
    care: {
      heading: 'Une année avec beaucoup de soins',
      intro:
        'En Suisse, la franchise et la quote-part que vous payez vous-même en ' +
        'plus de la prime sont plafonnées chaque année.',
      label: 'Au maximum, en plus des primes',
      inEuros: (amount: string): string => `soit ${amount} par an pour votre foyer`,
      rule: (franchise: string, share: string, adultCap: string, childCap: string): string =>
        `Par adulte ou jeune adulte${NB}: franchise de ${franchise} et quote-part de ${share} ` +
        `jusqu’à ${adultCap}. Par enfant${NB}: quote-part jusqu’à ${childCap}.`,
      /** LAMal art. 64 al. 4, second sentence - shown when it lowers the figure. */
      children: (cap: string): string =>
        `Plusieurs enfants assurés chez le même assureur paient ensemble au plus ${cap}.`,
      hospital:
        'En cas d’hospitalisation, une contribution aux frais de séjour peut ' +
        's’y ajouter' +
        n(';') +
        ' elle n’est pas comptée ici.',
      /** R746: why it is never added to either side, in the design's words. */
      apart:
        'Montré à part, jamais ajouté à la comparaison' +
        n(':') +
        ' sans mutuelle, le reste à charge français n’a pas de plafond annuel comparable.',
      source: 'Source' + n(':') + ' LAMal, article 64' + n(';') + ' OAMal, article 103.',
    },

    /**
     * FW-CALCS-A2, R747: the franc slider. A hypothesis about the ECB rate,
     * never a rate itself and never fetched (row L14).
     */
    franc: {
      heading: 'Et si le franc varie' + n('?'),
      intro: 'Les primes sont fixées en francs. Faites varier le franc pour voir si le résultat change.',
      label: (state: string): string => `Le franc face à l’euro${NB}: ${state}`,
      atReference: 'au taux BCE',
      stronger: (percent: number): string => `plus fort de ${percent}${NB}%`,
      weaker: (percent: number): string => `plus faible de ${percent}${NB}%`,
      weakest: (limit: number): string => `−${limit}${NB}%`,
      middle: 'taux BCE',
      strongest: (limit: number): string => `+${limit}${NB}%`,
      rateLead: `1${NB}€ = `,
      totals: (lowest: string, highest: string): string =>
        `Total suisse le plus bas${NB}: ${lowest}` + n(';') + ` le plus haut${NB}: ${highest}.`,
      reference: (rate: string, date: string): string =>
        `Taux de référence de la BCE du ${date}${NB}: 1${NB}€ = ${rate}. ` +
        'Le curseur est une hypothèse, pas un cours.',
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
    // FW-CALCS-A2, R746: reworded as the design words it.
    `Ce qui reste à votre charge quand vous vous soignez. La prime suisse est ` +
      `celle de la franchise ordinaire, ${franchise}. Le plafond suisse de ce ` +
      'qui reste à payer est montré à part, et n’est ajouté d’aucun côté de la ' +
      'comparaison.',
    'Une assurance complémentaire, d’un côté comme de l’autre.',
    'Les membres de la famille qui ne suivent pas votre choix. Seuls ceux ' +
      'qui résident en France sans activité professionnelle propre ni pension ' +
      'du seul régime suisse le suivent' +
      n(';') +
      ' un conjoint qui travaille, en France comme en Suisse, relève de sa ' +
      'propre affiliation et n’est pas compté ici.',
    'L’effet du choix sur chacun. Il vaut pour tout le foyer qui le suit, et ' +
      'ce qu’il change pour chacun, au-delà du coût, n’est pas mesuré.',
    // FW-CALCS-A2: « Une déclaration d’impôt commune » (R743) and « Une année
    // incomplète » (R744) left this list - the form now asks both.
    //
    // R745: reworded as the design words it, less two things it cannot say
    // here: the count of insurers (this list takes none - it is read from the
    // dataset, never typed, R171) and « n’en recommande aucun » (R673: the
    // page never says « recommandé », in any form).
    'Le choix d’un assureur. Chaque total suisse additionne les primes d’un ' +
      'même assureur pour tout le foyer' +
      n(';') +
      ' les totaux de tous les assureurs sont montrés sans en désigner aucun.',
    // R747: reworded as the design words it.
    `Le cours du franc. La conversion en euros utilise le taux de la BCE du ` +
      `${rateDate}, et les primes sont fixées en francs` +
      n(';') +
      ' le curseur montre l’effet d’une variation, il ne prévoit pas le cours.',
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

