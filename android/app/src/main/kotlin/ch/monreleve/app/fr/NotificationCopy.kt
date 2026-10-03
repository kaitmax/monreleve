package ch.monreleve.app.fr

// R323 / PARKAN-36. The evening proposal notification's copy. Fully accented (R155). Rendered by the background
// notifier (EveningNotifier, a Context/NotificationManager concern the ui/ fence keeps out of ui/), so the
// reachability census reaches it from there rather than a fr-surface directory - allowlisted in
// CopyReachabilityTest with that reason, the ReleveCopy.EXPORT_* / Toast pattern.
//
// TWO VISIBILITIES (SPEC 13.3 / the AN-NEXT prompt). The LOCK SCREEN (public) reveals only that a proposal is
// waiting - never where someone was (D18 extends to the lock screen). The UNLOCKED notification (private) may
// name the detected side. The side labels are AujourdhuiCopy's (R206: "En Suisse"/"Domicile" have one home).
//
// NOT A « rappel ». This carries the detected PROPOSAL once, after the day concludes; it never nags (no streak,
// no "you forgot"). So the copy says « proposition », not « rappel » - which is also why ParametresR282Test (the
// parked FCM reminder must stay unnamed) is untouched by this feature.

/** A notification's two lines. */
data class NotificationLines(
    val title: String,
    val text: String,
)

object NotificationCopy {
    /** The channel name the person sees in system settings. */
    const val CHANNEL_NAME = "Proposition du soir"

    /** The channel description in system settings - what it is and when it fires. */
    const val CHANNEL_DESCRIPTION = "Une proposition le soir, quand une journée détectée reste à enregistrer."

    /**
     * The LOCK-SCREEN (public) lines: that a proposal waits, and nothing about where (D18). The title is the
     * product name (R206: Fr.APP_NAME), so a glance at a locked phone shows only « Mon Relevé ».
     */
    fun publicLines(): NotificationLines = NotificationLines(Fr.APP_NAME, "Une proposition vous attend ce soir.")

    /**
     * The UNLOCKED (private) lines. A HIGH proposal names its side (En Suisse / Domicile); a not-sure day invites
     * manual recording - the same single notification, never a guess (D16). `kindName` is an EntryKind's `.name`
     * (CH/HOME) for a proposal, or null for not-sure - mapped here so detection/ need not import the ui labels.
     */
    fun privateLines(kindName: String?): NotificationLines =
        if (kindName == null) {
            NotificationLines(
                "Journée à renseigner",
                "Nous ne sommes pas certains de votre position ce jour-là. Indiquez-la vous-même.",
            )
        } else {
            NotificationLines(
                "Journée détectée : ${sideLabel(kindName)}",
                "Confirmez ou corrigez votre journée.",
            )
        }

    // CH -> « En Suisse », HOME -> « Domicile » (AujourdhuiCopy, R206). A proposal is only ever CH or HOME.
    private fun sideLabel(kindName: String): String =
        when (kindName) {
            "CH" -> AujourdhuiCopy.SUISSE
            else -> AujourdhuiCopy.DOMICILE
        }
}
