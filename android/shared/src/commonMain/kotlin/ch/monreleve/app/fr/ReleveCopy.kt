package ch.monreleve.app.fr

// AN11 (SPEC 11.4, SPEC 12). Every word of the Releve annuel de teletravail AS THE APP RENDERS IT - the
// DOCUMENT, ported from web/lib/fr/dossier.ts so the Android screen and the PDF say the same thing (SPEC
// 12: "the same document at two widths"). Fully accented (R155). The apostrophe is U+2019 and a no-break
// space precedes ':' ';' '%' (R91/R126), exactly as the web copy sets them - this is a legal document and
// its typography is part of it.
//
// ONE HOME, REFERENCED BY KEY (R206). Where a word already lives in fr/ this file REFERENCES it rather
// than re-typing it, so a future edit cannot leave two copies to drift and CopyDuplicationTest stays
// green: "Non renseigne" and "Saisie tardive" are CalendarCopy's; "Saisie manuelle", "Domicile", "Matin"
// and "Apres-midi" are AujourdhuiCopy's; the two rate captions are RatesCopy's (used directly by the
// screen); the fallback-bareme note is AujourdhuiCopy's. This file owns only the strings that are the
// document's alone.
//
// THE VOCABULARY IS CONSTRAINED (SPEC 12): never certifie, atteste, conforme, valide or approuve. It says
// declare, enregistre, horodate. Overclaiming is the fastest way to make this file worthless in front of
// an administration.

/** U+00A0 NO-BREAK SPACE, before ':' ';' '%' (R91), so the mark never wraps away from its word. */
private val NB: Char = 0x00A0.toChar()

// The French apostrophe is written as the literal U+2019 character in every string below (R126), never the
// ASCII straight quote - the same way AujourdhuiCopy and StatusCopy carry it.

// A copy module is naturally many small format helpers (period, method, thresholds, the annex mappings);
// the count is inherent to holding the document's words in one home. Not a ui/ file (fence 4 scans ui/dev).
@Suppress("TooManyFunctions")
object ReleveCopy {
    /** The document's own name, at the top of the screen and the PDF. */
    const val TITLE = "Relevé annuel de télétravail"

    // ------------------------------------------------------------------
    // States around the document
    // ------------------------------------------------------------------
    const val LOADING = "Chargement du relevé…"

    /** recordedEntries == 0 (docs section 8.2): a clean 0 % over a year nobody filled in is not compliance. */
    val EMPTY_RECORD_NOTE =
        "Aucune journée n’a encore été enregistrée pour cette année$NB: ce taux ne reflète pas une " +
            "situation, mais une absence de saisie."

    /**
     * R287: the releve is the SERVER's computation over what it has received; days still pending on this
     * device are not in it. Aujourd'hui's year panel includes them, so the two screens can differ - this
     * line names why, so a reader who sees two rates trusts the document rather than neither. Shown exactly
     * when something is pending (the screen gates on the count).
     *
     * AN-RELEVE-FRESH (R561): RE-WORDED, not added - this was already the one home for the count (R206). It now
     * says what the person did and what the app has not yet done, in SignInCopy.sessionClosed's own words for
     * the same fact ("journée enregistrée sur ce téléphone", "envoyée"), so the two screens that name unsent
     * days name them alike. Singular for one day, plural above; the screen never renders it for zero.
     */
    fun pendingNotSynced(count: Int): String =
        if (count > 1) {
            "$count journées enregistrées sur ce téléphone n’ont pas encore été envoyées$NB: ce relevé ne les " +
                "compte pas encore."
        } else {
            "$count journée enregistrée sur ce téléphone n’a pas encore été envoyée$NB: ce relevé ne la compte " +
                "pas encore."
        }

    const val ERROR_SERVER = "Le relevé n’a pas pu être chargé pour le moment. Réessayez dans un instant."
    const val ERROR_NETWORK =
        "Le relevé n’a pas pu être chargé. Vérifiez votre connexion, puis réessayez."
    const val ERROR_SESSION_EXPIRED =
        "Votre session a expiré. Reconnectez-vous pour consulter votre relevé."
    const val ERROR_SESSION_ENDED =
        "Votre session a été fermée. Reconnectez-vous pour consulter votre relevé."
    const val ERROR_NO_SESSION = "Connectez-vous pour consulter votre relevé."

