package ch.monreleve.app.detection

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

// AN6a increment 1. The bundled Swiss border, and the two geometric questions the
// classifier asks of a fix: which side, and how far from the line. Pure Kotlin, no geo
// dependency (R136) - the only preprocessing (fetch, clip, Douglas-Peucker) ran off-device
// in scripts/prepare-border-polygon.mjs; this is what ships.
//
// It lives in detection/ because that is the ONE package fence 2b (D18) permits a
// coordinate-shaped name in. A latitude/longitude enters classify()/contains()/
// distanceToEdgeMeters() as a parameter, is used, and is never assigned to a field, a
// list, a log or a return value - the coordinate's whole life is one function's scope
// (increment 2 proves that). This class stores only the BORDER geometry, never a fix.
//
// DEGREES ARE NOT METRES. At 46 degrees north a degree of longitude is ~77 km and a
// degree of latitude ~111 km, so distance-to-edge scales longitude by cos(latitude)
// (an equirectangular projection around the query point). At the 150 m scale this
// question is asked, that approximation is far finer than the GPS envelope it judges.

const val BUFFER_METERS = 150.0

private const val METERS_PER_DEGREE_LAT = 110_540.0
private const val METERS_PER_DEGREE_LNG_EQUATOR = 111_320.0
private const val DEGREES_TO_RADIANS = Math.PI / 180.0

/** A ring is a closed loop of [longitude, latitude] points; a polygon is an exterior ring then holes. */
class BorderPolygon(private val polygons: List<List<List<DoubleArray>>>) {
    /**
     * A fix in, one of INSIDE / OUTSIDE / BUFFER out (SPEC 13). BUFFER is any point within
     * 150 m of the border, either side - counted and discarded, never guessed onto a side.
     * The coordinate lives only in this call's arguments; the returned value carries none.
     */
    fun classify(
        latitude: Double,
        longitude: Double,
    ): Classification =
        if (distanceToEdgeMeters(latitude, longitude) <= BUFFER_METERS) {
            Classification.BUFFER
        } else if (contains(latitude, longitude)) {
            Classification.INSIDE
        } else {
            Classification.OUTSIDE
        }

    /**
     * Point-in-polygon by ray casting, HOLE-AWARE: a point is inside Switzerland if it is
     * inside some polygon's exterior ring and inside none of that polygon's holes. This
     * OSM extract has no holes (the Buesingen and Campione enclaves are not cut out - a
     * documented limitation, immaterial to the Geneva border this serves), but the loop
     * processes interior rings so a hole-carrying source works unchanged.
     */
    fun contains(
        latitude: Double,
        longitude: Double,
    ): Boolean {
        for (polygon in polygons) {
            if (polygon.isEmpty() || !pointInRing(latitude, longitude, polygon[0])) continue
            var inHole = false
            for (h in 1 until polygon.size) {
                if (pointInRing(latitude, longitude, polygon[h])) {
                    inHole = true
                    break
                }
            }
            if (!inHole) return true
        }
        return false
    }

    /** Metres from the point to the nearest border edge, over every ring of every polygon. */
    fun distanceToEdgeMeters(
        latitude: Double,
        longitude: Double,
    ): Double {
        val cosLat = cos(latitude * DEGREES_TO_RADIANS)
        var nearest = Double.MAX_VALUE
        for (polygon in polygons) {
            for (ring in polygon) {
                val d = nearestOnRing(latitude, longitude, ring, cosLat)
                if (d < nearest) nearest = d
            }
        }
        return nearest
    }

    private fun nearestOnRing(
        latitude: Double,
        longitude: Double,
        ring: List<DoubleArray>,
        cosLat: Double,
    ): Double {
        var nearest = Double.MAX_VALUE
        var previous = ring.size - 1
        for (current in ring.indices) {
            val d = segmentDistanceMeters(latitude, longitude, ring[previous], ring[current], cosLat)
            if (d < nearest) nearest = d
            previous = current
        }
        return nearest
    }

    private fun pointInRing(
        latitude: Double,
        longitude: Double,
        ring: List<DoubleArray>,
    ): Boolean {
        var inside = false
        var previous = ring.size - 1
        for (current in ring.indices) {
            val xi = ring[current][0]
            val yi = ring[current][1]
            val xj = ring[previous][0]
            val yj = ring[previous][1]
            val straddles = (yi > latitude) != (yj > latitude)
            if (straddles && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) {
                inside = !inside
            }
            previous = current
        }
        return inside
    }

    // Point-to-segment distance in metres, via an equirectangular projection centred on the
    // query point (so the point itself is the origin and longitude is scaled by cos(lat)).
    private fun segmentDistanceMeters(
        latitude: Double,
        longitude: Double,
        a: DoubleArray,
        b: DoubleArray,
        cosLat: Double,
    ): Double {
        val ax = (a[0] - longitude) * METERS_PER_DEGREE_LNG_EQUATOR * cosLat
        val ay = (a[1] - latitude) * METERS_PER_DEGREE_LAT
        val bx = (b[0] - longitude) * METERS_PER_DEGREE_LNG_EQUATOR * cosLat
        val by = (b[1] - latitude) * METERS_PER_DEGREE_LAT
        val dx = bx - ax
        val dy = by - ay
        val lengthSq = dx * dx + dy * dy
        if (lengthSq == 0.0) return sqrt(ax * ax + ay * ay)
        val t = max(0.0, min(1.0, -(ax * dx + ay * dy) / lengthSq))
        val projX = ax + t * dx
        val projY = ay + t * dy
        return sqrt(projX * projX + projY * projY)
    }

    companion object {
        /** Parse a GeoJSON MultiPolygon into a BorderPolygon. Points are [longitude, latitude]. */
        fun fromGeoJson(json: String): BorderPolygon = fromMultiPolygon(JSONObject(json).getJSONArray("coordinates"))

        private fun fromMultiPolygon(coordinates: JSONArray): BorderPolygon {
            val polygons =
                (0 until coordinates.length()).map { p ->
                    val polygon = coordinates.getJSONArray(p)
                    (0 until polygon.length()).map { r -> ring(polygon.getJSONArray(r)) }
                }
            return BorderPolygon(polygons)
        }

        private fun ring(points: JSONArray): List<DoubleArray> =
            (0 until points.length()).map { i ->
                val point = points.getJSONArray(i)
                doubleArrayOf(point.getDouble(0), point.getDouble(1))
            }
    }
}
