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
    const val EDIT_HINT = "Touchez une réponse pour corriger la journée."

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
