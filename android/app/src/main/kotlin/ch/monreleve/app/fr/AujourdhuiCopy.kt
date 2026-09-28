package ch.monreleve.app.fr

// AN5b increment 3. The Aujourd'hui recording screen (SPEC 11.2). Fully accented (R155), typographic
// apostrophes (R126 / U+2019). Reachable from ui/screens/aujourdhui/AujourdhuiScreen.kt (R238).
//
// R282 - THE MODE STRIP NAMES THE CURRENT MODE, WITHOUT A CHANGER LINK. SPEC 11.2 wants the person to
// always see which mode records their days; a "Changer" link would point at a mode chooser this build
// does not have, so it is omitted. "Saisie manuelle" is a plain label, not a diminished option
// (DESIGN-SYSTEM section 2). Nothing here says "mode automatique" or invites a switch.
//
// COPY MAPPED BY NAME, NOT BY ENUM (the DayCellCopy pattern). recordedLabel/absenceLabel take the
// enum's `.name` string so fr/ needs no import of the UI vocabulary, and their internal values are
// private literals rather than constants - so the reachability census (R238) checks the two public
// functions the screen calls, not every internal fragment, and the duplication guard (R206) does not
// trip on "En Suisse" appearing both as a button label and as a recorded label.
//
// NO "bravo", NO success word (DESIGN-SYSTEM section 2): the confirmation is the day's state changing.

object AujourdhuiCopy {
    const val MODE_MANUAL = "Saisie manuelle"
    const val QUESTION = "Où travaillez-vous aujourd’hui ?"

    const val SUISSE = "En Suisse"
    const val DOMICILE = "Domicile"
    const val MISSION = "Mission"
    const val MISSION_FRANCE = "En France"
    const val MISSION_THIRD = "Pays tiers"

    const val ABSENCE = "Déclarer une absence"

    const val MORNING = "Matin"
    const val AFTERNOON = "Après-midi"

    const val PENDING = "En attente de synchronisation"

    // R198: a client-built payload the server refused is held, not retried forever - and the person is
    // TOLD, because a silently-failed sync is a day they believe is recorded and is not.
    const val SYNC_FAILED = "Enregistrement refusé par le serveur. Corrigez la journée et réessayez."
    const val EDIT_HINT = "Touchez une réponse pour corriger la journée."

    // AC3 - the year panel never overclaims. An empty year says so rather than showing 0 %; a rate
    // that includes unsynced days says so; a partial year names that it covers the activity period.
    const val EMPTY_YEAR = "Aucune journée enregistrée cette année pour le moment."
    const val PARTIAL_YEAR = "Ce taux couvre votre période d’activité, pas l’année entière."

    /**
     * The pending line (R286). It names the unsynced count and ESCALATES as the oldest unsynced day
     * nears the late-saisie threshold - APPROACHING, then OVERDUE - before the threshold is crossed.
     * R216: it PREDICTS to warn ("sera signalee ... des sa synchronisation"); the dossier's flag is the
     * server's. R153/R181: the threshold is interpolated from the shared source (thresholdDays), never
     * typed. latenessName is the PendingLateness `.name` (the DayCellCopy pattern), so fr/ needs no
     * import of the controller's enum. The base count line is private, reached only through this entry.
     */
    fun pendingNote(
        unsyncedDays: Int,
        latenessName: String,
        thresholdDays: Int,
    ): String =
        when (latenessName) {
            "APPROACHING" ->
                "${unsyncedNote(unsyncedDays)} ; la plus ancienne approche du seuil de saisie tardive " +
                    "($thresholdDays jours) : reconnectez-vous pour les synchroniser."
            "OVERDUE" ->
                "${unsyncedNote(unsyncedDays)} ; la plus ancienne dépasse $thresholdDays jours et sera " +
                    "signalée comme saisie tardive dès sa synchronisation."
            else -> unsyncedNote(unsyncedDays)
        }

    /** "dont 3 jours pas encore synchronisés" - the count is a runtime figure, not a regulatory one (R153). */
    private fun unsyncedNote(days: Int): String {
        val plural = if (days > 1) "s" else ""
        return "dont $days jour$plural pas encore synchronisé$plural"
    }

    /** Named when the engine used another year's barème (R11 / RULE_SET_FALLBACK). */
    fun fallbackNote(year: Int): String = "Barème $year appliqué (année en cours non encore publiée)."

    private const val RECORDED_PREFIX = "Enregistré :"

    /** The French label for an AbsenceChoice, by its `.name`. Serves the reason buttons and the recorded row. */
    fun absenceLabel(choiceName: String): String =
        when (choiceName) {
            "CONGE" -> "Congé"
            "MALADIE" -> "Maladie"
            "FERIE" -> "Jour férié"
            "AUTRE" -> "Autre"
            else -> choiceName
        }

    /** "Enregistré : En Suisse" - the recorded-state line, from a RecordedKind's `.name` and an optional reason. */
    fun recordedLabel(
        kindName: String,
        absenceName: String?,
    ): String {
        val kind =
            when (kindName) {
                "SUISSE" -> SUISSE
                "DOMICILE" -> DOMICILE
                "MISSION_FRANCE" -> "Mission (France)"
                "MISSION_THIRD" -> "Mission (pays tiers)"
                "ABSENCE" -> if (absenceName == null) "Absence" else "Absence — ${absenceLabel(absenceName)}"
                else -> kindName
            }
        return "$RECORDED_PREFIX $kind"
    }
}
