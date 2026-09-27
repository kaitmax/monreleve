package ch.monreleve.app.fr

// AN3 increment 4. The calendar legend's four words, matching
// DayCellCopy.kt's own KIND_NAMES exactly (DESIGN-SYSTEM.md's own table:
// "Suisse", "Domicile", "Mission", "Absence").

object LegendCopy {
    private val NAMES =
        mapOf(
            "S" to "Suisse",
            "D" to "Domicile",
            "M" to "Mission",
            "A" to "Absence",
        )

    fun forKind(letter: String): String = NAMES[letter] ?: error("no legend entry for kind letter '$letter'")
}
