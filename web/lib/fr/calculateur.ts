// web/lib/fr/calculateur.ts
//
// Every word of /calculateur-teletravail-frontalier. FW11 increment 1 owns the
// page shell and the explanatory prose; the form labels and helpers arrive
// with the island in increment 2.
//
// THE THRESHOLDS ARE ARGUMENTS, NEVER LITERALS, and this is ruling R73
// applied to prose rather than to a tile label. lib/fr/metrics.ts records the
// reason: "40 % and 49,9 % belong to the year's RuleSet (SPEC 7.7), so a
// string containing them would go stale on a rule change and nothing would
// fail." A paragraph explaining the fiscal ceiling is the single most
// plausible place to type "40 %" and the single worst place for it to be
// wrong, so each function takes the ceiling ALREADY FORMATTED - through
// formatPercent, from the RuleSet, by the caller.
//
// WHY THIS PROSE EXISTS AT ALL. AC3: with JavaScript disabled the page must
// show the full explanatory copy, the form, and no result - "never a blank
// shell". SPEC 9.3: "the calculation needs JavaScript; the page must be
// meaningful without it." These three paragraphs are what makes the page
// worth reaching when the island never hydrates, and they are server-
// rendered for that reason.
//
// FRENCH TYPOGRAPHY (R91): the no-break spaces below are built by the n()
// helper rather than typed, so they are visible in the source of a file whose
// whole subject is invisible characters.
//
// TODO-COPY: realistic French, not reviewed by counsel.

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it. */
const n = (mark: string): string => `${NB}${mark}`;

