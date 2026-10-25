package ch.monreleve.app.fr

// AN3 increment 4. SPEC section 966: "a day cell announces kind AND
// record quality AND provenance - colour and shape convey nothing on
// their own." This is the announcement TalkBack reads; there is no
// direct web equivalent to port; the requirement itself is the source.

object DayCellCopy {
    private val KIND_NAMES =
        mapOf(
            "S" to "Suisse",
            "D" to "Domicile",
            "M" to "Mission",
            "A" to "Absence",
        )

    private val QUALITY_NAMES =
        mapOf(
            "ON_TIME" to "enregistré à temps",
            "LATE" to "enregistré en retard",
            // PENDING is recorded but not yet synced: the server has not fixed on-time-versus-late
            // (R216), so the announcement says the sync state, never "à temps" nor "en retard".
            "PENDING" to "en attente de synchronisation",
            "MISSING" to "non enregistré",
            "NONE" to "sans objet",
        )

    // SPEC 8: "Provenance is rendered wherever an entry is shown: the calendar cell ... never as an
    // icon alone." AN-GRANULARITY (R519): EVERY SURFACE THAT NAMES WHO RECORDED A DAY SAYS WHAT THE RECORD SAYS -
    // the calendar sheet, the calendar list, Aujourd'hui's week list, this announcement and the Releve's annex all
    // read the day's OWN provenance through provenanceLabel, never a constant (R181).
    //
    // ONE HOME FOR EACH NAME (R206). MANUAL is AujourdhuiCopy.MODE_MANUAL, the phrase the mode strip shows; the two
    // detected names are held here, once. The LABEL is the capitalised form a surface prints on its own line; the
    // announcement says the same word mid-sentence, so it lower-cases the first letter of the label - that, and only
    // that, is the difference between the two (provenanceInSentence). The Releve's annex reads the same labels.
    private const val DETECTED_CONFIRMED_LABEL = "Détection confirmée"
    private const val DETECTED_CORRECTED_LABEL = "Détection corrigée"

    /**
     * Who recorded a day, as a surface prints it on its own line - by the provenance's `.name` (MANUAL,
     * DETECTED_CONFIRMED, DETECTED_CORRECTED), so fr/ needs no import of either vocabulary. Null for a name this build
     * does not know: the caller decides what an unknown provenance shows, rather than this guessing "manual".
     */
    fun provenanceLabel(provenanceName: String): String? =
        when (provenanceName) {
            "MANUAL" -> AujourdhuiCopy.MODE_MANUAL
            "DETECTED_CONFIRMED" -> DETECTED_CONFIRMED_LABEL
            "DETECTED_CORRECTED" -> DETECTED_CORRECTED_LABEL
            else -> null
        }

    /** The same word inside the announcement's sentence: the label with its first letter lower-cased, nothing else. */
    private fun provenanceInSentence(provenanceName: String): String? =
        provenanceLabel(provenanceName)?.replaceFirstChar { it.lowercase() }

    // Long by design: the announcement names each facet the cell renders (day, kind, quality,
    // correction, today, provenance), mirroring DayCell's own deliberately-separate axes (SPEC 966).
    // R292: a SPLIT half-day names BOTH halves - « matin Suisse, apres-midi Domicile » - so TalkBack
    // reads the whole record, never just the morning (the cell must never say less than the record).
    @Suppress("LongParameterList")
    fun contentDescription(
        dayOfMonth: Int,
        kindLetter: String?,
        qualityName: String,
        corrected: Boolean,
        isToday: Boolean = false,
        provenanceName: String? = null,
        secondKindLetter: String? = null,
        // AN-CAL2: in selection mode TalkBack must announce the cell is selected, not by colour alone
        // (section 2). The word has one home (CalendarCopy.SELECTED, R206); the count is a separate live region.
        selected: Boolean = false,
        // AN-GRANULARITY (R519): the afternoon's provenance when the two halves were recorded differently - then the
        // announcement states each half's, rather than the morning's for both. Null otherwise.
        secondProvenanceName: String? = null,
    ): String {
        val kind = kindClause(kindLetter, secondKindLetter)
        val quality = QUALITY_NAMES[qualityName] ?: qualityName
        val today = if (isToday) "Aujourd’hui, " else ""
        val provenance = provenanceClause(provenanceName, secondProvenanceName)?.let { ", $it" } ?: ""
        // "corrigé" already reads from DETECTED_CORRECTED provenance where both are set; keep the
        // explicit correction clause only when provenance is absent, so the phrase is not doubled.
        val correction = if (corrected && provenanceName == null) ", corrigé" else ""
        val selection = if (selected) "$SELECTED. " else ""

        return "$selection${today}Jour $dayOfMonth, $kind, $quality$provenance$correction."
    }

    // The kind clause: a split half-day names BOTH halves (R292), a whole day one kind, an unrecorded day
    // « Non renseigné ». Extracted so contentDescription stays within its complexity budget.
    private fun kindClause(
        kindLetter: String?,
        secondKindLetter: String?,
    ): String {
        val morningName = kindLetter?.let { KIND_NAMES[it] }
        val afternoonName = secondKindLetter?.let { KIND_NAMES[it] }
        return when {
            morningName != null && afternoonName != null -> bothHalves(morningName, afternoonName)
            morningName != null -> morningName
            else -> "Non renseigné"
        }
    }

    // AN-GRANULARITY (R519): who recorded the day - the morning's and the afternoon's when the two halves were recorded
    // differently (« matin détection confirmée, après-midi saisie manuelle »), one word otherwise. Null when unknown.
    private fun provenanceClause(
        provenanceName: String?,
        secondProvenanceName: String?,
    ): String? {
        val first = provenanceName?.let { provenanceInSentence(it) }
        val second = secondProvenanceName?.let { provenanceInSentence(it) }
        return if (first != null && second != null) bothHalves(first, second) else first
    }

    // ONE HOME for naming the two halves inside the announcement (R206): the split kinds (R292) and, since R519, the
    // split provenance read « matin …, après-midi … » the same way.
    private fun bothHalves(
        morning: String,
        afternoon: String,
    ): String = "matin $morning, après-midi $afternoon"

    // AN-CAL2: the a11y word for a selected cell, read first so TalkBack announces selection without relying on
    // colour (section 2). Its home is here - the announcement is its only use - the DayCellCopy word pattern.
    private const val SELECTED = "Sélectionné"
}