    // ------------------------------------------------------------------
    // R288: an offline copy is DATED and never presented as current (SPEC 13.2, D22)
    // ------------------------------------------------------------------
    const val OFFLINE_TITLE = "Copie hors ligne"

    fun offlineCaveat(generatedDay: String): String =
        "Ce relevé n’a pas pu être actualisé. Voici la dernière copie enregistrée, générée le " +
            "$generatedDay$NB; elle peut ne pas refléter les journées enregistrées depuis."

    // ------------------------------------------------------------------
    // AN-RELEVE-FRESH (R560): a copy the last sync made stale is shown at once while the server's current record is
    // fetched, and SAYS it is being updated; a refresh the server could not answer keeps the copy and says that
    // nothing was changed (AN-PULL's YEAR_DOWNLOAD_FAILED tone). Offline, R288's dated copy above is the sentence.
    // ------------------------------------------------------------------
    const val UPDATING = "Mise à jour du relevé…"

    fun refreshFailed(generatedDay: String): String =
        "Le relevé n’a pas pu être mis à jour. Rien n’a été modifié$NB: voici la dernière copie " +
            "enregistrée, générée le $generatedDay."

    // ------------------------------------------------------------------
    // Provisional banner - SPEC 11.4 ("provisional until the year closes, and it says so"), FD7 section 2
    // ------------------------------------------------------------------
    const val BANNER_PROVISIONAL_TITLE = "Relevé provisoire"

    fun bannerProvisionalBody(
        generatedDay: String,
        year: Int,
    ): String = "Année en cours au $generatedDay. Le relevé sera complet après le 31 décembre $year."

    // ------------------------------------------------------------------
    // PARKAN-26: the year switch. A completed past year reads differently from the current provisional one -
    // "année close", not "année en cours" (R156 open-question 2). The selector offers every year with days,
    // newest first (R328: a read-only view of what /api/v1/dossier?year= already serves).
    // ------------------------------------------------------------------
    const val BANNER_CLOSED_TITLE = "Relevé de l’année close"

    fun bannerClosedBody(year: Int): String = "L’année $year est terminée. Ce relevé est complet."

    /** The selector's heading, so the year chips carry a label (TalkBack reads it before the years). */
    const val YEAR_SELECTOR_LABEL = "Année du relevé"

    /** One year chip's label - the year itself. In fr/ so the ui/ no-literal fence stays satisfied. */
    fun yearLabel(year: Int): String = year.toString()

    // ------------------------------------------------------------------
    // 1. Header - SPEC 12 item 1
    // ------------------------------------------------------------------
    const val HEADER_NAME = "Nom"

    /** "Canton de travail" is OnboardingCopy's one home (R206) - the same label the person set it under. */
    val HEADER_CANTON = OnboardingCopy.CANTON_LABEL
    const val HEADER_EMPLOYMENT_RATE = "Taux d’activité"
    const val HEADER_METHOD = "Méthode de calcul"
    const val HEADER_PERIOD = "Période couverte"
    const val HEADER_GENERATED_AT = "Date de génération"
    const val HEADER_ABSENCES_DECLARED = "Absences déclarées"

    /** The simplified basis is the year's RuleSet value, never a typed 240 (R153/R181). */
    private fun methodSimplified(basisDays: Int): String = "Forfait de $basisDays jours"

    private const val HEADER_METHOD_EXACT = "Jours ouvrés communiqués par l’employeur"

    /**
     * The method line in words, from the wire's denominatorKind - the EXACT/SIMPLIFIED branch lives here
     * (fr/), never in the screen, which must not compare a wire code (R202/fence 4).
     */
    fun methodLabel(
        denominatorKind: String,
        basisDays: Int,
    ): String = if (denominatorKind == "EXACT") HEADER_METHOD_EXACT else methodSimplified(basisDays)

    /** Keyed on the fraction the engine used, never on the start date (docs section 8.2, FW26). */
    fun periodFullYear(year: Int): String = "Année $year entière"

    fun periodFromDate(
        from: String,
        year: Int,
    ): String = "Du $from au 31 décembre $year"

    /** No path produces this today; it exists so a future proration says something true, not "année entière". */
    fun periodPartial(year: Int): String = "Période partielle de $year"

