package ch.monreleve.app.fr

import ch.monreleve.app.fr.text.formatDate

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
//
// IOS-MOVE-REMINDER (R1291, R206: one text, one home). MOVED WHOLE from :app to :shared commonMain, same package, no
// line of copy changed: the iOS evening reminder (iosMain ios/IosEveningReminders.kt) says what Android's manual
// reminder says - MANUAL_TITLE over formatDayLong(day) - from this file, so the text has one home on both platforms.
// Every import was already common. MovedTwinsFenceTest refuses a copy of it in :app or iosMain.

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

    // AN-ALERT. The threshold alert's own channel, so it can be silenced apart from the evening reminder.
    const val ALERT_CHANNEL_NAME = "Seuils"

    const val ALERT_CHANNEL_DESCRIPTION =
        "Une alerte lorsque votre rythme prévu dépasserait un seuil fiscal ou social."

    /**
     * AN-ALERT. The private (unlocked) alert title, by threshold. Keyed by the AlertThreshold name (FISCAL /
     * SOCIAL) the same way autoProposalTitle is keyed by the EntryKind name, so fr/ carries no runtime import.
     * The conditional « dépasserait » frames it as a projection, not a record (R340 / « never claim more than
     * the record supports »). The figure is NOT typed - the notification states the seuil by name, not its value.
     */
    fun alertTitle(thresholdName: String): String =
        if (thresholdName == "FISCAL") {
            "Votre rythme prévu dépasserait le seuil d’imposition"
        } else {
            "Votre rythme prévu dépasserait le seuil de sécurité sociale"
        }

    // AN-ALERT. The alert's second line (unlocked): that it is a projection, and that a tap opens the forecast.
    const val ALERT_PROJECTION_NOTE = "C’est une projection de fin d’année : touchez pour voir votre prévision."

    /**
     * AN-ALERT (R323). The LOCK-SCREEN (public) alert lines: only that there is information about the year -
     * NO figure, NO threshold named (nothing private). The title is the product name (Fr.APP_NAME, R206).
     */
    fun alertPublicLines(): NotificationLines = NotificationLines(Fr.APP_NAME, "Une information sur votre année.")

    // CH -> « En Suisse », HOME -> « Domicile » (AujourdhuiCopy, R206). A proposal is only ever CH or HOME.
    private fun sideLabel(kindName: String): String =
        when (kindName) {
            "CH" -> AujourdhuiCopy.SUISSE
            else -> AujourdhuiCopy.DOMICILE
        }
}
