package ch.monreleve.app.fr

// AN3 increment 4. Kotlin port of web/lib/fr/rates.ts. The words around
// the two rates (SPEC 9.3, "the two-rate problem").
//
// NO THRESHOLD NUMBERS, same rule as StatusCopy.kt: the mission cap comes
// from the year's RuleSet, never written into copy as "10 jours".
//
// VOCABULARY: declare, enregistre, horodate - never certifie, atteste or
// conforme.

object RatesCopy {
    /** SPEC 9.3: names the authority the figure is declared to, not the arithmetic. */
    const val DECLARABLE_CAPTION = "Taux à déclarer à l’AFC"

    /** Deliberately NOT "taux réel"/"taux brut": both imply the declarable rate is less true. */
    const val RAW_CAPTION = "Part de jours hors de Suisse"

    /** Shown only when the two rates diverge - the case that would otherwise read as an error. */
    const val DIVERGENCE =
        "Les jours de mission qui dépassent le plafond annuel sortent du régime " +
            "de télétravail et sont imposés en France."
}
