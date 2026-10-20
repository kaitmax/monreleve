package ch.monreleve.app.detection

import ch.monreleve.app.fences.subjectFile
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sqrt

// AN-FENCE-ROOTS (R206/R460). ONE HOME for the bundled asset's path and this family's fence name.
// BorderPolygonTest, ClassificationTest and DetectionSessionTest all read the SAME asset and all sit in
// this package, so the path is declared once here - the file that also asserts the asset's committed
// size - rather than typed into three files that can drift apart.
internal const val BORDER_ASSET = "src/main/assets/border/switzerland.json"
internal const val BORDER_FENCE = "bundled border-polygon fence"

/**
 * AN6a increment 1. The bundled polygon does what the classifier needs: inside/outside for
 * known points, and a simplification error small enough that it can never misclassify a
 * point the 150 m buffer is meant to protect.
 *
 * THE TOLERANCE TEST IS THE POINT (relay). The bundled polygon is Douglas-Peucker
 * simplified at 25 m; a polygon simplified at 200 m would move the border enough to flip a
 * buffer point. Sample points at 50/100/200/500 m either side of the REAL (unsimplified)
 * Geneva border are measured against both geometries, and the bundled distance must agree
 * with the full-resolution reference to well within the buffer.
 */
class BorderPolygonTest {
    private companion object {
        const val METERS_PER_DEGREE_LAT = 110_540.0
        const val METERS_PER_DEGREE_LNG_EQUATOR = 111_320.0
        const val DEGREES_TO_RADIANS = Math.PI / 180.0

        // Simplification is 25 m; the observed bundled-vs-reference error must stay far below
        // the 150 m buffer. This bound proves that with margin.
        const val MAX_SIMPLIFICATION_ERROR_M = 50.0

        const val VERTEX_SAMPLES = 40

        // Offsets either side of the real border - the distances the 150 m buffer must survive.
        val OFFSETS = listOf(50.0, 100.0, 200.0, 500.0)
        val SIDES = listOf(1.0, -1.0)
    }

    // AN-FENCE-ROOTS (R461). THIS TEST READS :app ONLY, AND THAT IS CORRECT: its subject is a BUNDLED
    // ANDROID ASSET (src/main/assets), which :shared commonMain cannot hold. R460: subjectFile() names
    // the file and where it looked, so a moved asset fails here rather than throwing bare.
    private val bundled: BorderPolygon by lazy {
        BorderPolygon.fromGeoJson(subjectFile(BORDER_FENCE, BORDER_ASSET).readText())
    }

    /** The full-resolution Geneva border, as line segments (a MultiLineString clip of the source). */
    private val referenceSegments: List<List<DoubleArray>> by lazy {
        val json = subjectFile(BORDER_FENCE, "src/test/resources/border/geneva-reference.json").readText()
        val coordinates = JSONObject(json).getJSONArray("coordinates")
        (0 until coordinates.length()).map { line ->
            val points = coordinates.getJSONArray(line)
            (0 until points.length()).map { i ->
                val point = points.getJSONArray(i)
                doubleArrayOf(point.getDouble(0), point.getDouble(1))
            }
        }
    }

    @Test
    fun knownPointsClassifyInsideAndOutside() {
        // Well inside Switzerland, far from any border.
        assertTrue("Bern is in Switzerland", bundled.contains(latitude = 46.9480, longitude = 7.4474))
        assertTrue("central Geneva is in Switzerland", bundled.contains(latitude = 46.2044, longitude = 6.1432))
        // Well outside.
        assertFalse("Lyon is not in Switzerland", bundled.contains(latitude = 45.7640, longitude = 4.8357))
        assertFalse("Annemasse is in France", bundled.contains(latitude = 46.1919, longitude = 6.2347))
    }

    @Test
    fun holesAreRespected() {
        // A synthetic enclave: a 1-degree square with a 0.2-degree hole in its middle. Proves
        // the ray-cast processes interior rings even though the OSM extract has none.
        val exterior =
            listOf(
                doubleArrayOf(6.0, 46.0),
                doubleArrayOf(7.0, 46.0),
                doubleArrayOf(7.0, 47.0),
                doubleArrayOf(6.0, 47.0),
                doubleArrayOf(6.0, 46.0),
            )
        val hole =
            listOf(
                doubleArrayOf(6.4, 46.4),
                doubleArrayOf(6.6, 46.4),
                doubleArrayOf(6.6, 46.6),
                doubleArrayOf(6.4, 46.6),
                doubleArrayOf(6.4, 46.4),
            )
        val withHole = BorderPolygon(listOf(listOf(exterior, hole)))
        assertTrue("inside the square, outside the hole", withHole.contains(latitude = 46.2, longitude = 6.2))
        assertFalse("inside the hole is NOT inside", withHole.contains(latitude = 46.5, longitude = 6.5))
    }

