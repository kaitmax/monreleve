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

    // AN-HOME section 1 - the answer line's sync truth, persistent and never a toast (DESIGN-SYSTEM section 2):
    // PENDING until the server has the day, then SYNCED. "Enregistré" alone means the server holds it; the
    // pending form says plainly it is only on the phone so far. (RecorderCopy.STATE_PENDING shares PENDING,
    // R206.)
    const val PENDING = "Enregistré sur le téléphone, en attente d’envoi"
    const val SYNCED = "Enregistré"

    // AN-HOME section 1 - the choice closes into the answer line; « Modifier » (a word, not a pencil, so
    // TalkBack reads it) reopens the options with the current choice marked, « Annuler » closes them again
    // without writing anything. CANCEL references the one home for « Annuler » (CalendarCopy.SHEET_CANCEL,
    // which had it first) rather than a second literal - R206, the CopyDuplicationTest guard.
    const val MODIFIER = "Modifier"
    const val CANCEL = CalendarCopy.SHEET_CANCEL

    // R198: a client-built payload the server refused is held, not retried forever - and the person is
    // TOLD, because a silently-failed sync is a day they believe is recorded and is not.
    const val SYNC_FAILED = "Enregistrement refusé par le serveur. Corrigez la journée et réessayez."

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

    /** The French label for an AbsenceChoice, by its `.name`. Serves the reason buttons and the answer line. */
    fun absenceLabel(choiceName: String): String =
        when (choiceName) {
            "CONGE" -> "Congé"
            "MALADIE" -> "Maladie"
            "FERIE" -> "Jour férié"
            "AUTRE" -> "Autre"
            else -> choiceName
        }

    /**
     * "En Suisse" / "Absence — Congé" - the recorded KIND alone (no « Enregistré : » prefix; the sync status
     * line carries « Enregistré »), from a RecordedKind's `.name` and an optional reason. AN-HOME: this is the
     * answer the choice closes into. Mapped by name (the DayCellCopy pattern) so fr/ imports no UI vocabulary.
     */
    fun kindLabel(
        kindName: String,
        absenceName: String?,
    ): String =
        when (kindName) {
            "SUISSE" -> SUISSE
            "DOMICILE" -> DOMICILE
            "MISSION_FRANCE" -> "Mission (France)"
            "MISSION_THIRD" -> "Mission (pays tiers)"
            "ABSENCE" -> if (absenceName == null) "Absence" else "Absence — ${absenceLabel(absenceName)}"
            else -> kindName
        }

    /**
     * The half-day answer line showing BOTH halves - « Matin : Domicile — Après-midi : En Suisse » (R292: a
     * single label would misstate a split day). Each half is already a kindLabel; this only joins them.
     */
    fun answerHalfDay(
        morningLabel: String,
        afternoonLabel: String,
    ): String = "$MORNING : $morningLabel — $AFTERNOON : $afternoonLabel"

    // AN-HOME section C « À traiter » (R328): the action card, shown ONLY when there is something to act on
    // (never an empty box). The lines are action-framed and derive from the SAME state the year panel's
    // rate-honesty note derives from (YearPanel.unsyncedDays / .pendingLateness, one source, R181) - not a
    // second copy of that sentence. Counts are runtime figures (R153); the late threshold is interpolated
    // from the shared source (R153/R181), never typed.
    const val ATTEND_HEADING = "À traiter"
    const val ATTEND_SEE_CALENDAR = "Voir le calendrier"

    /** « 3 jours non renseignés ce mois » - past working days this month with no entry (C's primary item). */
    fun attendUnrecorded(days: Int): String {
        val plural = if (days > 1) "s" else ""
        return "$days jour$plural non renseigné$plural ce mois"
    }

    /**
     * « 3 journées en attente d'envoi » - recorded days not yet sent (C). ESCALATES as the oldest nears the
     * late-saisie threshold (R286): APPROACHING warns, OVERDUE says the threshold is passed. The threshold is
     * interpolated (R153); latenessName is the PendingLateness `.name` (the DayCellCopy pattern), so fr/ needs
     * no import of the controller's enum.
     */
    fun attendUnsent(
        unsentDays: Int,
        latenessName: String,
        thresholdDays: Int,
    ): String {
        val plural = if (unsentDays > 1) "s" else ""
        val base = "$unsentDays journée$plural en attente d’envoi"
        return when (latenessName) {
            "APPROACHING" -> "$base : reconnectez-vous avant le seuil de saisie tardive ($thresholdDays jours)."
            "OVERDUE" -> "$base : le seuil de saisie tardive ($thresholdDays jours) est dépassé, reconnectez-vous."
            else -> "$base."
        }
    }

    // AN-HOME section E « Cette semaine » (R328): the Monday-Friday week strip's heading. The weekday letters,
    // the kind legend words and the quality words are NOT held here - their one homes are CalendarCopy and
    // LegendCopy (R206), and this section reads them, so the home and the calendar cannot drift apart.
    const val WEEK_HEADING = "Cette semaine"

    // AN-HOME section F « Ce mois » (R328): the recorded-days-by-kind heading. The four kind labels read from
    // LegendCopy (R206, the same home the calendar's month tiles use), so « Ce mois » and the calendar name
    // the kinds identically.
    const val MONTH_HEADING = "Ce mois"
}
