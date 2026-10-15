package ch.monreleve.app.fr

// AN-FORECAST. The year-end forecast screen's copy, word for word from design/decide/Prevision.dc.html.
// Fully accented (R155), typographic apostrophes U+2019 (R126). Every public member is referenced from
// ui/screens/prevision (R238).
//
// R153/R181 - NAME THE RULE, DO NOT TYPE ITS VALUE. The thresholds ("40 %", "49,9 %") are never typed:
// the tile and legend helpers take an already-formatted percentage (formatPercent of the RuleSet ceiling),
// and the method line takes the engine's own totalWorkDays. domicilePhrase and method are PUBLIC and called
// from the screen (so the reachability census sees them and PrevisionCopyTest can assert their output,
// R154), with their results handed to assumptions - never a figure transcribed beside the thing it describes.

object PrevisionCopy {
    /** The top-bar section name, shown on both the rhythm and the forecast screen (R206, one home). */
    const val NAV_TITLE = "Prévision"

    /** R340: the whole screen is a projection, labelled as one, visibly set apart from a recorded figure. */
    const val PROJECTION_BADGE = "Projection"

    const val TITLE = "Si vous gardez ce rythme"

    const val TODAY_LABEL = "Aujourd’hui, votre relevé"
    const val PROJECTION_LABEL = "Fin décembre, projection"

    const val LEGEND_RECORDED = "enregistré"
    const val LEGEND_PROJECTED = "projeté"

    /** The fiscal tile's ordinary label; [threshold] is an already-formatted percentage (R181). */
    fun daysMarginBeforeFiscal(threshold: String): String = "jours de marge avant $threshold"

    /** The social tile's ordinary label. */
    fun daysBeforeSocial(threshold: String): String = "jours avant $threshold"

    /** Either tile's label when the projection is OVER that ceiling (SPEC 7.2 step 6: a different sentence). */
    fun daysOver(threshold: String): String = "jours au-dessus de $threshold"

    /**
     * The hypotheses line. [rhythm] is [domicilePhrase]'s output, [method] is [method]'s - both built in the
     * screen and passed in, so no figure is transcribed here. [workingDays] is the engine's imagined-day count.
     */
    fun assumptions(
        rhythm: String,
        workingDays: Int,
        method: String,
    ): String =
        "Hypothèses : $rhythm, $workingDays jours ouvrés jusqu’au 31 décembre, $method. " +
            "Les congés à venir ne sont pas déduits : la projection prévient un peu tôt, jamais trop tard."

    /** "domicile le mardi et le jeudi" from the weekdays set to Domicile (Monday = 0 .. Friday = 4). */
    fun domicilePhrase(domicileDays: List<Int>): String {
        if (domicileDays.isEmpty()) return "aucun jour à domicile"
        val names = domicileDays.sorted().mapNotNull { LOWER_DAYS.getOrNull(it) }.map { "le $it" }
        val joined =
            if (names.size == 1) {
                names[0]
            } else {
                names.dropLast(1).joinToString(", ") + " et " + names.last()
            }
        return "domicile $joined"
    }

    /** "méthode simplifiée (240 jours)" / "méthode réelle (N jours)"; the count is the engine's own (R181). */
    fun method(
        denominatorKind: String,
        totalWorkDays: Int,
    ): String =
        if (denominatorKind == "SIMPLIFIED240") {
            "méthode simplifiée ($totalWorkDays jours)"
        } else {
            "méthode réelle ($totalWorkDays jours)"
        }

    /** Section 2: past weekdays left unrecorded, stated in words, shown only when there are any. */
    fun unrecordedPast(count: Int): String =
        if (count >= 2) {
            "$count journées ouvrées passées ne sont pas encore enregistrées ; " +
                "elles ne figurent pas dans cette projection."
        } else {
            "$count journée ouvrée passée n’est pas encore enregistrée ; " +
                "elle ne figure pas dans cette projection."
        }

    const val R340_NOTE = "Une projection ne figure jamais dans votre relevé."

    /** AN-SIM: the live entry point to the simulator (R85 - omitted while the simulator did not exist). */
    const val TEST_CHANGE = "Tester un changement"

    const val MODIFY_RHYTHM = "Modifier mon rythme"

    const val INVITE_BODY = "Indiquez votre rythme habituel pour voir votre projection de fin d’année."
    const val INVITE_CTA = "Indiquer mon rythme"

    /** AN-ALERT: the contextual opt-in offer, shown on the forecast while the alert is off. Tapping enables it. */
    const val ALERT_OFFER = "Me prévenir si mon rythme approche d’un seuil"

    /** Monday = 0 .. Friday = 4. Private, so the reachability census does not require a surface reference. */
    private val LOWER_DAYS = listOf("lundi", "mardi", "mercredi", "jeudi", "vendredi")
}
