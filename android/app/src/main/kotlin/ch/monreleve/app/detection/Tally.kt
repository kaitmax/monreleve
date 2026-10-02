package ch.monreleve.app.detection

import kotlin.math.roundToInt

// AN6a increment 3. The day's tally, computed from a stream of ClassifiedFix with the
// hysteresis SPEC 13 (D26) requires - and NOTHING a coordinate could hide in.
//
// D26, NAMED. A change of side is provisional until it has persisted 10 minutes; a stay is
// significant after 30. Excursions shorter than 10 minutes are FOLDED BACK into the
// preceding side - that is the GPS-flicker guard for someone living a few km from Geneva.
// The tally's minute attribution turns on the 10-minute fold; the 30-minute mark is the
// stronger-confidence signal the tier reads (increment 4).
//
// MINUTES COME FROM THE FIXES' OWN TIMESTAMPS, never the wall clock: the gap between two
// successive fixes is attributed to the side of the earlier one. That is what lets a
// compressed replay of a day (increment 5) produce the tally a real day would.
//
// BUFFER CONTRIBUTES TO NEITHER SIDE. Buffer fixes are counted (they lower the tier) and
// their surrounding time is attributed to no tally - a fix near the line is not guessed onto
// a side.

const val HYSTERESIS_PROVISIONAL_MINUTES = 10.0

const val HYSTERESIS_SIGNIFICANT_MINUTES = 30.0

private const val MILLIS_PER_MINUTE = 60_000.0

/** A day's tally. No coordinate, by construction - only minutes, counts, and (later) a tier. */
data class DailyTally(
    val minutesSwitzerland: Int,
    val minutesElsewhere: Int,
    val fixCount: Int,
    val bufferFixCount: Int,
)

/**
 * AN-AUTO increment 4. The minimal coordinate-free cursor the LIVE incremental tally (accumulateFix,
 * LiveTally.kt) carries across WorkManager wakes: the PREVIOUS fix's side and timestamp. A single last value,
 * never a history, never a coordinate (D18). It lives beside DailyTally because it is the tally's running state.
 */
data class FixCursor(
    val lastSide: Classification,
    val lastEpochMillis: Long,
)

/**
 * The tally for a day's classified fixes. `fixes` are whatever the sampler recorded inside the
 * working window; this attributes the minutes between them, folds sub-10-minute excursions,
 * and counts buffer fixes.
 */
fun computeTally(fixes: List<ClassifiedFix>): DailyTally {
    val sorted = fixes.sortedBy { it.epochMillis }
    val bufferFixCount = sorted.count { it.classification == Classification.BUFFER }

    // The gap after each fix belongs to that fix's side.
    val intervals =
        sorted.zipWithNext { earlier, later ->
            IntervalMinutes((later.epochMillis - earlier.epochMillis) / MILLIS_PER_MINUTE, earlier.classification)
        }
    val folded = foldShortExcursions(mergeAdjacent(intervals))

    var switzerland = 0.0
    var elsewhere = 0.0
    for (run in folded) {
        when (run.side) {
            Classification.INSIDE -> switzerland += run.minutes
            Classification.OUTSIDE -> elsewhere += run.minutes
            Classification.BUFFER -> Unit
        }
    }
    return DailyTally(
        minutesSwitzerland = switzerland.roundToInt(),
        minutesElsewhere = elsewhere.roundToInt(),
        fixCount = sorted.size,
        bufferFixCount = bufferFixCount,
    )
}

private data class IntervalMinutes(val minutes: Double, val side: Classification)

private fun mergeAdjacent(intervals: List<IntervalMinutes>): List<IntervalMinutes> {
    val runs = mutableListOf<IntervalMinutes>()
    for (interval in intervals) {
        val last = runs.lastOrNull()
        if (last != null && last.side == interval.side) {
            runs[runs.size - 1] = last.copy(minutes = last.minutes + interval.minutes)
        } else {
            runs.add(interval)
        }
    }
    return runs
}

// Fold each sub-10-minute INSIDE/OUTSIDE run into the preceding run (attributing its minutes
// to that side), then let the run that follows merge back in. BUFFER runs are never folded.
private fun foldShortExcursions(runs: List<IntervalMinutes>): List<IntervalMinutes> {
    val result = mutableListOf<IntervalMinutes>()
    for (run in runs) {
        val isSideRun = run.side == Classification.INSIDE || run.side == Classification.OUTSIDE
        val isShort = run.minutes < HYSTERESIS_PROVISIONAL_MINUTES
        val previous = result.lastOrNull()
        if (isSideRun && isShort && previous != null) {
            result[result.size - 1] = previous.copy(minutes = previous.minutes + run.minutes)
        } else if (previous != null && previous.side == run.side) {
            result[result.size - 1] = previous.copy(minutes = previous.minutes + run.minutes)
        } else {
            result.add(run)
        }
    }
    return result
}
