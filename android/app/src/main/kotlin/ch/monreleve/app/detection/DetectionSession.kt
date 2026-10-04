package ch.monreleve.app.detection

// R320. The sampling path's entry point for a replay: fixes in, the day's four checks (and the vote) out.
//
// onFix is THE UNIT UNDER TEST (R204). A synthetic track is replayed by calling onFix per fix - on the phone
// through the mock provider (MockProviderReplay), and in the JVM regression test directly. Either way the SAME
// decision runs: each fix is assigned to the check window its instant falls in (checkWindowAt); the FIRST fix in a
// window wins (a check runs anywhere inside its window); a fix outside every window is ignored - never a late
// check. At day's end the four slots are the DayChecks the vote reads.
//
// THE SESSION NEVER HOLDS A COORDINATE. onFix hands (latitude, longitude, accuracyMeters) straight to classifyFix,
// which returns a Classification (no position, no accuracy value); only the per-window Classification is kept. The
// coordinate's AND the accuracy's life is the onFix argument list - the confinement AC2 proves, at the one place a
// whole day's fixes flow through. The accuracy is read only to decide whether a coarse fix may assert a side (R324).

class DetectionSession(private val border: BorderPolygon) {
    private val checkByWindow = HashMap<Int, Classification>()

    fun onFix(
        latitude: Double,
        longitude: Double,
        epochMillis: Long,
        accuracyMeters: Double,
    ) {
        val window = checkWindowAt(epochMillis) ?: return // outside any window: never recorded as a late check
        if (checkByWindow.containsKey(window.index)) return // the first fix inside the window wins
        checkByWindow[window.index] = classifyFix(border, latitude, longitude, epochMillis, accuracyMeters).classification
    }

    fun checks(): DayChecks =
        DayChecks(
            check1 = checkByWindow[1],
            check2 = checkByWindow[2],
            check3 = checkByWindow[3],
            check4 = checkByWindow[4],
        )

    fun proposal(): Proposal? = dayProposal(checks())

    fun reset() {
        checkByWindow.clear()
    }
}
