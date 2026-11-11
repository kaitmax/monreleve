package ch.monreleve.app.fr

import ch.monreleve.app.fr.text.formatDays
import ch.monreleve.app.fr.text.formatPoints

// AN-RECON (the comparison). All copy for « Votre employeur a-t-il le même chiffre ? », word for word from
// design/decide/Employeur.dc.html, fully accented. THE VOCABULARY BAN HOLDS: no certifié / attesté / conforme /
// valide / approuvé - the relevé shows, day by day, what was recorded and when; it does not say who is right.
// The figures are SAMPLE DATA in the design; here every figure comes from the server's dossier or the person's
// typed attestation. Numbers are interpolated through the format helpers (the gap's points and days), never typed.
object ComparisonCopy {
    const val NAV_TITLE = "Comparaison"
    const val TITLE = "Votre employeur a-t-il le même chiffre ?"
    const val LEAD =
        "En janvier, votre employeur transmet votre taux de télétravail de l’année. Saisissez celui de " +
            "votre attestation pour le comparer à votre relevé."

    /** The attestation field's label, naming the year the figure is for. */
    fun employerRateLabel(year: Int): String = "Taux indiqué par votre employeur pour $year"

    const val RELEVE_LABEL = "Votre relevé"
    const val EMPLOYER_LABEL = "Votre employeur"

    // The gap sentence, split so the figure can be emphasised (the design bolds « Écart : N points »); the tail
    // stays regular. Both numbers come from the engine's ComparisonGap, formatted here, never typed.
    fun gapHeadline(points: Double): String = "Écart : ${formatPoints(points)} ${plural(points, "point", "points")}"

    fun gapTail(environDays: Double): String {
        return ", soit environ ${formatDays(environDays)} ${plural(environDays, "jour", "jours")}."
    }

    const val CAUSES_HEADING = "D’où peut venir l’écart ?"

    const val CAUSE_MISSIONS_TITLE = "Les missions"

    /** « N jours dans votre relevé, tous comptés : la limite est de C. » - the counted figure is the server's. */
    fun missionsBody(
        missionDays: Double,
        creditedDays: Double,
        cap: Int,
    ): String {
        val logged = "${formatDays(missionDays)} ${plural(missionDays, "jour", "jours")} dans votre relevé"
        val counted =
            if (creditedDays >= missionDays) {
                if (missionDays >= 2.0) "tous comptés" else "compté"
            } else {
                "${formatDays(creditedDays)} ${plural(creditedDays, "compté", "comptés")}"
            }
        return "$logged, $counted : la limite est de $cap."
    }

    const val CAUSE_METHOD_TITLE = "La méthode de calcul"

    fun methodBody(
        denominatorKind: String,
        simplifiedBasisDays: Int,
    ): String =
        if (denominatorKind == "EXACT") {
            "Votre relevé utilise les jours ouvrés communiqués par votre employeur."
        } else {
            "Votre relevé utilise la méthode simplifiée, $simplifiedBasisDays jours."
        }

    const val CAUSE_UNRECORDED_TITLE = "Des journées non renseignées"

    fun unrecordedBody(count: Int): String {
        val word = if (count > 1) "jours ouvrés" else "jour ouvré"
        return "$count $word sans saisie dans votre relevé."
    }

    // From the verified AFC Genève row (REG-UPDATE source C): general context, not a count from the record.
    const val CAUSE_SEVERAL_TITLE = "Plusieurs employeurs"
    const val CAUSE_SEVERAL_BODY =
        "Avec plusieurs employeurs, chacun déclare le taux correspondant à ses propres jours."

    const val INFO_NOT_WHO_IS_RIGHT =
        "Votre relevé ne dit pas qui a raison : il montre, jour par jour, ce qui a été enregistré et quand."

    const val VIEW_DAYS = "Voir mes journées jour par jour"

    // The current year has no attestation yet - the comparison is for a completed year, refused with an explanation.
    fun currentYearRefusal(year: Int): String =
        "La comparaison porte sur une année terminée. L’attestation de $year n’existe pas encore ; votre " +
            "employeur la transmettra en janvier ${year + 1}."

    private fun plural(
        value: Double,
        singular: String,
        plural: String,
    ): String = if (value >= 2.0) plural else singular
}
