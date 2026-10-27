package ch.monreleve.app.detection

// AN6a increment 2. The classifier's vocabulary, and the type that crosses OUT of the
// coordinate's short life.
//
// THE COORDINATE DIES IN classifyFix. A latitude/longitude enters as two arguments, is
// handed to BorderPolygon.classify, and is gone when the function returns - the result is a
// ClassifiedFix, which carries the side and the fix's own timestamp and NOTHING ELSE. It is
// never a field, a list element, a log line or a return value that could hold a position
// (D18). CoordinateConfinementTest asserts, by reflection, that ClassifiedFix has no
// coordinate-shaped field - the runtime third of AC2's three proofs, beside the source
// fence (2b) and the Room DDL scan.
//
// THE TIMESTAMP IS THE FIX'S OWN, not the wall clock. Minutes are attributed in the tally
// (increment 3) from the gap between successive fix timestamps, so a compressed replay of a
// day's fixes (increment 5) produces the same tally a real day would - nothing reads
// System.currentTimeMillis for attribution.

/** The whole of what survives a fix: which side, and when. No coordinate (D18). */
data class ClassifiedFix(
    val classification: Classification,
    val epochMillis: Long,
)

/**
 * The one seam where a coordinate exists and then does not. The latitude, longitude AND the fix's
 * accuracy (R324) are arguments here and nowhere else; the ClassifiedFix returned carries no position
 * and no accuracy value. A BUFFER fix is kept as BUFFER (counted, never guessed onto a side) - and a
 * fix too coarse to resolve the border is a BUFFER for that reason too (BorderPolygon.classify).
 */
fun classifyFix(
    border: BorderPolygon,
    latitude: Double,
    longitude: Double,
    epochMillis: Long,
    accuracyMeters: Double,
): ClassifiedFix = ClassifiedFix(border.classify(latitude, longitude, accuracyMeters), epochMillis)