    // ------------------------------------------------------------------
    // 2. The four tiles - SPEC 12 item 2
    // ------------------------------------------------------------------
    const val TILE_WORKED_DAYS = "Jours ouvrés"
    const val TILE_SWISS_DAYS = "Jours en Suisse"
    const val TILE_TELEWORK_DAYS = "Télétravail"
    const val TILE_MISSION_DAYS = "Missions"

    /** R225: the denominator is prorated, not a row count, and the tile says so. */
    const val TILE_WORKED_DAYS_NOTE =
        "Base de calcul retenue pour l’année, et non le nombre de journées saisies."

    // ------------------------------------------------------------------
    // 3. The zone panel - SPEC 12 item 3
    // ------------------------------------------------------------------
    // The declarable and raw captions are RatesCopy's (one home) - the screen reads them from there.

    /** Why two percentages appear, when they do (FD3's two-rate state). The document's own wording. */
    val RATES_DIFFER_NOTE =
        "Les deux pourcentages diffèrent parce qu’ils ne comptent pas les mêmes journées$NB: " +
            "le taux à déclarer retient les jours imputés au plafond, la part hors de Suisse retient " +
            "toutes les journées passées hors du pays. C’est le premier qui est communiqué à " +
            "l’administration."

    /** SPEC 12 item 3: the sentence naming BOTH thresholds, each arriving already formatted (R153). */
    fun thresholds(
        fiscal: String,
        social: String,
    ): String =
        "Deux seuils s’appliquent$NB: $fiscal pour l’imposition, $social pour la sécurité " +
            "sociale. Ils ne se déclenchent pas au même moment et ne relèvent pas de la même administration."

    /** The badge is a WORD (SPEC 12, monochrome-photocopy). Derived from remainingTo* < 0, like the PDF. */
    const val BADGE_UNDER = "Sous les deux seuils"
    const val BADGE_OVER_FISCAL = "Seuil d’imposition dépassé"
    const val BADGE_OVER_SOCIAL = "Seuil de sécurité sociale dépassé"

    val OVER_FISCAL_NOTE =
        "Au-delà de ce seuil, une part de votre rémunération devient imposable en France. Ce document " +
            "ne dit pas ce qu’il faut faire$NB; il indique ce qui a été enregistré."

    /** R239: how far. Names the RULE, not its value, matching the badge above (R165, written for the document). */
    const val REMAINING_FISCAL_LABEL = "Jours restants avant le seuil d’imposition"
    const val REMAINING_SOCIAL_LABEL = "Jours restants avant le seuil de sécurité sociale"
    const val OVER_FISCAL_LABEL = "Jours au-dessus du seuil d’imposition"
    const val OVER_SOCIAL_LABEL = "Jours au-dessus du seuil de sécurité sociale"

    /** EXACT_METHOD_UNVERIFIED (docs section 8.2). The fallback-bareme warning reuses AujourdhuiCopy.fallbackNote. */
    const val WARNING_EXACT_UNVERIFIED =
        "La base en jours ouvrés a été renseignée par vous et n’est pas vérifiée par ce service."

    // PARKAN-49: the two figures the accountant's list asked for (items 3 and 5), rendered beside the
    // declarable rate as the PDF renders them. Ported word-for-word from web/lib/fr/dossier.ts (SPEC 12,
    // the same document at two widths). Additive /v1 fields, both computed by the engine.

    /** Item 3: the declarable rate with the missions removed (telework alone). */
    const val RATE_WITHOUT_MISSIONS = "Taux sans les missions"
    const val RATE_WITHOUT_MISSIONS_NOTE = "Le télétravail seul, sans les jours de mission."

    /** Item 5: how many mission days were counted against the annual cap. */
    const val CREDITED_MISSIONS = "Jours de mission comptés dans le taux"
    const val CREDITED_MISSIONS_NOTE =
        "Au-delà de la limite annuelle, les jours de mission ne sont pas comptés dans le taux à déclarer."

    // ------------------------------------------------------------------
    // 4. The monthly table - SPEC 12 item 4. Missions merged to one column on mobile (todo.md AN11, FD7).
    // ------------------------------------------------------------------
    const val MONTHS_CAPTION = "Répartition mensuelle"
    const val MONTH_COL = "Mois"

