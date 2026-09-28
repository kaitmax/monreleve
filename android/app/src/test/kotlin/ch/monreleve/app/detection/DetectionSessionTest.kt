package ch.monreleve.app.detection

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * AN6a increment 5. The seven synthetic tracks, replayed through the real entry point
 * (DetectionSession.onFix - R204, not computeProposal called directly), asserted against the
 * expectations written into SyntheticTracks BEFORE this ran (R197). This is the in-gate
 * regression; the emulator replay (REPORT-AN6a.txt) is AC1's on-device evidence.
 */
class DetectionSessionTest {
    private val border: BorderPolygon by lazy {
        BorderPolygon.fromGeoJson(File("src/main/assets/border/switzerland.json").readText())
    }

    @Test
    fun everyTrackProducesItsExpectedProposal() {
        for (track in SyntheticTracks.all) {
            assertEquals("track '${track.name}'", track.expected, replayTrack(border, track))
        }
    }
}
