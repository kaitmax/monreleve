package ch.monreleve.app.fr

// AN6a increment 5. Labels for the dev detection-replay screen (dev/DetectionReplayActivity),
// which runs the seven synthetic tracks through the real pipeline on the emulator and shows the
// live geo-fix classification. A developer instrument, never a SPEC 11 screen (the real
// detection UI is AN8), but French from fr/ (R155) and reachable (R238), the same status as the
// gallery and the recorder.

object ReplayCopy {
    const val TITLE = "Rejeu détection (dev)"
    const val PASS = "OK"
    const val FAIL = "ÉCHEC"
    const val WITHHELD = "aucune proposition"
    const val CURRENT_LOCATION = "Position actuelle"
    const val NONE = "aucune"

    // AN-AUTO increment 7: the mock-provider replay (dev/DetectionMockReplayActivity) runs the seven tracks
    // through the REAL background path on the PHYSICAL phone - a debug-only test provider feeds each point to the
    // OS location layer, the classifier discards the coordinate (D18), and recordFix builds the tally. It shows
    // each track's PRODUCT outcome under R311 (Proposé for HIGH; Pas sûr for MEDIUM/LOW/withheld).
    const val MOCK_TITLE = "Rejeu via fournisseur fictif (dev)"
    const val OUTCOME_NOT_SURE = "Pas sûr"
    const val RUNNING = "Rejeu en cours…"

    private const val OUTCOME_PROPOSED = "Proposé"

    /** "Proposé CH" / "Proposé HOME" - the product outcome for a HIGH day, with the proposed kind's `.name`. */
    fun proposedOutcome(kindName: String): String = "$OUTCOME_PROPOSED $kindName"

    // Shown when addTestProvider is refused: the app is not set as the mock-location app. The one adb step.
    const val MOCK_UNAVAILABLE =
        "Fournisseur de position fictif indisponible. Activez-le : " +
            "adb shell appops set ch.monreleve.app android:mock_location allow"
}