    /** "Suisse" - the monthly Suisse column AND the annex's CH kind read this one home. */
    const val KIND_SWISS = "Suisse"
    const val MONTH_HOME_SHORT = "Dom."
    const val MONTH_MISSION_SHORT = "Miss."
    const val MONTH_CUMULATIVE = "Cumul"

    /** FD7 section 6: the split of missions between France and pays tiers is in the annex and the PDF. */
    const val MONTHS_MISSIONS_NOTE =
        "La répartition des missions entre la France et les pays tiers figure dans le détail des saisies " +
            "et dans le PDF."

    /** SPEC 12 item 4: why December's figure equals the annual one - it is a cumul, not a sum of months. */
    val MONTHS_CUMULATIVE_NOTE =
        "Chaque ligne indique le taux calculé de janvier au mois concerné$NB; il ne s’agit pas " +
            "d’une somme des mois précédents."

    // ------------------------------------------------------------------
    // 5. The evidence annex - SPEC 12 item 5
    // ------------------------------------------------------------------
    const val ANNEX_HEADING = "Annexe"
    const val ANNEX_SUBHEADING = "Détail des journées"
    const val ANNEX_TOGGLE_SHOW = "Afficher le détail des journées"
    const val ANNEX_TOGGLE_HIDE = "Masquer le détail des journées"

    fun annexCount(recordedEntries: Int): String {
        val plural = if (recordedEntries > 1) "s" else ""
        return "$recordedEntries entrée$plural"
    }

    // The kind/absence/provenance/portion words that only the mapping functions below use are PRIVATE, so
    // the reachability census (R238) sees the FUNCTIONS a surface actually calls, not their constituents -
    // the LegendCopy.forKind / DayCellCopy idiom.

    /** The five kinds, in words. HOME reads AujourdhuiCopy.DOMICILE (one home); CH reads KIND_SWISS. */
    fun annexKind(
        kind: String?,
        absenceReason: String?,
    ): String =
        when (kind) {
            "CH" -> KIND_SWISS
            "HOME" -> AujourdhuiCopy.DOMICILE
            "MISSION_FR" -> KIND_MISSION_FRANCE
            "MISSION_THIRD" -> KIND_MISSION_THIRD
            "ABSENT" -> annexAbsence(absenceReason)
            // A recorded row always carries one of the five frozen wire kinds; an unknown code echoes
            // itself so a new kind is visibly wrong rather than silently mislabelled.
            else -> kind ?: NON_RECORDED
        }

    private const val KIND_MISSION_FRANCE = "Mission en France"
    private const val KIND_MISSION_THIRD = "Mission pays tiers"

    /** Absences carry their reason (D28). */
    private fun annexAbsence(reason: String?): String =
        when (reason) {
            "CONGE" -> ABSENCE_CONGE
            "MALADIE" -> ABSENCE_MALADIE
            "FERIE" -> ABSENCE_FERIE
            else -> ABSENCE_AUTRE
        }

    private const val ABSENCE_CONGE = "Absence — congé"
    private const val ABSENCE_MALADIE = "Absence — maladie"
    private const val ABSENCE_FERIE = "Absence — jour férié"
    private const val ABSENCE_AUTRE = "Absence — autre"

    /**
     * Provenance in words (D17), from the ONE home every surface that names who recorded a day reads (R519, R206):
     * DayCellCopy.provenanceLabel. A missing or unknown code reads as manual, as the annex always has. Internal to the
     * meta line.
     */
    private fun annexProvenance(code: String?): String =
        code?.let { DayCellCopy.provenanceLabel(it) } ?: AujourdhuiCopy.MODE_MANUAL

    /**
     * Portions in words. AM/PM read AujourdhuiCopy.MORNING/AFTERNOON and FULL reads AujourdhuiCopy.WHOLE_DAY (one
     * home each). Internal to the meta line.
     */
    private fun annexPortion(code: String?): String =
        when (code) {
            "AM" -> AujourdhuiCopy.MORNING
            "PM" -> AujourdhuiCopy.AFTERNOON
            else -> AujourdhuiCopy.WHOLE_DAY
        }

