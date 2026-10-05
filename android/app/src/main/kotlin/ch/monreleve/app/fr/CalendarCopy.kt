package ch.monreleve.app.fr

// AN10 (SPEC 11.3, FD6). Every French word the calendar screen renders - the ui/ fence forbids a
// literal in the screen, so all copy is here (R155: fully accented). The month header ("Juin 2026")
// and the sheet's day title are NOT here: they are locale-derived names built by fr/format/Dates.kt,
// not fixed strings. The four kind names (Suisse/Domicile/Mission) are NOT here either: their one home
// is LegendCopy (R206), and the summary reads them from it, so the summary label and the legend key
// cannot drift apart.

object CalendarCopy {
    /** FD6: the French week starts on Monday - L(undi) M(ardi) M(ercredi) J(eudi) V(endredi) S(amedi) D(imanche). */
    val WEEKDAY_HEADERS = listOf("L", "M", "M", "J", "V", "S", "D")

    /** Chevron a11y labels (FD6 month navigation). */
    const val PREVIOUS_MONTH = "Mois précédent"
    const val NEXT_MONTH = "Mois suivant"

    /**
     * The one home for "unrecorded": the month summary's fourth count (FD6 section 4) AND the quality
     * legend's grey bar (FD6 section 3), which are the same concept and must not become two strings.
     */
    const val NON_RENSEIGNE = "Non renseigné"

    // The edit sheet (FD6 A2). The kind chooser reuses AujourdhuiCopy (one record vocabulary across the
    // two surfaces); only the sheet's own chrome lives here.
    const val SHEET_QUESTION = "Où avez-vous travaillé ?"
    const val SHEET_NOTE_LABEL = "Note (facultatif)"
    const val SHEET_SAVE = "Enregistrer"
    const val SHEET_CANCEL = "Annuler"

    // The record made visible in words (AC2, not by colour alone). The quality legend names the three
    // bar colours; NON_RENSEIGNE above is the grey bar's word.
    const val QUALITY_ON_TIME = "À temps"
    const val QUALITY_LATE = "Saisie tardive"

    /**
     * A recorded day's quality as one word, for the high-scale list (R271, AC3): the same words the
     * legend names, plus a pending one; NONE (weekend, future, out of period) has no quality to state.
     * The three named colours reference their one home; the pending word is inline (no const, so no
     * second scanned home for it).
     */
    fun qualityWord(qualityName: String): String? =
        when (qualityName) {
            "ON_TIME" -> QUALITY_ON_TIME
            "LATE" -> QUALITY_LATE
            "PENDING" -> "En attente de synchronisation"
            "MISSING" -> NON_RENSEIGNE
            else -> null
        }

    // The sheet's provenance block (SPEC 11.3, FD6 A2): who recorded it, when it was first recorded, and
    // when it was changed. « Saisie manuelle » is not held here - it has one home already, AujourdhuiCopy
    // .MODE_MANUAL (R206), and the sheet references it. The timestamps are interpolated from the SERVER's
    // own values (R216/R181).
    const val PROVENANCE_HEADING = "Origine de la saisie"

    fun firstRecordedLine(timestamp: String): String = "Première saisie enregistrée le $timestamp"

    fun modifiedLine(timestamp: String): String = "Modifiée le $timestamp"

    // The late notice (SPEC 11.3: backfilling beyond the threshold is flagged, and the sheet says out
    // loud that the flag appears in the annual document). Two phrasings, R216-split: a synced day states
    // the FACT; a still-unrecorded backdated day PREDICTS. The threshold is interpolated, never a typed 7
    // (R153/R181) - the caller passes LatenessForecast.BACKFILL_DAYS, carried through the state.
    fun lateNotice(thresholdDays: Int): String =
        "Saisie tardive : enregistrée plus de $thresholdDays jours après la journée. " +
            "Cette mention figure dans votre relevé annuel."

    fun lateForecast(thresholdDays: Int): String =
        "Enregistrée plus de $thresholdDays jours après la journée : sera signalée comme saisie tardive " +
            "dès sa synchronisation, et figurera alors dans votre relevé annuel."

    // AN-CAL2 (section 2-3). Recording several days at once: the entry point, the action panel, the one
    // confirmation (D16) and the « à compléter » card. The kind choices reuse AujourdhuiCopy (one record
    // vocabulary, R206); only this flow's own chrome lives here.

    /** The explicit entry point into selection, and the long-press hint (section 2). */
    const val SELECT_MULTIPLE = "Sélectionner plusieurs jours"

    /** The action panel / live-region count. */
    fun selectedCount(count: Int): String = if (count == 1) "1 jour sélectionné" else "$count jours sélectionnés"

    /** The « à compléter » card (section 3): unrecorded past working days of the month; hidden when none. */
    fun daysToComplete(
        count: Int,
        monthName: String,
    ): String =
        if (count == 1) {
            "1 jour à compléter en $monthName"
        } else {
            "$count jours à compléter en $monthName"
        }

    // The one confirmation before a bulk write (section 2, D16). It states the choice and the count, lists the
    // days, and shows the two conditional lines exactly when they apply (C4). The confirm button reuses
    // SHEET_SAVE (« Enregistrer » - the action IS a save, R206), the dismiss SHEET_CANCEL (« Annuler »).
    const val CONFIRM_HEADING = "Confirmer l'enregistrement"

    fun bulkSummary(
        count: Int,
        kindLabel: String,
    ): String =
        if (count == 1) {
            "1 jour sera enregistré comme « $kindLabel »."
        } else {
            "$count jours seront enregistrés comme « $kindLabel »."
        }

    /** « déjà renseignés » line: shown only when some chosen days already hold a value (C4). */
    fun alreadyRecordedNotice(count: Int): String =
        if (count == 1) {
            "1 jour déjà renseigné sera modifié."
        } else {
            "$count jours déjà renseignés seront modifiés."
        }

    /** « saisie tardive » line: shown only when some chosen days are older than the threshold (R286, C4). */
    fun bulkLateNotice(
        count: Int,
        thresholdDays: Int,
    ): String =
        if (count == 1) {
            "1 jour, enregistré plus de $thresholdDays jours après la journée, " +
                "sera marqué « saisie tardive » dans votre relevé annuel."
        } else {
            "$count jours, enregistrés plus de $thresholdDays jours après la journée, " +
                "seront marqués « saisie tardive » dans votre relevé annuel."
        }
}
