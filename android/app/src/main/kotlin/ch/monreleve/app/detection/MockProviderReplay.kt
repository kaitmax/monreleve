package ch.monreleve.app.detection

import android.content.Context
import android.location.Criteria
import android.location.Location
import android.location.LocationManager
import android.os.SystemClock
import ch.monreleve.app.data.local.TallyDao
import ch.monreleve.app.data.local.TallyEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

// AN-AUTO increment 7. The test-location-provider replay, HERE in detection/ because it touches a coordinate -
// fence 2b permits a coordinate type only in this package (D18). The dev activity (dev/DetectionMockReplayActivity)
// drives this but never sees a Location, a latitude or a longitude: it hands a SyntheticTrack and gets back a
// coordinate-free DailyTally.
//
// THE COORDINATE'S WHOLE LIFE is the Location built here and handed to the OS test provider, then read back by
// classifyCurrentLocation, which classifies it against the bundled polygon and DISCARDS it (D18). What crosses
// back out of this file is a Classification and the aggregate tally - never a coordinate.
//
// SYNTHETIC TIME. recordFix is called with each point's SYNTHETIC epoch (trackPointInstant), not the wall clock,
// so a compressed replay reproduces the tally a real day at the 15-minute cadence would - the same reason the
// JVM replay (DetectionSession) does. Each track uses a FRESH in-memory tally and cursor, isolated from Room and
// from the other tracks.

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
 * Replay one synthetic track through the OS test provider and the REAL classify-and-persist path, returning the
 * day's coordinate-free tally. Each point is set as the test fix, classified (the coordinate discarded inside
 * classifyCurrentLocation), and folded into an isolated in-memory tally via recordFix at the point's synthetic
 * time. A point that cannot be classified (no fix yet) is skipped - the same "withhold a thin signal" the
 * sampler does.
 */
suspend fun replayTrackThroughProvider(
    context: Context,
    manager: LocationManager,
    border: BorderPolygon,
    track: SyntheticTrack,
): DailyTally {
    val dao = InMemoryTallyDao()
    val cursor = InMemorySamplingCursorStore()
    for (point in track.points) {
        val epoch = trackPointInstant(track.dayDate, point.minuteOfDay)
        val location =
            Location(LocationManager.GPS_PROVIDER).apply {
                latitude = point.latitude
                longitude = point.longitude
                time = epoch
                accuracy = FIX_ACCURACY_METRES
                elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
            }
        manager.setTestProviderLocation(LocationManager.GPS_PROVIDER, location)
        val classification = classifyCurrentLocation(context, border) ?: continue
        recordFix(
            dao = dao,
            cursorStore = cursor,
            dayDate = track.dayDate,
            windowStartMinuteOfDay = WORKING_WINDOW_START_MINUTE,
            windowEndMinuteOfDay = WORKING_WINDOW_END_MINUTE,
            classification = classification,
            epochMillis = epoch,
        )
    }
    val row = dao.byDay(track.dayDate) ?: return DailyTally(0, 0, 0, 0)
    return DailyTally(row.minutesSwitzerland, row.minutesElsewhere, row.fixCount, row.bufferFixCount)
}

// An in-memory TallyDao so the replay never touches Room's daily_tally - each track is isolated and a re-run
// does not accumulate onto a persisted row. It implements the real interface, so recordFix exercises its real
// read-fold-write path. No coordinate: TallyEntity holds only minutes, counts and the window (SPEC 13.1).
private class InMemoryTallyDao : TallyDao {
    private val rows = linkedMapOf<String, TallyEntity>()

    override suspend fun upsert(tally: TallyEntity) {
        rows[tally.dayDate] = tally
    }

    override suspend fun byDay(dayDate: String): TallyEntity? = rows[dayDate]

    override suspend fun all(): List<TallyEntity> = rows.values.sortedBy { it.dayDate }

    override fun observeAll(): Flow<List<TallyEntity>> = flowOf(rows.values.sortedBy { it.dayDate })
}