    /** A day with no entry (SPEC 12 item 5) reads CalendarCopy's one home for "Non renseigné". */
    val NON_RECORDED = CalendarCopy.NON_RENSEIGNE

    /** The late flag reads CalendarCopy's one home for "Saisie tardive". */
    val ANNEX_LATE = CalendarCopy.QUALITY_LATE

    private const val ANNEX_FIRST_RECORDED = "Enregistré le"
    private const val ANNEX_MODIFIED = "Modifié le"

    // AN-ANNEX-TRUTH (R1261): the DEVICE's clock at the tap, which the app sends on every write (R275), online or
    // not - so the label names whose time it is, never the connectivity of the moment. It read "Saisi hors ligne
    // le" and so labelled every day recorded in the app as entered offline. The PDF's column heading says the same
    // in a heading's register (web/lib/fr/dossier.ts annex.clientClaimedAt, R165).
    private const val ANNEX_CLIENT_CLAIMED = "Selon l’appareil, saisi le"

    /** U+00B7 middot, spaced, between the parts of an annex row's second line. */
    private const val SEP = " · "

    /**
     * One recorded row's second line: portion (only a half-day names it), provenance, and the timestamps
     * in the document's order and words. The stamps arrive already formatted by formatDossierStamp (UTC,
     * matching the PDF). Built here so the surface carries no separator literal (fence 4).
     */
    fun annexEntryMeta(
        portion: String?,
        provenance: String?,
        firstRecorded: String?,
        modified: String?,
        clientClaimed: String?,
    ): String {
        val parts = mutableListOf<String>()
        if (portion != null && portion != "FULL") parts += annexPortion(portion)
        parts += annexProvenance(provenance)
        if (firstRecorded != null) parts += "$ANNEX_FIRST_RECORDED $firstRecorded"
        if (modified != null) parts += "$ANNEX_MODIFIED $modified"
        if (clientClaimed != null) parts += "$ANNEX_CLIENT_CLAIMED $clientClaimed"
        return parts.joinToString(SEP)
    }

    // "Saisie tardive" is ANNEX_LATE's one home (R206), quoted in the guillemets with a no-break space on
    // each side (R91). Built by concatenation so the NB is a plain reference, not a braced interpolation.
    val ANNEX_LATE_NOTE =
        "«" + NB + ANNEX_LATE + NB + "» signale une journée enregistrée plus d’une semaine après la " +
            "date concernée. L’horodatage retenu est celui de la réception par le serveur."

    // R1261: conditional on the device having sent its time, never on being offline (the PDF's deviceTimeNote).
    const val ANNEX_DEVICE_TIME_NOTE =
        "L’heure annoncée par l’appareil lors de la saisie, quand il l’a transmise, figure à côté de celle de " +
            "la réception. Seule la seconde est attribuée par le serveur."

    // ------------------------------------------------------------------
    // Export (AC2, FD7 section 8) - the buttons and the outcomes the composition root reports
    // ------------------------------------------------------------------
    const val EXPORT_PDF = "Exporter en PDF"
    const val EXPORT_CSV = "Exporter en CSV"
    const val EXPORT_CHOOSER_TITLE = "Partager le relevé"

    /** AN-RECON: opens the employer comparison for the year on screen (« a-t-il le même chiffre ? »). */
    const val COMPARE_EMPLOYER = "Comparer avec mon employeur"

    /** SPEC 13.2: the export is a server render and requires connectivity - said plainly, never silent. */
    const val EXPORT_REQUIRES_CONNECTIVITY =
        "L’export nécessite une connexion. Reconnectez-vous à Internet, puis réessayez."
    const val EXPORT_FAILED = "Le document n’a pas pu être produit. Réessayez dans un instant."

    // ------------------------------------------------------------------
    // 6. Footer - SPEC 12 item 6. R183: UNCONDITIONAL here (every entry in the document IS timestamped).
    // ------------------------------------------------------------------
    const val FOOTER_TIMESTAMPS =
        "Chaque journée de ce relevé porte un horodatage attribué par le serveur au moment de sa réception."
    const val FOOTER_DECLARATION =
        "Document établi sur la base des déclarations de l’utilisateur, à des fins de conservation de " +
            "justificatifs."
    const val FOOTER_NOT_ADVICE = "Ce document ne constitue pas un conseil fiscal."
}
