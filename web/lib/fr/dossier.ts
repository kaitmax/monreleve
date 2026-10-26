// web/lib/fr/dossier.ts
//
// Every word of the Relevé annuel de télétravail — the DOCUMENT, not the page
// that explains it. FW24 increment 5.
//
// lib/fr/releve-annuel.ts is the explainer at /releve-annuel: prose about what
// the document will contain, written for somebody deciding whether to use the
// product. This file is the document itself, read by somebody holding it in
// front of an administration.
//
// ============================================================================
// THE THRESHOLDS ARE ARGUMENTS, NEVER LITERALS (R73, R153)
// ============================================================================
//
// 40 % and 49,9 % belong to the year's RuleSet (SPEC §7.7). A string containing
// them would go stale on a rule change with nothing failing. Every function
// that names a threshold takes it ALREADY FORMATTED, through formatPercent,
// from the RuleSet, by the caller.
//
// SPEC §12 item 3 requires the zone panel to name BOTH thresholds explicitly,
// which is why that sentence is a function of two arguments rather than a
// constant. Naming the rule instead — "le plafond fiscal" — is what R153 asks
// for where a format cannot interpolate; this one can, so it states the figures
// the reader has to act on.
//
// ============================================================================
// THE VOCABULARY IS CONSTRAINED, AND THIS IS THE FILE WHERE IT MATTERS MOST
// ============================================================================
//
// SPEC §12: the document never uses *certifié*, *attesté*, *conforme*,
// *validé* or *approuvé*. It says *déclaré*, *enregistré*, *horodaté*.
//
// Auto-detection makes overclaiming tempting — the product knows a great deal
// about where somebody was — and overclaiming is the fastest way to make this
// file worthless in front of an administration. A document that says *certifié*
// invites the question of who certified it, and the honest answer is nobody.
//
// ============================================================================
// IT MUST SURVIVE A MONOCHROME PHOTOCOPY (SPEC §12)
// ============================================================================
//
// Every status carries a WORD as well as a colour. The badge labels below are
// not decoration beside a coloured dot: they are the status, and the colour is
// the decoration. A reader who photocopies this in black and white must lose
// nothing.

// LOCAL, as every other lib/fr module defines them. There is no shared
// typography module in this project and introducing one would be a refactor
// across nine files for a task that is about a document.
const APOS = String.fromCharCode(0x2019);
const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it (R91). */
const n = (mark: string): string => `${NB}${mark}`;

/** The document's own name, as it appears at the top of the page. */
const TITLE = 'Relevé annuel de télétravail';

/**
 * FW-DOSSIER-EMPTY-3 (R586, closes PARK-H5): the zone every time on the
 * document is shown in, NAMED. The operator's example, verbatim:
 * « 14:32 (heure de Paris) ».
 */
const PARIS_ZONE = 'heure de Paris';

/** A formatted time - or a column heading over such times - with the zone named after it. */
const inParisTime = (text: string): string => `${text} (${PARIS_ZONE})`;

