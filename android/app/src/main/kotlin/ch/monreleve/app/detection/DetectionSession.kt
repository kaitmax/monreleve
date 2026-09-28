package ch.monreleve.app.detection

// AN6a increment 5. The real sampling path's entry point: fixes in, a proposal out.
//
// onFix is THE UNIT UNDER TEST (R204/AC1). A synthetic track is replayed by calling onFix per
// fix - on the emulator through LocationManager (position from `adb emu geo fix`, timestamp
// from the replay's compressed schedule), and in the JVM regression test directly. Either way
// the SAME pipeline runs: classify against the bundled polygon, accumulate, tally with
// hysteresis, tier, proposal.
//
// THE SESSION NEVER HOLDS A COORDINATE. onFix hands (latitude, longitude) straight to
// classifyFix, which returns a ClassifiedFix (side + timestamp, no position); only those are
// kept. The coordinate's life is the onFix argument list - the confinement AC2 proves, at the
// one place a whole day's fixes flow through.

class DetectionSession(private val border: BorderPolygon) {
    private val fixes = mutableListOf<ClassifiedFix>()

    fun onFix(
        latitude: Double,
        longitude: Double,
        epochMillis: Long,
    ) {
        fixes.add(classifyFix(border, latitude, longitude, epochMillis))
    }

    fun tally(): DailyTally = computeTally(fixes)

    fun proposal(dayDate: String): Proposal? = computeProposal(computeTally(fixes), fixes.toList(), dayDate)

    fun fixCount(): Int = fixes.size

    fun reset() {
        fixes.clear()
    }
}
