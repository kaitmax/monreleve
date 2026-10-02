package ch.monreleve.app.detection

import android.content.Context
import android.location.Criteria
import android.location.Location
import android.location.LocationManager
import android.os.SystemClock

// AN-AUTO increment 7, R320. The test-location-provider replay, HERE in detection/ because it touches a coordinate -
// fence 2b permits a coordinate type only in this package (D18). The dev activity (dev/DetectionMockReplayActivity)
// drives this but never sees a Location, a latitude or a longitude: it hands a SyntheticTrack and gets back a
// coordinate-free DayChecks.
//
// THE COORDINATE'S WHOLE LIFE is the Location built here and handed to the OS test provider, then read back by
// classifyCurrentLocation, which classifies it against the bundled polygon and DISCARDS it (D18). What crosses back
// out of this file is a Classification per check window - never a coordinate.
//
// FOUR CHECKS, NOT CONTINUOUS (R320). Each point is assigned to the check window its synthetic time falls in; the
// first fix inside a window wins, and a fix outside every window (the "delayed past its window" case) is ignored -
// never recorded as a late check. The result is the day's four checks, exactly what the background path produces.

private const val FIX_ACCURACY_METRES = 5f

/** Register the app's GPS test provider. Returns false when the app is not the mock-location app (appops). */
@Suppress("DEPRECATION") // the long addTestProvider signature is the one available from minSdk 26
fun installTestLocationProvider(manager: LocationManager): Boolean =
    runCatching {
        manager.addTestProvider(
            LocationManager.GPS_PROVIDER,
            false, false, false, false, true, true, true,
            Criteria.POWER_LOW, Criteria.ACCURACY_FINE,
        )
        manager.setTestProviderEnabled(LocationManager.GPS_PROVIDER, true)
    }.isSuccess

/** Remove the test provider (best effort). */
fun removeTestLocationProvider(manager: LocationManager) {
    runCatching { manager.removeTestProvider(LocationManager.GPS_PROVIDER) }
}

/**
 * Replay one synthetic track through the OS test provider and the REAL classify path, returning the day's
 * coordinate-free four checks. Each point is set as the test fix, assigned to its check window, classified (the
 * coordinate discarded inside classifyCurrentLocation), and kept as that window's check. A point outside every
 * window, or a window already filled, is skipped - the same decision the background sampler makes.
 */
fun replayTrackThroughProvider(
    context: Context,
    manager: LocationManager,
    border: BorderPolygon,
    track: SyntheticTrack,
): DayChecks {
    val slots = HashMap<Int, Classification>()
    for (point in track.points) {
        classifyPointIntoSlots(context, manager, border, track.dayDate, point, slots)
    }
    return DayChecks(slots[1], slots[2], slots[3], slots[4])
}

// One point: assign it to its check window and record its classification, unless the point is outside every window
// (never a late check), its window is already filled (first fix wins), or no fix is produced (the check stays MISSED).
@Suppress("ReturnCount", "LongParameterList") // each return is a distinct "skip this point" reason; seams are listed
private fun classifyPointIntoSlots(
    context: Context,
    manager: LocationManager,
    border: BorderPolygon,
    dayDate: String,
    point: TrackPoint,
    slots: MutableMap<Int, Classification>,
) {
    val epoch = trackPointInstant(dayDate, point.minuteOfDay)
    val window = checkWindowAt(epoch) ?: return
    if (slots.containsKey(window.index)) return
    val location =
        Location(LocationManager.GPS_PROVIDER).apply {
            latitude = point.latitude
            longitude = point.longitude
            time = epoch
            accuracy = FIX_ACCURACY_METRES
            elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
        }
    manager.setTestProviderLocation(LocationManager.GPS_PROVIDER, location)
    val classification = classifyCurrentLocation(context, border) ?: return
    slots[window.index] = classification
}
