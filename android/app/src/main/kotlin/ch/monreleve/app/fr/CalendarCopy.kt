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
}