    @Test
    fun aPointNearTheBorderIsWithinTheBuffer() {
        // A reference border vertex is on the line, so a point a few metres from it is well
        // within the 150 m buffer; a point 500 m away is not.
        val vertex = referenceSegments.first { it.size > 2 }[1]
        val onLine = bundled.distanceToEdgeMeters(latitude = vertex[1], longitude = vertex[0])
        assertTrue("a border vertex is within the buffer (was $onLine m)", onLine <= BUFFER_METERS)
    }

    @Test
    fun simplificationErrorStaysFarBelowTheBuffer() {
        // Walk the longest reference segment, offsetting points perpendicular to the local
        // border at 50/100/200/500 m on each side, and compare the bundled distance-to-edge
        // against the full-resolution reference distance at the same point.
        val segment = referenceSegments.maxByOrNull { it.size }!!
        val step = segment.size / VERTEX_SAMPLES
        var maxError = 0.0
        var samples = 0
        var index = step
        while (index < segment.size - 1) {
            maxError = max(maxError, maxErrorAround(segment, index))
            samples += OFFSETS.size * SIDES.size
            index += step
        }
        assertTrue("expected samples along the border, found $samples", samples >= VERTEX_SAMPLES)
        assertTrue(
            "max simplification error $maxError m must stay far below the $BUFFER_METERS m buffer",
            maxError < MAX_SIMPLIFICATION_ERROR_M,
        )
        val rounded = "%.1f".format(maxError)
        println("simplification error over $samples near-border points: max $rounded m (25 m tolerance)")
    }

    // The largest bundled-vs-reference distance error over the offset points around one vertex.
    private fun maxErrorAround(
        segment: List<DoubleArray>,
        index: Int,
    ): Double {
        val v = segment[index]
        val a = segment[index - 1]
        val b = segment[index + 1]
        var worst = 0.0
        for (offset in OFFSETS) {
            for (side in SIDES) {
                val p = offsetPoint(v, a, b, offset * side)
                val bundledDistance = bundled.distanceToEdgeMeters(latitude = p[1], longitude = p[0])
                worst = max(worst, kotlin.math.abs(bundledDistance - referenceDistanceMeters(p)))
            }
        }
        return worst
    }

    // A point `offsetMeters` perpendicular to the local border direction (a->b) through v.
    private fun offsetPoint(
        v: DoubleArray,
        a: DoubleArray,
        b: DoubleArray,
        offsetMeters: Double,
    ): DoubleArray {
        val cosLat = cos(v[1] * DEGREES_TO_RADIANS)
        val dx = (b[0] - a[0]) * METERS_PER_DEGREE_LNG_EQUATOR * cosLat
        val dy = (b[1] - a[1]) * METERS_PER_DEGREE_LAT
        val length = sqrt(dx * dx + dy * dy)
        val nx = -dy / length
        val ny = dx / length
        val lng = v[0] + (nx * offsetMeters) / (METERS_PER_DEGREE_LNG_EQUATOR * cosLat)
        val lat = v[1] + (ny * offsetMeters) / METERS_PER_DEGREE_LAT
        return doubleArrayOf(lng, lat)
    }

    private fun referenceDistanceMeters(p: DoubleArray): Double {
        val cosLat = cos(p[1] * DEGREES_TO_RADIANS)
        var nearest = Double.MAX_VALUE
        for (segment in referenceSegments) {
            for (i in 0 until segment.size - 1) {
                val d = pointToSegmentMeters(p, segment[i], segment[i + 1], cosLat)
                if (d < nearest) nearest = d
            }
        }
        return nearest
    }

    private fun pointToSegmentMeters(
        p: DoubleArray,
        a: DoubleArray,
        b: DoubleArray,
        cosLat: Double,
    ): Double {
        val ax = (a[0] - p[0]) * METERS_PER_DEGREE_LNG_EQUATOR * cosLat
        val ay = (a[1] - p[1]) * METERS_PER_DEGREE_LAT
        val bx = (b[0] - p[0]) * METERS_PER_DEGREE_LNG_EQUATOR * cosLat
        val by = (b[1] - p[1]) * METERS_PER_DEGREE_LAT
        val dx = bx - ax
        val dy = by - ay
        val lengthSq = dx * dx + dy * dy
        if (lengthSq == 0.0) return sqrt(ax * ax + ay * ay)
        var t = -(ax * dx + ay * dy) / lengthSq
        t = t.coerceIn(0.0, 1.0)
        val projX = ax + t * dx
        val projY = ay + t * dy
        return sqrt(projX * projX + projY * projY)
    }

    @Test
    fun theBundledPolygonReportsItsSize() {
        val bytes = subjectFile(BORDER_FENCE, BORDER_ASSET).length()
        // Bundled and committed; a regression that bloats it (e.g. a lost simplification) is visible.
        assertEquals("bundled polygon is the committed ~154 KB artifact", 157_852L, bytes)
    }
}