export const CALCULATEUR_COPY = {
  title: 'Calculateur de télétravail frontalier',

  /**
   * The intro, and the thresholds reach it formatted. FD1:43 words it with
   * the two figures inline, which is why this is a function.
   */
  intro: (fiscal: string, social: string): string =>
    `Estimez votre pourcentage de télétravail annuel et le nombre de jours ` +
    `qu'il vous reste avant les seuils de ${fiscal} et ${social}.`,

  /**
   * RULING R55: the year the calculation applies to, shown above the form.
   * Resolved server-side from the Europe/Paris date - see
   * lib/content/tax-year.ts - because a year taken from the host clock is
   * wrong for half an hour every 31 December.
   */
  yearCaption: (year: number): string => `Année ${year}`,

  explanationHeading: 'Les deux seuils, et pourquoi ils ne sont pas le même',

  /**
   * Paragraph one: the fiscal ceiling. What it is and what crossing it costs.
   */
  fiscal: (fiscal: string): string =>
    `Le premier seuil est fiscal. Tant que votre télétravail reste sous ` +
    `${fiscal} de votre temps de travail annuel, votre salaire continue ` +
    `d'être imposé en Suisse. Au-delà, les jours excédentaires deviennent ` +
    `imposables en France${n(";")} dans les cantons relevant de l'accord de 1983, ` +
    `c'est le statut de frontalier lui-même qui est en jeu.`,

  /**
   * Paragraph two: the social ceiling. A different rule, a different
   * consequence - and the 25 % floor Checkpoint A settled.
   */
  social: (social: string): string =>
    `Le second est social, et il ne se confond pas avec le premier${n(":")} il ` +
    `décide de votre affiliation à la sécurité sociale, non de votre ` +
    `imposition. Il se situe à ${social}, et au-delà votre affiliation peut ` +
    `basculer en France. À partir d'un quart de télétravail, l'accord-cadre ` +
    `européen s'applique et suppose un certificat A1 en cours de validité.`,

  /**
   * Paragraph three: missions, which are the trap. They sit INSIDE the
   * ceiling rather than beside it, and a user who assumes otherwise gets a
   * silently wrong answer - which is why SPEC 9.3 makes the mission question
   * always visible rather than hiding it in the accordion.
   */
  missions: (fiscal: string): string =>
    `Les jours de mission hors de Suisse comptent à l'intérieur de ces ` +
    `${fiscal}, et non en plus. Un quota annuel s'y ajoute, réduit ` +
    `proportionnellement si vous travaillez à temps partiel ou si votre ` +
    `année est incomplète. C'est la raison pour laquelle la question des ` +
    `missions est posée avant les options avancées.`,

  /**
   * The meta description. SPEC 14: the title and description name the 40 %
   * threshold and the year - so both arrive as arguments, for the same
   * reason the prose does.
   */
  description: (fiscal: string, year: number): string =>
    `Combien de jours de télétravail vous reste-t-il avant le seuil de ` +
    `${fiscal}${n("?")} Calcul gratuit et immédiat pour l'année ${year}, sans ` +
    `inscription.`,

  /**
   * THE FORM (increment 2). SPEC 9.3 names the three visible fields and gives
   * their reason for being visible; it does NOT give their helper text, and
   * that gap is recorded as an interpretation in the report rather than
   * papered over. The "Why visible" column is rationale addressed to whoever
   * builds the form - "Determines the regime", "Scales ceiling and mission
   * cap", "The number they came to enter" - and the last of those is plainly
   * not something to say to a user.
   *
   * So each helper below states the CONSEQUENCE of the field in the terms
   * SPEC 7 already uses, and names no figure: a threshold written here would
   * be a second source of truth that goes stale in silence (R73). The one
   * verbatim string SPEC does supply - the method helper - arrives with the
   * accordion in increment 3.
   *
   * LABELS ARE SPEC 9.3's OWN, character for character, because they are the
   * one part it does specify.
   */
  form: {
    legend: 'Votre situation',

    canton: {
      label: 'Canton de travail',
      placeholder: 'Sélectionnez votre canton',
      helper:
        'Le canton détermine le régime applicable et ce que coûte un ' +
        'dépassement.',
    },

    rate: {
      label: "Taux d'activité (%)",
      helper:
        'Un temps partiel réduit dans la même proportion le plafond annuel ' +
        'et le quota de jours de mission.',
      decrease: "Diminuer le taux d'activité",
      increase: "Augmenter le taux d'activité",
    },

    days: {
      label: 'Jours de télétravail déjà pris',
      /**
       * The one real UX gift the regulation makes, and SPEC 9.3 says so in
       * its own words: "paid leave and sick days are not asked at all - the
       * 240 already absorbs them. That is a real UX win the regulation hands
       * us and why three fields suffice." Worth telling the user, because a
       * frontalier who has been counting working days will otherwise wonder
       * where to put them.
       */
      helper:
        'Comptez uniquement vos journées de télétravail' +
        n(":") +
        ' les congés payés et les jours de maladie ne sont pas à déclarer ' +
        'ici, la base annuelle les absorbe déjà.',
      decrease: 'Retirer une demi-journée',
      increase: 'Ajouter une demi-journée',
    },

    /**
     * Where a validation error goes when it belongs to no visible field.
     *
     * Every code the engine can return has a home - see fieldFor in
     * CalculatorForm.tsx - but "has a home" is a claim that has to survive
     * the accordion arriving in increment 3 and the engine gaining a code
     * later. An error with nowhere to render is an error the user never sees,
     * which is worse than an ugly one, so anything unmapped surfaces here
     * instead of being swallowed.
     */
    /**
     * THE DISCLOSURE PATH, ruling R113. P2 has no input trigger, so a link
     * that is ALWAYS present is the only way a reader reaches it - which is
     * why this belongs in the legal note rather than in the provisional
     * notice, which by design appears only sometimes.
     */
    sourcesLink: {
      text: 'Sources et vérifications',
      href: '/sources',
    },

    otherErrorsLabel: 'À corriger avant le calcul',

    /**
     * THE MISSION QUESTION (increment 3), and it is visible rather than
     * hidden for a reason SPEC 9.3 states outright: "Mission days materially
     * change the result, and a user with missions who never opens the
     * accordion gets a silently wrong answer." One line, two radios. "Non"
     * costs a user without missions a single line of reading.
     *
     * The question is SPEC's own sentence. The helper is the prompt's, with
     * the ceiling turned into an argument - a helper reading "40 %" would be
     * a fourth place that number lives and the one nobody would think to
     * update (R73).
     */
    missions: {
      question: `Avez-vous effectué des missions hors de Suisse cette année${n("?")}`,
      helper: (fiscal: string): string =>
        `Les jours de mission sont comptés à l'intérieur des ${fiscal}, et non ` +
        `en plus.`,
      no: 'Non',
      yes: 'Oui',

      /**
       * RULING R13, in one line, in the mission fields' own helper (AC2).
       *
       * THE GUIDE IS NAMED, NOT LINKED. SPEC 9.5 puts the full rules at
       * /guides/jours-de-mission-hors-suisse, which is FW17 - so a link here
       * would promise a 404 from a helper, and R85's principle is that a
       * target renders only when it is live. Naming it tells the reader the
       * rules exist and are written down somewhere, which is true.
       */
      fieldHelper:
        "Un jour de trajet sans travail effectué, ou travaillé " +
        "majoritairement en Suisse, n'est pas compté. Les règles complètes " +
        'figurent dans le guide des missions.',

      france: { label: 'Jours de mission en France' },
      thirdState: { label: 'Jours de mission dans un pays tiers' },
    },

    advanced: {
      summary: 'Options avancées',
    },

    method: {
      label: 'Méthode de calcul',

      /**
       * SPEC 9.3 GIVES THIS VERBATIM and calls it "also advice nobody else
       * gives", so the wording is not touched. The one change is that the
       * basis arrives as an argument instead of as the digits SPEC prints:
       * the number is RuleSet.simplifiedBasisDays, and copy holding its own
       * copy of it is the staleness R73 forbids. Every other character is
       * SPEC's.
       */
      helper: (basisDays: string): string =>
        `Par défaut, nous utilisons la base simplifiée de ${basisDays} jours ` +
        `par an (circulaire n° 45). Votre employeur peut utiliser un décompte ` +
        `exact — demandez-lui laquelle s'applique, la méthode doit être la ` +
        `même pour tout le personnel.`,

      simplified: 'Base simplifiée',
      exact: 'Décompte exact',
      totalLabel: 'Nombre total de jours travaillés',
      totalHelper:
        'Le chiffre que votre employeur applique à tout le personnel.',
    },

    decompte: {
      label: 'Décompte',
      day: 'Journées entières',
      halfDay: 'Demi-journées',
      hours: 'Heures',
      helper:
        'La plus petite unité que votre employeur enregistre. Les heures ' +
        'sont converties en journées avant le calcul.',
    },

    start: {
      label: "Début d'activité en cours d'année",
      helper:
        "Laissez vide si vous avez travaillé toute l'année. Une année " +
        'incomplète réduit le plafond annuel et le quota de missions dans la ' +
        'même proportion.',
    },
  },

  /**
   * THE PROVISIONAL RESULT (increment 4). FW12 replaces this region with the
   * full panel - badge, rail, four tiles, warnings, links - so the wording
   * here says only what one rate can honestly say.
   */
  result: {
    heading: 'Votre part de télétravail',

    /**
     * Before a canton is chosen. Not an error and not styled as one: the
     * user has not done anything wrong, the form simply cannot resolve a
     * regime yet.
     */
    empty: 'Choisissez votre canton de travail pour lancer le calcul.',

    /**
     * WHILE THE INPUT IS INVALID, and this note is the whole reason the
     * region does not just keep the last number on screen. A rate standing
     * next to a field the user has just broken reads as the answer to the
     * numbers now in the form. It is the answer to the previous ones.
     */
    stale: 'Corrigez les champs ci-dessus pour obtenir un résultat.',

    /**
     * FD1 puts a primary button on the form and the result is already live,
     * so this one moves focus to the result rather than computing. Users who
     * expect a button find one; users who do not never need it.
     */
    calculate: 'Calculer',

  },
} as const;
