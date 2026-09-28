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
}
