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
    // icon alone." Carried in the announcement. In the manual product every entry reads "saisie
    // manuelle"; the detected forms exist for AN9+ so the cell announces them without a later change.
    private val PROVENANCE_NAMES =
        mapOf(
            "MANUAL" to "saisie manuelle",
            "DETECTED_CONFIRMED" to "détection confirmée",
            "DETECTED_CORRECTED" to "détection corrigée",
        )

    // Long by design: the announcement names each facet the cell renders (day, kind, quality,
    // correction, today, provenance), mirroring DayCell's own deliberately-separate axes (SPEC 966).
    @Suppress("LongParameterList")
    fun contentDescription(
        dayOfMonth: Int,
        kindLetter: String?,
        qualityName: String,
        corrected: Boolean,
        isToday: Boolean = false,
        provenanceName: String? = null,
    ): String {
        val kind = kindLetter?.let { KIND_NAMES[it] } ?: "Non renseigné"
        val quality = QUALITY_NAMES[qualityName] ?: qualityName
        val today = if (isToday) "Aujourd’hui, " else ""
        val provenance = provenanceName?.let { PROVENANCE_NAMES[it] }?.let { ", $it" } ?: ""
        // "corrigé" already reads from DETECTED_CORRECTED provenance where both are set; keep the
        // explicit correction clause only when provenance is absent, so the phrase is not doubled.
        val correction = if (corrected && provenanceName == null) ", corrigé" else ""

        return "${today}Jour $dayOfMonth, $kind, $quality$provenance$correction."
    }
}
