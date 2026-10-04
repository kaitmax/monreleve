package ch.monreleve.app.detection

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
        assertEquals(
            Classification.INSIDE,
            border.classify(latitude = 46.9480, longitude = 7.4474, accuracyMeters = 0.0),
        )
        assertEquals(
            Classification.OUTSIDE,
            border.classify(latitude = 45.7640, longitude = 4.8357, accuracyMeters = 0.0),
        )
        assertEquals(
            Classification.BUFFER,
            border.classify(latitude = borderVertex[1], longitude = borderVertex[0], accuracyMeters = 0.0),
        )
    }

    // AN-NEXT-2 / R324. A fix is classified to a side ONLY IF its accuracy radius is smaller than its distance
    // to the border; otherwise it counts as in the strip ("not sure"). The three cases the rule turns on, with
    // the near point and its distance DERIVED from the real polygon (R171, never a hand-typed metre figure):
    // walk inward from a border vertex toward central Geneva until the point sits past the base 150 m strip.
    private val nearInside: DoubleArray by lazy {
        // borderVertex is ~on the line; central Geneva (6.1432, 46.2044) is well inside. Step toward Geneva in
        // small fractions until distance-to-edge lands in (200 m, 1500 m): outside the base strip, so ACCURACY
        // is what decides, and close enough that a few-hundred-metre network radius reaches the border.
        val toGenevaLng = 6.1432 - borderVertex[0]
        val toGenevaLat = 46.2044 - borderVertex[1]
        var found: DoubleArray? = null
        var step = 0.01
        while (step <= 0.5 && found == null) {
            val lng = borderVertex[0] + toGenevaLng * step
            val lat = borderVertex[1] + toGenevaLat * step
            val d = border.distanceToEdgeMeters(lat, lng)
            if (d in 200.0..1500.0 && border.contains(lat, lng)) found = doubleArrayOf(lng, lat)
            step += 0.01
        }
        requireNotNull(found) { "could not derive a near-but-classifiable inside point from the polygon" }
    }

    @Test
    fun aCoarseFixNearTheBorderIsNotSureAndAPreciseOneClassifies() {
        val lat = nearInside[1]
        val lng = nearInside[0]
        val distance = border.distanceToEdgeMeters(lat, lng)
        // The point is genuinely out of the base 150 m strip, so BUFFER here is the accuracy guard, not D25.
        assertTrue("the near point must sit past the base strip, distance=$distance", distance > BUFFER_METERS)
        // Precise: accuracy well under the distance -> the side is asserted, exactly as the GPS era.
        assertEquals(Classification.INSIDE, border.classify(lat, lng, accuracyMeters = distance / 4.0))
        // Coarse (a NETWORK fix's radius reaches the border): the side cannot be resolved -> not sure.
        assertEquals(Classification.BUFFER, border.classify(lat, lng, accuracyMeters = distance * 2.0))
    }

    @Test
    fun theSameCoarseRadiusFarFromTheBorderStillClassifies() {
        // Bern: tens of km inside. The SAME coarse radius that was "not sure" near the border is nowhere near it
        // here, so the side is resolved - R324 changes nothing far from the line.
        val lat = 46.9480
        val lng = 7.4474
        val distance = border.distanceToEdgeMeters(lat, lng)
        val coarse = 2_000.0
        assertTrue("Bern must be far past the coarse radius, distance=$distance", distance > coarse)
        assertEquals(Classification.INSIDE, border.classify(lat, lng, accuracyMeters = coarse))
    }

    @Test
    fun aFixWithNoStatedAccuracyIsTreatedAsImprecise() {
        // LiveLocation maps a fix with no accuracy to Double.MAX_VALUE (fail-closed); near the border that is
        // always "not sure" rather than a confident wrong side.
        val lat = nearInside[1]
        val lng = nearInside[0]
        assertEquals(Classification.BUFFER, border.classify(lat, lng, accuracyMeters = Double.MAX_VALUE))
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
