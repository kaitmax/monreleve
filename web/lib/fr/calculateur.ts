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
} as const;
