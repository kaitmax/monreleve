package ch.monreleve.app.detection

import kotlin.math.roundToInt

// AN-AUTO increment 4. The LIVE sampler's incremental tally.
//
// WHY INCREMENTAL. The background sampler wakes periodically (WorkManager), each wake a separate process
// invocation - it cannot hold a day's fixes in memory across wakes and process death. SPEC 13.1 is explicit
// that Room stores ONLY the aggregate tally ("no movement timeline"), so the fix sequence cannot be persisted
// either. The tally is therefore accumulated one fix at a time from the running aggregate (TallyEntity in Room)
// plus a tiny cursor - the PREVIOUS fix's SIDE and timestamp.
//
// NO COORDINATE, D18. FixCursor holds a Classification (INSIDE/OUTSIDE/BUFFER) and a Long epoch - never a
// coordinate. It is the minimal state needed to attribute the next gap; it is a single last value, not a
// history, and it is cleared on mode-off and sign-out with the mode cache.
//
// EXACTLY THE BATCH TALLY AT THE SAMPLING CADENCE. computeTally attributes the gap after each fix to that
// fix's side, then FOLDS sub-10-minute excursions (D26). The sampler fixes are >= SAMPLE_INTERVAL_MINUTES (15)
// apart, so every gap is >= the 10-minute fold threshold and the fold never triggers - which makes this
// gap-attribution produce EXACTLY computeTally's result. LiveTallyTest asserts that equality over the shapes
// the sampler meets; the batch computeTally remains the single source of truth for the end-of-day proposal.

private const val MILLIS_PER_MINUTE = 60_000.0

/**
 * Fold one classified fix into the running tally (FixCursor lives in Tally.kt, beside DailyTally). The gap
 * since the previous fix is attributed to the PREVIOUS fix's side (INSIDE -> Switzerland, OUTSIDE -> elsewhere,
 * BUFFER -> neither); the new fix becomes the cursor for the next gap. The first fix (no cursor) adds no
 * minutes. Returns the new tally and cursor.
 */
fun accumulateFix(
    tally: DailyTally,
    cursor: FixCursor?,
    classification: Classification,
    epochMillis: Long,
): Pair<DailyTally, FixCursor> {
    val gapMinutes = cursor?.let { ((epochMillis - it.lastEpochMillis) / MILLIS_PER_MINUTE).roundToInt() } ?: 0
    val addSwitzerland = if (cursor?.lastSide == Classification.INSIDE) gapMinutes else 0
    val addElsewhere = if (cursor?.lastSide == Classification.OUTSIDE) gapMinutes else 0
    val addBuffer = if (classification == Classification.BUFFER) 1 else 0
    val next =
        tally.copy(
            minutesSwitzerland = tally.minutesSwitzerland + addSwitzerland,
            minutesElsewhere = tally.minutesElsewhere + addElsewhere,
            fixCount = tally.fixCount + 1,
            bufferFixCount = tally.bufferFixCount + addBuffer,
        )
    return next to FixCursor(classification, epochMillis)
}
