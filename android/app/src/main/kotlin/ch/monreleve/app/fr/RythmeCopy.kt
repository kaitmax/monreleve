package ch.monreleve.app.fr

// AN-FORECAST. The weekly-rhythm screen's copy, word for word from design/decide/Rythme.dc.html. Fully
// accented (R155), typographic apostrophes U+2019 (R126). Every member is referenced from
// ui/screens/rythme (R238). "Domicile" has one home already - AujourdhuiCopy.DOMICILE - so it is aliased,
// not retyped (R206 / the duplication fence); "Suisse" here is the toggle's short form, distinct from
// AujourdhuiCopy.SUISSE ("En Suisse").

object RythmeCopy {
    /** The screen title, and the Parametres row that opens it - one home, referenced from both (R206). */
    const val TITLE = "Votre rythme habituel"

    const val SUBTITLE =
        "Indiquez où vous travaillez d’habitude. Ce rythme sert uniquement à vos projections : " +
            "rien n’est enregistré dans votre relevé."

    /** Monday..Friday legends, indexed by DayOfWeek.ordinal (MONDAY = 0). */
    val DAYS = listOf("Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi")

    // "Suisse" and "Domicile" - one home each already (R206); aliased, never retyped. AujourdhuiCopy.SUISSE is
    // the record surface's longer "En Suisse", so the toggle's short form reuses ReleveCopy.KIND_SWISS.
    const val SUISSE = ReleveCopy.KIND_SWISS
    const val DOMICILE = AujourdhuiCopy.DOMICILE

    /** The helper line: how many days a week the rhythm puts at home. The count is the rhythm's own. */
    fun weeklyDomicile(count: Int): String {
        val days = if (count >= 2) "jours" else "jour"
        return "Soit $count $days par semaine à domicile. Vous pourrez le changer à tout moment."
    }

    const val VIEW_FORECAST = "Voir ma prévision"
}
