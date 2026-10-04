package ch.monreleve.app.detection

import ch.monreleve.app.data.local.TallyDao
import ch.monreleve.app.data.local.TallyEntity

// R320. The sampler's persistence step: write ONE check into the day's row. Called by each WorkManager wake that
// lands inside a check window whose slot is still empty (SamplingWorker). It never sees a coordinate - only a
// Classification (the fix was classified and discarded in LiveLocation, D18) and the window index. Room holds
// only the four check slots (SPEC 13.1 / D18): no coordinate, no movement timeline, no minutes.
//
// IDEMPOTENT PER WINDOW. recordCheck overwrites only the given window's slot and leaves the others; the worker
// checks the slot is empty before taking a fix, so a window is sampled once (the first wake inside it that gets a
// fix), and a MISSED window stays null. There is no cursor and no incremental state: a check is a discrete value.

// AN-NEXT-2 / R324. recordCheck also counts WHICH PROVIDER produced the check (GPS vs NETWORK), as two integers on
// the day's row - counts only, never a per-check provider label, never a coordinate, never an accuracy value (D18).
// The count is incremented only when a window's slot was EMPTY, so re-recording a window (which the worker's
// hasCheck guard prevents, but which stays safe here) never double-counts: gpsCheckCount + networkCheckCount always
// equals the number of checks taken.

/** Read the day's four checks from the stored row (an absent row -> all MISSED). No coordinate. */
fun TallyEntity.toDayChecks(): DayChecks =
    DayChecks(
        check1 = check1?.let(::classificationOrNull),
        check2 = check2?.let(::classificationOrNull),
        check3 = check3?.let(::classificationOrNull),
        check4 = check4?.let(::classificationOrNull),
    )

private fun classificationOrNull(name: String): Classification? {
    return runCatching { Classification.valueOf(name) }.getOrNull()
}

/** Whether the day's row already has a check recorded for the given window (1-4). */
fun TallyEntity?.hasCheck(windowIndex: Int): Boolean =
    when (windowIndex) {
        1 -> this?.check1 != null
        2 -> this?.check2 != null
        3 -> this?.check3 != null
        else -> this?.check4 != null
    }

/**
 * Write one classified check into the day's row, preserving the other slots, and COUNT which provider produced it
 * (R324). Pure over the DAO seam, so it is driven directly in DetectionSamplerTest with a fake DAO. No coordinate
 * and no accuracy value crosses this function - classification is INSIDE/OUTSIDE/BUFFER, the index names which
 * window it is, and the provider is a GPS/NETWORK label that becomes a count. The provider count is incremented
 * only when the window was previously EMPTY, so the invariant gpsCheckCount + networkCheckCount == checks taken
 * holds even if a window is re-recorded.
 */
suspend fun recordCheck(
    dao: TallyDao,
    dayDate: String,
    windowIndex: Int,
    classification: Classification,
    provider: FixProvider,
) {
    val existing = dao.byDay(dayDate)
    val name = classification.name
    val fillsEmptyWindow = !existing.hasCheck(windowIndex)
    val gpsIncrement = if (fillsEmptyWindow && provider == FixProvider.GPS) 1 else 0
    val networkIncrement = if (fillsEmptyWindow && provider == FixProvider.NETWORK) 1 else 0
    dao.upsert(
        TallyEntity(
            dayDate = dayDate,
            check1 = if (windowIndex == 1) name else existing?.check1,
            check2 = if (windowIndex == 2) name else existing?.check2,
            check3 = if (windowIndex == 3) name else existing?.check3,
            check4 = if (windowIndex == 4) name else existing?.check4,
            gpsCheckCount = (existing?.gpsCheckCount ?: 0) + gpsIncrement,
            networkCheckCount = (existing?.networkCheckCount ?: 0) + networkIncrement,
        ),
    )
}