export const DOSSIER_COPY = {
  title: TITLE,

  /**
   * FW-DOSSIER-EMPTY (R516): a year with no day recorded says so in words.
   *
   * docs/api-v1.md 8.2: `recordedEntries === 0` is not a compliant year - both
   * declare 0 %, one because the person logged nothing. Without this sentence
   * the document prints 0,00 % over a year of *Non renseigné* rows and leaves
   * an administration to decide which of the two it is holding.
   *
   * WRITTEN FOR THE DOCUMENT, NOT LIFTED (R165). The Android Relevé's own note
   * speaks of "cette année" in the present tense, which is true of a live year
   * on a screen and wrong on a PDF of a closed one; this names the year,
   * because a printed page outlives the context that would supply it.
   *
   * THE OPERATOR'S WORDING (R585), verbatim, replacing the first pass's
   * "... reflètent donc une absence de saisie, et non une situation": that left
   * a reader unsure what "une situation" meant. This says exactly what
   * happened - the rates are computed over zero days - and claims nothing more.
   */
  emptyYear: (year: number): string =>
    `Aucune journée n${APOS}est enregistrée pour l${APOS}année ${year}. ` +
    `Les taux de ce relevé sont calculés sur zéro journée et ne décrivent pas votre situation.`,

  /**
   * FW-DOSSIER-EMPTY-3 (R586, closes PARK-H5): EVERY TIME THE DOCUMENT SHOWS
   * IS PARIS TIME, AND SAYS SO.
   *
   * The server stores every instant in UTC and still does - only what is
   * printed changed. The document used to print those instants as a UTC wall
   * clock with no zone named, so a relevé generated at 00:30 on 1 January in
   * Paris said 31 December 23:30, and a day recorded at 00:30 carried a
   * receipt stamp dated the day before it. Europe/Paris is the clock of every
   * calendar day in this product (R28, R582); the label says which clock the
   * reader is holding.
   *
   * It takes the instant ALREADY FORMATTED (formatDateTime, pinned to
   * Europe/Paris) and appends the zone, so the generation stamp reads
   * « 24.10.2026 à 14:32 (heure de Paris) ». The annex's three stamp columns
   * carry the same label once, in their heading, rather than on every cell of
   * a table that runs to 261 rows (annex below).
   */
  parisTime: inParisTime,

  // --------------------------------------------------------------------
  // 1. Header — SPEC 12 item 1
  // --------------------------------------------------------------------
  header: {
    name: 'Nom',

    /**
     * R331: a releve for a tax year in which the holder name changed carries
     * ONE line, and it states only the DATE. It never prints a former name -
     * people change names for marriage, divorce or transition, and a former
     * name on a tax document is a real harm. The date arrives already formatted.
     */
    nameChanged: (date: string): string => `Nom modifié le ${date}`,

    canton: 'Canton de travail',
    employmentRate: `Taux d${APOS}activité`,
    method: 'Méthode de calcul',
    period: 'Période couverte',
    generatedAt: 'Date de génération',

    /**
     * D28: absences are counted ONCE, in this block, and appear in no other
     * figure. SPEC 12 item 5 puts the count here rather than in a tile,
     * because it is a fact about the record and not a term in the rate.
     */
    absencesDeclared: 'Absences déclarées',

    /**
     * The two denominator methods, in the reader's words rather than ours.
     *
     * THE BASIS IS AN ARGUMENT. 240 belongs to the year's RuleSet
     * (`simplifiedBasisDays`), and rules.ts says it is the only place a
     * threshold may appear. Typed here it would go stale on a rule change with
     * nothing failing - R147's scan caught it on this file's first run.
     */
    methodSimplified: (basisDays: number): string => `Forfait de ${basisDays} jours`,
    methodExact: `Jours ouvrés communiqués par l${APOS}employeur`,

    /** The period, when the person worked the whole year. */
    fullYear: (year: number): string => `Année ${year} entière`,
    fromDate: (from: string, year: number): string => `Du ${from} au 31 décembre ${year}`,

    /**
     * A prorated period whose cause the payload cannot name.
     *
     * NO PATH PRODUCES THIS TODAY: the only thing that prorates the basis is
     * `activityStartDate`, and when it does, the start date is what
     * `fromDate` prints. This exists because the renderer keys on the FRACTION
     * THE ENGINE USED rather than on the start date - so if something else
     * ever prorates, the document says something true rather than falling back
     * to "année entière", which is the exact sentence FW26 had to correct.
     *
     * It is on R238's allow-list, naming the state it waits for.
     */
    partialPeriod: (year: number): string => `Période partielle de ${year}`,
  },

  // --------------------------------------------------------------------
  // 2. The four tiles — SPEC 12 item 2
  // --------------------------------------------------------------------
  tiles: {
    workedDays: 'Jours ouvrés',
    swissDays: 'Jours en Suisse',
    teleworkDays: 'Télétravail',
    missionDays: 'Missions',

    /**
     * The denominator is not a row count, and the tile says so.
     *
     * A reader who counts the annex rows and compares them with this tile will
     * get a different number under the simplified basis — 261 rows against a
     * 240-day forfait. The denominator is PRORATED, not counted (SPEC §7.4).
     * Saying nothing invites the conclusion that the document cannot add up.
     *
     * ========================================================================
     * R225: THIS STRING EXISTING IS NOT THE GUARANTEE. FW25 OWES THE TEST.
     * ========================================================================
     *
     * The copy guards prove this sentence is well-formed French. The payload
     * tests prove both numbers are right. Neither can tell you the reader ever
     * sees the sentence that reconciles them - which is R175's unexamined
     * space, between two verified things.
     *
     * WHAT FW25 OWES: a test that RENDERS the dossier and fails if this note
     * is absent while the tile and the annex disagree in count. Conditional on
     * the condition, both ways - a test that always demanded the note would
     * pass on a document where the two figures agree and the note is noise.
     *
     * Asserting that this constant exists would be the version that passes
     * today and proves nothing, because the constant was never what was
     * missing.
     */
    workedDaysNote: `Base de calcul retenue pour l${APOS}année, et non le nombre de journées saisies.`,
  },

  // --------------------------------------------------------------------
  // 3. The zone panel — SPEC 12 item 3
  // --------------------------------------------------------------------
  zone: {
    /** The figure. R224: the declarable rate, never the raw one. */
    declarableLabel: `Taux à déclarer à l${APOS}AFC`,

    /** The explanatory figure, shown beside it when the two differ. */
    rawLabel: 'Part de jours hors de Suisse',

    /**
     * Why two figures appear, when they do.
     *
     * FD3's two-rate state. Without this sentence a reader sees two
     * percentages a point apart and has no way to know which one to file —
     * which is worse than showing one.
     */
    ratesDifferNote:
      `Les deux pourcentages diffèrent parce qu${APOS}ils ne comptent pas les mêmes ` +
      `journées${n(':')} le taux à déclarer retient les jours imputés au plafond, ` +
      `la part hors de Suisse retient toutes les journées passées hors du pays. ` +
      `C${APOS}est le premier qui est communiqué à l${APOS}administration.`,

    /**
     * SPEC 12 item 3: the explicit sentence naming BOTH thresholds.
     *
     * Both arrive formatted. A reader holding this document needs the two
     * numbers that decide their situation, not the names of the rules.
     */
    thresholds: (fiscal: string, social: string): string =>
      `Deux seuils s${APOS}appliquent${n(':')} ${fiscal} pour l${APOS}imposition, ` +
      `${social} pour la sécurité sociale. Ils ne se déclenchent pas au même ` +
      `moment et ne relèvent pas de la même administration.`,

    /**
     * The badge labels. THE WORD IS THE STATUS, not a caption for a colour.
     */
    // THERE IS NO "PROCHE DU SEUIL" BADGE, AND THERE WAS ONE HERE UNRENDERED
    // (R240). SPEC line 291 makes the 30 % and 38 % steps IN-BAND ALERTS, "not
    // new statuses", so a fourth badge would assert a status the engine does
    // not have - and once the remaining days are printed below, "proche" is
    // the judgement the READER makes from the number, which is better than a
    // document that must not advise making it for them.
    badgeUnder: 'Sous les deux seuils',
    badgeOverFiscal: `Seuil d${APOS}imposition dépassé`,
    badgeOverSocial: 'Seuil de sécurité sociale dépassé',

    /** What a breach means, said once, without advising. */
    overFiscalNote:
      `Au-delà de ce seuil, une part de votre rémunération devient imposable en ` +
      `France. Ce document ne dit pas ce qu${APOS}il faut faire${n(';')} il indique ` +
      `ce qui a été enregistré.`,

    // ========================================================================
    // THE ANSWER TO THE QUESTION THIS PRODUCT EXISTS TO ANSWER (R239)
    // ========================================================================
    //
    // These two labels sat here unrendered until FW26. The payload carried the
    // figures, the rail POSITIONED the reader between two thresholds, and the
    // document never said how far - so the artifact the product exists to
    // produce omitted the distance it exists to compute.
    //
    // It is the workedDaysNote case rather than a feature: a reader looking at
    // a rail with two ticks and a filled portion asks HOW FAR, and a document
    // should answer a question it visibly raises.
    remainingToFiscal: `Jours restants avant le seuil d${APOS}imposition`,
    remainingToSocial: 'Jours restants avant le seuil de sécurité sociale',

    /**
     * The same quantity past the ceiling, and a DIFFERENT SENTENCE.
     *
     * SPEC 7.2 step 6 and R12: negatives are reported, never clamped -
     * "6,5 jours au-dessus" beats "0 jours restants", and beats a minus sign,
     * which reads as a formatting artefact rather than as a position.
     *
     * WRITTEN FOR THIS DOCUMENT rather than lifted from METRIC_COPY (R165).
     * That module names the threshold by VALUE - "avant 40 %" - because SPEC
     * 9.3 stands two negative-capable tiles side by side in the calculator.
     * The dossier names the RULE, matching the badge directly above these
     * lines, so the panel speaks in one vocabulary.
     */
    overFiscal: `Jours au-dessus du seuil d${APOS}imposition`,
    overSocial: 'Jours au-dessus du seuil de sécurité sociale',

    // ========================================================================
    // PARKAN-49: THE TWO FIGURES THE ACCOUNTANT'S LIST ASKED FOR (items 3 and 5)
    // ========================================================================
    //
    // Both are ADDITIVE /v1 fields computed by the engine, rendered here beside
    // the declarable rate. They are what a reader needs to answer the January
    // question - does the employer have the same figure? - from their own record.

    /** Item 3: the declarable rate with the missions removed (telework alone). */
    rateWithoutMissions: 'Taux sans les missions',
    rateWithoutMissionsNote: `Le télétravail seul, sans les jours de mission.`,

    /** Item 5: how many mission days were counted against the annual cap. */
    creditedMissions: 'Jours de mission comptés dans le taux',
    creditedMissionsNote:
      `Au-delà de la limite annuelle, les jours de mission ne sont pas comptés ` +
      `dans le taux à déclarer.`,
  },

  // --------------------------------------------------------------------
  // 4. The monthly table — SPEC 12 item 4
  // --------------------------------------------------------------------
  months: {
    caption: 'Répartition mensuelle',
    month: 'Mois',
    swiss: 'Suisse',
    home: 'Domicile',
    missionFrance: 'Mission FR',
    missionThird: 'Mission tiers',
    // R91: French sets a no-break space before %, and the guard caught this
    // one as an ASCII space on its first run.
    cumulative: `Cumul${n('%')} déclarable`,

    /**
     * Why the last row equals the annual figure.
     *
     * A reader who adds the twelve monthly percentages will not get the
     * December figure, and should not expect to. Saying so costs one line and
     * prevents the conclusion that the table is wrong.
     */
    cumulativeNote:
      `Chaque ligne indique le taux calculé de janvier au mois concerné${n(';')} ` +
      `il ne s${APOS}agit pas d${APOS}une somme des mois précédents.`,
  },

  // --------------------------------------------------------------------
  // 5. The evidence annex — SPEC 12 item 5
  // --------------------------------------------------------------------
  annex: {
    heading: 'Annexe',
    subheading: 'Détail des journées',

    dayDate: 'Date',
    portion: 'Journée',
    kind: 'Nature',
    note: 'Note',
    // R586: the three columns of instants name their zone in the heading - the
    // operator's label after the column's own words. Every cell beneath is
    // Paris time; the label on each would double a 261-row table's width.
    firstRecordedAt: inParisTime('Enregistré le'),
    lastModifiedAt: inParisTime('Modifié le'),
    clientClaimedAt: inParisTime('Saisi hors ligne le'),
    provenance: 'Origine',

    /** Portions, in words. */
    portionFull: 'Journée entière',
    portionMorning: 'Matin',
    portionAfternoon: 'Après-midi',

    /** The five kinds. */
    kindSwiss: 'Suisse',
    kindHome: 'Domicile',
    kindMissionFrance: 'Mission en France',
    kindMissionThird: 'Mission pays tiers',

    /** Absences carry their reason (D28). */
    absenceConge: 'Absence — congé',
    absenceMaladie: 'Absence — maladie',
    absenceFerie: 'Absence — jour férié',
    absenceAutre: 'Absence — autre',

    /**
     * SPEC 12 item 5: days with no entry are PRINTED, never skipped.
     *
     * A document that silently omits dates invites the question of what else
     * it omits.
     */
    notRecorded: 'Non renseigné',

    /** Provenance in words — D17, and the three are distinct on purpose. */
    provenanceManual: 'Saisie manuelle',
    provenanceConfirmed: 'Détection confirmée',
    provenanceCorrected: 'Détection corrigée',

    /**
     * The late flag. SPEC 11.3.
     *
     * It names the fact, not a judgement: the entry arrived after the fact and
     * the document says when. Nothing here calls it a problem.
     */
    late: 'Saisie tardive',

    /** What the flag means, once, at the foot of the annex. */
    lateNote:
      `« Saisie tardive » signale une journée enregistrée plus d${APOS}une semaine ` +
      `après la date concernée. L${APOS}horodatage retenu est celui de la réception ` +
      `par le serveur.`,

    /** Why two timestamps can appear on one row. */
    offlineNote:
      `Lorsque la saisie a eu lieu hors ligne, la date annoncée par l${APOS}appareil ` +
      `figure à côté de celle de la réception. Seule la seconde est attribuée par ` +
      `le serveur.`,
  },

  // --------------------------------------------------------------------
  // 6. Footer — SPEC 12 item 6, $legal-01
  // --------------------------------------------------------------------
  //
  // R183: THE DOCUMENT'S FOOTER AND THE SITE'S ARE DIFFERENT STRINGS. The site
  // footer's version is conditional on trackerExists, because there the clause
  // is a claim about a product state. Here it is unconditional and always true:
  // every entry in an exported dossier carries a server timestamp, or it would
  // not be in the document.
  footer: {
    timestamps:
      `Chaque journée de ce relevé porte un horodatage attribué par le serveur ` +
      `au moment de sa réception.`,

    declaration:
      `Document établi sur la base des déclarations de l${APOS}utilisateur, à des ` +
      `fins de conservation de justificatifs.`,

    notAdvice: `Ce document ne constitue pas un conseil fiscal.`,
  },

  // --------------------------------------------------------------------
  // 7. Verification block — FW-VERIFY (R329/R332)
  // --------------------------------------------------------------------
  //
  // R332: this block appears ONLY when a permanent production origin is set
  // (lib/verification/origin.ts). The code, the address and the QR all point at
  // the same URL; the code is printed as TEXT for anyone who cannot scan. The
  // address and code are VALUES the server supplies (an identifier and a URL),
  // interpolated as data - R155 exempts identifiers, and the copy here is the
  // labels, not the values.
  verification: {
    heading: 'Vérification',
    lead:
      `Ce relevé peut être vérifié en ligne, à l${APOS}adresse ci-dessous ou en ` +
      `scannant le code. La page indique s${APOS}il correspond à celui émis par le service.`,
    qrAlt: 'Code QR menant à la page de vérification de ce relevé',
    // n(':') sets the no-break space French puts before the colon (R91), at
    // runtime, so no literal lands in the source for the codepoint census.
    addressLine: (url: string): string => `Adresse${n(':')} ${url}`,
    codeLine: (code: string): string => `Code${n(':')} ${code}`,
  },
} as const;
