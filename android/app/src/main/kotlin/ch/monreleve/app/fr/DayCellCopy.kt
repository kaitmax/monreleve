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
            "MISSING" to "non enregistré",
            "NONE" to "sans objet",
        )

    fun contentDescription(
        dayOfMonth: Int,
        kindLetter: String?,
        qualityName: String,
        corrected: Boolean,
    ): String {
        val kind = kindLetter?.let { KIND_NAMES[it] } ?: "Non renseigné"
        val quality = QUALITY_NAMES[qualityName] ?: qualityName
        val correction = if (corrected) ", corrigé" else ""

        return "Jour $dayOfMonth, $kind, $quality$correction."
    }
}
