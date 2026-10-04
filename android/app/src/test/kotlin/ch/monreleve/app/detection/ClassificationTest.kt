package ch.monreleve.app.detection

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * AN6a increment 2. A fix in, one of INSIDE / OUTSIDE / BUFFER out, and the timestamp
 * carried through to the ClassifiedFix that survives it.
 */
class ClassificationTest {
    private val border: BorderPolygon by lazy {
        BorderPolygon.fromGeoJson(File("src/main/assets/border/switzerland.json").readText())
    }

    // A point exactly on the real border, so its distance-to-edge is ~0 and it classifies BUFFER.
    private val borderVertex: DoubleArray by lazy {
        val json = File("src/test/resources/border/geneva-reference.json").readText()
        val segment = JSONObject(json).getJSONArray("coordinates").getJSONArray(0)
        val point = segment.getJSONArray(segment.length() / 2)
        doubleArrayOf(point.getDouble(0), point.getDouble(1))
    }

    @Test
    fun insideOutsideAndBuffer() {
        // Pure geometry: a perfectly precise fix (accuracy 0 m), so the side is decided by position alone.
        assertEquals(Classification.INSIDE, border.classify(latitude = 46.9480, longitude = 7.4474, accuracyMeters = 0.0))
        assertEquals(Classification.OUTSIDE, border.classify(latitude = 45.7640, longitude = 4.8357, accuracyMeters = 0.0))
        assertEquals(
            Classification.BUFFER,
            border.classify(latitude = borderVertex[1], longitude = borderVertex[0], accuracyMeters = 0.0),
        )
    }

    @Test
    fun classifyFixKeepsTheSideAndTheTimestampAndNoCoordinate() {
        val fix =
            classifyFix(
                border,
                latitude = 46.9480,
                longitude = 7.4474,
                epochMillis = 1_777_000_000_000L,
                accuracyMeters = 0.0,
            )
        assertEquals(Classification.INSIDE, fix.classification)
        assertEquals(1_777_000_000_000L, fix.epochMillis)
    }
}
