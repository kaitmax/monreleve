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
    `qu’il vous reste avant les seuils de ${fiscal} et ${social}.`,

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
    `d’être imposé en Suisse. Au-delà, les jours excédentaires deviennent ` +
    `imposables en France${n(";")} dans les cantons relevant de l’accord de 1983, ` +
    `c’est le statut de frontalier lui-même qui est en jeu.`,

  /**
   * Paragraph two: the social ceiling. A different rule, a different
   * consequence - and the 25 % floor Checkpoint A settled.
   */
  social: (social: string): string =>
    `Le second est social, et il ne se confond pas avec le premier${n(":")} il ` +
    `décide de votre affiliation à la sécurité sociale, non de votre ` +
    `imposition. Il se situe à ${social}, et au-delà votre affiliation peut ` +
    `basculer en France. À partir d’un quart de télétravail, l’accord-cadre ` +
    `européen s’applique et suppose un certificat A1 en cours de validité.`,

  /**
   * Paragraph three: missions, which are the trap. They sit INSIDE the
   * ceiling rather than beside it, and a user who assumes otherwise gets a
   * silently wrong answer - which is why SPEC 9.3 makes the mission question
   * always visible rather than hiding it in the accordion.
   */
  missions: (fiscal: string): string =>
    `Les jours de mission hors de Suisse comptent à l’intérieur de ces ` +
    `${fiscal}, et non en plus. Un quota annuel s’y ajoute, réduit ` +
    `proportionnellement si vous travaillez à temps partiel ou si votre ` +
    `année est incomplète. C’est la raison pour laquelle la question des ` +
    `missions est posée avant les options avancées.`,

  /**
   * The meta description. SPEC 14: the title and description name the 40 %
   * threshold and the year - so both arrive as arguments, for the same
   * reason the prose does.
   */
  description: (fiscal: string, year: number): string =>
    `Combien de jours de télétravail vous reste-t-il avant le seuil de ` +
    `${fiscal}${n("?")} Calcul gratuit et immédiat pour l’année ${year}, sans ` +
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

      /**
       * ONLY AFTER THE FORM HAS BEEN SUBMITTED WITHOUT ONE (R380).
       *
       * `result.empty` below says the opposite thing deliberately, and both
       * are right at different moments. Its note - "not an error and not
       * styled as one: the user has not done anything wrong, the form simply
       * cannot resolve a regime yet" - describes somebody still filling the
       * form in, and turning that red would scold a reader who is halfway
       * through a sentence.
       *
       * PRESSING Calculer CHANGES WHAT IS TRUE. They have asked for an
       * answer and cannot be given one, and the reason is a field they can
       * see and fix. That is an error by any reading, so it is styled as one.
       *
       * SHORTER THAN result.empty, because it sits directly under the label.
       * "pour lancer le calcul" is the part the reader has just demonstrated
       * they know; what they need here is which field, and the field is
       * named immediately above it.
       */
      missing: 'Choisissez votre canton de travail.',
    },

    rate: {
      label: "Taux d’activité (%)",
      helper:
        'Un temps partiel réduit dans la même proportion le plafond annuel ' +
        'et le quota de jours de mission.',
      decrease: "Diminuer le taux d’activité",
      increase: "Augmenter le taux d’activité",
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
        `Les jours de mission sont comptés à l’intérieur des ${fiscal}, et non ` +
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
        "majoritairement en Suisse, n’est pas compté. Les règles complètes " +
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
        `exact — demandez-lui laquelle s’applique, la méthode doit être la ` +
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
      label: "Début d’activité en cours d’année",
      helper:
        "Laissez vide si vous avez travaillé toute l’année. Une année " +
        'incomplète réduit le plafond annuel et le quota de missions dans la ' +
        'même proportion.',
    },
  },

  /**
   * THE PROVISIONAL RESULT (increment 4). FW12 replaces this region with the
   * full panel - badge, rail, four tiles, warnings, links - so the wording
   * here says only what one rate can honestly say.
   */
  /**
   * FW-FORECAST / R343: the weekly rhythm, and the projection it feeds.
   *
   * R340 GOVERNS EVERY STRING HERE: a projection is never a record. The
   * figures are labelled as a projection, the assumptions are written out in
   * words rather than implied, and one line says outright that nothing here
   * reaches the releve. The Android screen carries the same three devices,
   * which is deliberate - a reader meeting the projection on the site and
   * then in the app must not have to work out whether they mean the same
   * thing.
   */
  projection: {
    question: `Quels jours télétravaillez-vous d’habitude${n('?')}`,

    /**
     * UNDER THE QUESTION, because the question is optional and a reader who
     * does not answer it must not feel they have skipped something.
     */
    helper:
      'Cochez vos jours habituels pour voir où vous arrivez au 31 décembre. ' +
      'Sans réponse, le calcul montre votre position actuelle, comme avant.',

    /** The five weekdays, as a reader names them. */
    days: {
      MONDAY: 'lundi',
      TUESDAY: 'mardi',
      WEDNESDAY: 'mercredi',
      THURSDAY: 'jeudi',
      FRIDAY: 'vendredi',
    },

    /** The badge. R340: labelled, and never by colour alone. */
    label: 'Projection',

    heading: 'Fin décembre, projection',

    /** Today’s figure, named so the two cannot be confused. */
    current: 'Aujourd’hui',

    /**
     * THE DAY IT WAS COMPUTED FOR, on the page (R28). A shared link opened
     * in November must not show October’s projection, and the only way a
     * reader can tell is if the page says which day it answered.
     */
    asOf: (day: string): string => `Projection au ${day}`,

    assumptionsHeading: 'Ce que cette projection suppose',

    /**
     * IN WORDS, NOT IMPLIED (R340). Each line is something a reader could
     * disagree with, which is the point: a projection whose assumptions are
     * invisible reads as a measurement.
     */
    assumptions: {
      rhythm:
        'Vos jours habituels se répètent chaque semaine jusqu’au 31 décembre.',
      holidays:
        `Les jours fériés et les congés ne sont pas déduits${n(':')} la projection ` +
        'annonce donc un peu tôt plutôt que trop tard.',
      today:
        `La journée d’aujourd’hui n’est pas imaginée${n(':')} elle est déjà ` +
        'enregistrée, ou elle ne l’est pas.',
    },

    /**
     * R340, said plainly and on the surface that shows the figure. The app
     * screen carries the same sentence.
     */
    neverRecorded: 'Une projection ne figure jamais dans votre relevé.',

    /**
     * THE APP LINE, IN THE FUTURE TENSE UNTIL ONE IS RELEASED (R138), and
     * the tense is chosen by PRODUCT_STATE rather than by whoever edits this
     * file next (R172).
     */
    app: (released: boolean): string =>
      released
        ? `L’application tient cette projection à jour à partir des journées ` +
          `qu’elle enregistre.`
        : `L’application tiendra cette projection à jour à partir des ` +
          `journées qu’elle enregistre.`,

    /**
     * ON THE CALCULATOR, where there is no projection to draw. R351 put the
     * answer on its own route and the projection is drawn by the server, so
     * a reader who has checked some days is told where it appears rather
     * than left wondering why nothing happened.
     */
    onTheResult: 'Votre projection apparaît avec le résultat.',
  },

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

  /**
   * THE RESULT PAGE (R351) - the one surface this calculator can answer on
   * without JavaScript.
   *
   * WHY IT EXISTS. The calculator is a client island and its route is STATIC
   * by a recorded ruling (FW13 increment 2): reading searchParams on that
   * page moves <title> and the canonical out of <head> and into the body,
   * where AC3's noindex is ignored. So the island decodes the URL on mount,
   * and a reader with no scripting is handed a form that cannot answer. This
   * page answers, on the server, from the SAME parameters.
   *
   * NOTHING HERE RESTATES THE RESULT. The figures, the rail and the warnings
   * are ResultPanel's, rendered from the same engine call the island makes
   * (R206). These are the strings the PAGE needs and the panel does not have:
   * its own name, why the reader is here, and the way back.
   */
  resultat: {
    title: 'Votre résultat',

    /** What the page DID, never what the figure means - that is the panel's. */
    description:
      'Le résultat calculé à partir des chiffres transmis dans l’adresse, ' +
      'sans JavaScript et sans inscription.',

    heading: 'Votre part de télétravail',

    /**
     * Shown when the address carries nothing the engine can read - the bare
     * path, or a link whose parameters a mail client mangled. It does not say
     * "erreur": nothing has gone wrong, there is simply nothing to compute.
     */
    empty:
      'Cette adresse ne contient aucun chiffre à calculer. Indiquez votre ' +
      'situation dans le calculateur.',

    /**
     * Shown when the parameters were read and the engine refused them. The
     * reasons come from the engine through errorMessage(), never from here;
     * this is only the sentence that frames them.
     */
    invalid: `Ces chiffres ne permettent pas un calcul${n(':')}`,

    /**
     * THE LAST LINE OF THE LINK NOTICE, AND THE ONLY LINE OF IT WRITTEN HERE.
     *
     * PARAM_NOTICE owns the rest - the lead, the list of values that could
     * not be read, the list of params the calculator does not use - because
     * those three sentences are true on any surface that reads the URL, and
     * one text has one home (R206).
     *
     * ITS advice LINE IS NOT. It reads "vous pouvez corriger les champs
     * ci-dessus", which is true on the calculator, where the fields are
     * above the notice, and false here: this page has no fields at all.
     * Lifting it would be FD13 inline card again - the best sentence in the
     * set, true in exactly one place (R165) - so this surface writes its own.
     */
    noticeAdvice:
      'Rouvrez le calculateur pour saisir ces valeurs vous-même' +
      `${n(';')} le résultat se mettra à jour.`,

    /**
     * THE WAY BACK, carrying the same parameters. A reader changing a number
     * lands on the calculator with their scenario already in it - which is
     * what the island's decode-on-mount does, so for a scripted visitor this
     * link is the whole interactive calculator.
     */
    modify: 'Modifier mes chiffres',

    /**
     * THE ONE THING THIS PAGE CANNOT ANSWER, SAID RATHER THAN HIDDEN.
     *
     * The calculator asks whether the reader had missions outside
     * Switzerland and reveals two count fields when they say yes. The
     * reveal is JavaScript, so a reader without it can answer the question
     * and has nowhere to put the numbers - the form submits, and the engine
     * computes from zero mission days.
     *
     * That is the SILENTLY WRONG ANSWER the question exists to prevent, so
     * it is not left silent: this names the limit and the way round it.
     */
    missionsNotCounted:
      'Vous avez indiqué avoir effectué des missions hors de Suisse. Ce ' +
      `calcul ne les compte pas, faute du nombre de jours${n(':')} ouvrez le ` +
      'calculateur pour les saisir.',

    /** For an address that carried nothing: the plain way in. */
    open: 'Ouvrir le calculateur',
  },
} as const;
