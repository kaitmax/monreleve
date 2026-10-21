package ch.monreleve.app.detection

import ch.monreleve.app.fences.subjectFile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * AN6a increment 5. The seven synthetic tracks, replayed through the real entry point
 * (DetectionSession.onFix - R204, not computeProposal called directly), asserted against the
 * expectations written into SyntheticTracks BEFORE this ran (R197). This is the in-gate
 * regression; the emulator replay (REPORT-AN6a.txt) is AC1's on-device evidence.
 */
class DetectionSessionTest {
    // AN-FENCE-ROOTS (R461): :app only, and correct - a bundled Android asset has no commonMain home.
    private val border: BorderPolygon by lazy {
        BorderPolygon.fromGeoJson(subjectFile(BORDER_FENCE, BORDER_ASSET).readText())
    }

    @Test
    fun everyTrackProducesItsExpectedProposal() {
        for (track in SyntheticTracks.all) {
            assertEquals("track '${track.name}'", track.expected, replayTrack(border, track))
        }
    }

    // AN-NEXT-2 / R324. The AN6a tracks RE-RUN with COARSE fixes. All three track coordinates (central Geneva,
    // Annemasse, the border vertex) sit within a few km of the Geneva border, so a 10 km accuracy radius - the
    // kind a NETWORK (wifi/cell) fix can carry - reaches the border from every one of them. No check can resolve
    // a side, so every day is "not sure" and WITHHOLDS, instead of asserting a confident wrong "En Suisse" that
    // would understate telework (R278). This is the defect the accuracy guard closes.
    @Test
    fun coarseFixesNearTheGenevaBorderWithholdEveryProposal() {
        for (track in SyntheticTracks.all) {
            assertEquals(
                "coarse replay of '${track.name}' must withhold",
                null,
                replayTrack(border, track, accuracyMeters = 10_000.0),
            )
        }
    }

    // Non-vacuous (R133/R154): several tracks DO propose at precise accuracy, so the coarse withholding above is
    // the guard working - not an artefact of tracks that withhold anyway (the buffer day, the split day, the
    // no-fix day). If this went empty, the coarse test would be certifying nothing.
    @Test
    fun atPreciseAccuracyThoseSameTracksDoPropose() {
        val proposing = SyntheticTracks.all.filter { replayTrack(border, it, accuracyMeters = 0.0) != null }
        assertTrue("expected some tracks to propose at precise accuracy, found none", proposing.isNotEmpty())
    }
}
