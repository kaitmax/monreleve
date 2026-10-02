package ch.monreleve.app.detection

import android.content.Context
import ch.monreleve.app.data.local.TallyDao
import ch.monreleve.app.data.local.TallyEntity

// AN-AUTO increment 4. The sampler's persistence step, and the coordinate-free cursor it carries across wakes.
//
// recordFix IS what each WorkManager wake calls AFTER a fix has been classified and its coordinate discarded
// (LiveLocation). It never sees a coordinate - only a Classification and a timestamp. It loads the day's
// aggregate tally (TallyDao) and the per-day cursor, folds the fix in (accumulateFix), and writes back the
// aggregate, the cursor, and the recomputed tier. Room holds ONLY the aggregate (SPEC 13.1); the cursor is a
// single last value (side + time), not a history, kept in the detection prefs that are cleared on mode-off and
// sign-out.
//
// THE CURSOR IS PER-DAY. load() returns the cursor only when its stored day matches the day being recorded, so
// a fix on a new day starts a fresh tally rather than attributing a gap across the midnight boundary.

/** The day's aggregate as a DailyTally (the tier is recomputed from it, so it is not read back here). */
private fun TallyEntity.toDailyTally(): DailyTally {
    return DailyTally(minutesSwitzerland, minutesElsewhere, fixCount, bufferFixCount)
}

/**
 * Fold one classified fix into the day's stored tally. Pure over its seams (TallyDao + cursor store), so it is
 * driven directly in DetectionSamplerTest with fakes. No coordinate crosses this function - classification is
 * INSIDE/OUTSIDE/BUFFER and epochMillis is a time. The parameter list is the seams and the day context, listed
 * rather than bundled (the codebase's standing reasoning for a cohesive step).
 */
@Suppress("LongParameterList")
suspend fun recordFix(
    dao: TallyDao,
    cursorStore: SamplingCursorStore,
    dayDate: String,
    windowStartMinuteOfDay: Int,
    windowEndMinuteOfDay: Int,
    classification: Classification,
    epochMillis: Long,
) {
    val base = dao.byDay(dayDate)?.toDailyTally() ?: DailyTally(0, 0, 0, 0)
    val cursor = cursorStore.load(dayDate)
    val (next, nextCursor) = accumulateFix(base, cursor, classification, epochMillis)
    val tier = computeTier(next, expectedSamples()).name
    dao.upsert(
        TallyEntity(
            dayDate = dayDate,
            minutesSwitzerland = next.minutesSwitzerland,
            minutesElsewhere = next.minutesElsewhere,
            fixCount = next.fixCount,
            bufferFixCount = next.bufferFixCount,
            windowStartMinuteOfDay = windowStartMinuteOfDay,
            windowEndMinuteOfDay = windowEndMinuteOfDay,
            tier = tier,
        ),
    )
    cursorStore.save(dayDate, nextCursor)
}

/**
 * The per-day cursor store. Coordinate-free: it holds the day and the previous fix's side + time. load()
 * returns the cursor only for the matching day (a new day is fresh). clear() wipes it (mode-off, sign-out).
 */
interface SamplingCursorStore {
    fun load(dayDate: String): FixCursor?

    fun save(
        dayDate: String,
        cursor: FixCursor,
    )

    fun clear()
}

/** The test/default in-memory cursor store. */
class InMemorySamplingCursorStore : SamplingCursorStore {
    private var day: String? = null
    private var cursor: FixCursor? = null

    override fun load(dayDate: String): FixCursor? = if (day == dayDate) cursor else null

    override fun save(
        dayDate: String,
        cursor: FixCursor,
    ) {
        this.day = dayDate
        this.cursor = cursor
    }

    override fun clear() {
        day = null
        cursor = null
    }
}

// The cursor shares the detection prefs file (monreleve.detection), so DetectionModeStore.clear() on sign-out
// and deletion wipes it with the mode (ErasureCensusTest already covers that store name), and mode-off clears
// it explicitly. No coordinate: only a day string, a side name, and an epoch.
private const val DETECTION_PREFS = "monreleve.detection"
private const val KEY_CURSOR_DAY = "cursorDay"
private const val KEY_CURSOR_SIDE = "cursorSide"
private const val KEY_CURSOR_EPOCH = "cursorEpoch"

class SharedPrefsSamplingCursorStore(context: Context) : SamplingCursorStore {
    private val prefs = context.applicationContext.getSharedPreferences(DETECTION_PREFS, Context.MODE_PRIVATE)

    @Suppress("ReturnCount") // each early return is a distinct "no valid cursor" reason; failing closed to null
    override fun load(dayDate: String): FixCursor? {
        if (prefs.getString(KEY_CURSOR_DAY, null) != dayDate) return null
        val side = prefs.getString(KEY_CURSOR_SIDE, null) ?: return null
        val classification = runCatching { Classification.valueOf(side) }.getOrNull() ?: return null
        val epoch = prefs.getLong(KEY_CURSOR_EPOCH, Long.MIN_VALUE)
        if (epoch == Long.MIN_VALUE) return null
        return FixCursor(classification, epoch)
    }

    override fun save(
        dayDate: String,
        cursor: FixCursor,
    ) {
        prefs.edit()
            .putString(KEY_CURSOR_DAY, dayDate)
            .putString(KEY_CURSOR_SIDE, cursor.lastSide.name)
            .putLong(KEY_CURSOR_EPOCH, cursor.lastEpochMillis)
            .commit()
    }

    override fun clear() {
        prefs.edit()
            .remove(KEY_CURSOR_DAY)
            .remove(KEY_CURSOR_SIDE)
            .remove(KEY_CURSOR_EPOCH)
            .commit()
    }
}
