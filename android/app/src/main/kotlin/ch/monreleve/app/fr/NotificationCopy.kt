package ch.monreleve.app.fr

import ch.monreleve.app.fr.format.formatDate

// R323 / PARKAN-36, extended by AN-NOTIF (R339). The evening notification's copy. Fully accented (R155),
// typographic apostrophes and ellipsis (R126 / U+2019, U+2026). Rendered by the background notifier
// (detection/EveningNotifier, a Context/NotificationManager concern the ui/ fence keeps out of ui/) and the
// recording receiver (notification/EveningActionReceiver), so the reachability census reaches it from there
// rather than a fr-surface directory - allowlisted in CopyReachabilityTest with that reason, the
// ReleveCopy.EXPORT_* / Toast pattern.
//
// R339: A NOTIFICATION BUTTON MAY RECORD THE DAY (supersedes one line of R323). So the notification now ASKS and
// OFFERS: the manual title « Où avez-vous travaillé aujourd'hui ? » with the two side buttons, or the automatic
// « Proposition : <côté> - vérifiez » with Confirmer and the other side. Once a button is tapped the notification
// becomes a confirmation « <côté> / Enregistré pour le <date> » - the PHONE's record, never « envoyé » (the sync
// state stays the app's business, as on Aujourd'hui). D16 holds: a clearly labelled button IS the person's tap.
//
// ONE HOME PER STRING (R206). « Confirmer » lives in DetectionCopy.CONFIRM and « Modifier » in
// AujourdhuiCopy.MODIFIER; the side labels « En Suisse »/« Domicile » in AujourdhuiCopy; the not-sure message in
// DetectionCopy.NOT_SURE - the notifier references those homes directly rather than copying them here, so the
// duplication guard (R206) stays green.
//
// TWO VISIBILITIES (SPEC 13.3 / the AN-NOTIF prompt). The LOCK SCREEN (public) reveals only that a day is to
// record - never where someone was, and NO recording buttons (D18 extends to the lock screen; the unlock gate is
// setAuthenticationRequired on the actions themselves, API 31+). The UNLOCKED (private) notification may name the
// detected side and carry the buttons.

/** A notification's two lines. */
data class NotificationLines(
    val title: String,
    val text: String,
)

object NotificationCopy {
    /** The channel name the person sees in system settings (AN-NOTIF: « Rappel du soir »). */
    const val CHANNEL_NAME = "Rappel du soir"

    /** The channel description in system settings - what it is and when it fires. */
    const val CHANNEL_DESCRIPTION = "Un rappel le soir, quand une journée reste à enregistrer."

    /** The manual-mode title: the one question, asked in the evening (past tense - the day is over). */
    const val MANUAL_TITLE = "Où avez-vous travaillé aujourd’hui ?"

    /** The button that opens the app on today for a mission, an absence or a split half-day. */
    const val AUTRE = "Autre…"

    /**
     * The automatic HIGH-proposal title: « Proposition : Domicile - vérifiez ». The side is the detected kind
     * (CH/HOME); the buttons (Confirmer / the other side) carry the verbs.
     */
    fun autoProposalTitle(kindName: String): String = "Proposition : ${sideLabel(kindName)} - vérifiez"

    /**
     * After a tap, the notification becomes this confirmation: the side, then « Enregistré pour le <date> ». It
     * says « Enregistré » (the phone's record, as on Aujourd'hui), never « envoyé » - the sync state is the app's
     * business. The date is the Swiss-dotted day (SPEC 6.4), from the shared formatter (R206).
     */
    fun confirmation(
        kindName: String,
        dayDate: String,
    ): NotificationLines = NotificationLines(sideLabel(kindName), "Enregistré pour le ${formatDate(dayDate)}")

    /**
     * The LOCK-SCREEN (public) lines: that a day is to record, and nothing about where (D18). The title is the
     * product name (R206: Fr.APP_NAME), so a glance at a locked phone shows only « Mon Relevé ».
     */
    fun publicLines(): NotificationLines = NotificationLines(Fr.APP_NAME, "Une journée à enregistrer.")

    /**
     * The UNLOCKED (private) lines for a day that cannot be proposed with confidence (R312): the manual question
     * and the not-sure explanation, shown with the manual buttons. A HIGH proposal uses autoProposalTitle instead;
     * manual mode uses MANUAL_TITLE with the date in words. `kindName` null means the not-sure invitation.
     */
    fun privateLines(kindName: String?): NotificationLines =
        if (kindName == null) {
            NotificationLines(MANUAL_TITLE, DetectionCopy.NOT_SURE)
        } else {
            NotificationLines("Journée détectée : ${sideLabel(kindName)}", "Confirmez ou corrigez votre journée.")
        }

    // CH -> « En Suisse », HOME -> « Domicile » (AujourdhuiCopy, R206). A proposal is only ever CH or HOME.
    private fun sideLabel(kindName: String): String =
        when (kindName) {
            "CH" -> AujourdhuiCopy.SUISSE
            else -> AujourdhuiCopy.DOMICILE
        }
}
