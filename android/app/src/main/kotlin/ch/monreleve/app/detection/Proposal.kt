package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import kotlin.math.max

// AN6a increment 4. The tier, and the proposal - which is never a record (D16).
//
// THE TIER THRESHOLDS ARE ENCODED FROM docs/field-protocol-AN6b.md section 3, NOT CHOSEN
// (R276). Picking a threshold after seeing field data would be fitting the gate to the
// measurement. TierThresholdParityTest reads the six numbers back out of that document and
// fails if these constants drift from it (R181). The scoring harness (increment 6) reads the
// SAME constants, so a field run is scored against exactly what shipped.
//
// LOW WITHHOLDS. computeProposal returns null for LOW: no proposal, the day stays
// "Non renseigne", entered by hand. A LOW day that proposed anything is the confident guess
// SPEC 13 exists to prevent.
//
// MISSIONS AND ABSENCES ARE NEVER DETECTED. A proposal is only ever CH ("En Suisse") or HOME
// ("Domicile") - a trip abroad is a business fact, not a geographic one. ProposalTest asserts
// no tally can produce MISSION_FR/MISSION_THIRD/ABSENT.
//
// NOTHING HERE WRITES AN ENTRY (D16). A Proposal is a value; only the person's confirming tap
// creates a record. FencesTest fence 7 asserts detection/ never references the entry-write
// path (EntryRepository/RecordCommand).

// docs/field-protocol-AN6b.md section 3 - the tier table, encoded.
const val HIGH_SAMPLES_SHARE = 0.50
const val HIGH_BUFFER_SHARE = 0.20
const val HIGH_SIDE_SHARE = 0.85
const val MEDIUM_SAMPLES_SHARE = 0.25
const val MEDIUM_BUFFER_SHARE = 0.40
const val MEDIUM_SIDE_SHARE = 0.70

// The sampling cadence AN6a assumes for "share of samples expected" (SPEC 13.1: WorkManager
// periodic work runs no more often than every 15 minutes). Increment 5 samples at this rate.
const val SAMPLE_INTERVAL_MINUTES = 15

// SPEC 13.1 granularity: > 4h is a full day; 2-4h is a half day; under 2h is too thin to propose.
private const val FULL_DAY_MINUTES = 240
private const val HALF_DAY_MINUTES = 120

enum class Tier {
    HIGH,
    MEDIUM,
    LOW,
}

/** A day's proposal. kind is only ever CH or HOME (missions/absences are never detected). */
data class Proposal(
    val tier: Tier,
    val kind: EntryKind,
    val portion: Portion,
)

/** How many fixes a full working window would yield at the assumed cadence. */
fun expectedSamples(intervalMinutes: Int = SAMPLE_INTERVAL_MINUTES): Int {
    val windowMinutes = WORKING_WINDOW_END_MINUTE - WORKING_WINDOW_START_MINUTE
    return windowMinutes / intervalMinutes
}

/** HIGH / MEDIUM / LOW from the tally, by the field-protocol thresholds. */
fun computeTier(
    tally: DailyTally,
    expectedSamples: Int,
): Tier {
    val samplesShare = if (expectedSamples == 0) 0.0 else tally.fixCount.toDouble() / expectedSamples
    val bufferShare = if (tally.fixCount == 0) 1.0 else tally.bufferFixCount.toDouble() / tally.fixCount
    val attributed = tally.minutesSwitzerland + tally.minutesElsewhere
    val sideShare =
        if (attributed == 0) 0.0 else max(tally.minutesSwitzerland, tally.minutesElsewhere).toDouble() / attributed
    return when {
        samplesShare >= HIGH_SAMPLES_SHARE && bufferShare <= HIGH_BUFFER_SHARE && sideShare >= HIGH_SIDE_SHARE ->
            Tier.HIGH
        samplesShare >= MEDIUM_SAMPLES_SHARE && bufferShare <= MEDIUM_BUFFER_SHARE && sideShare >= MEDIUM_SIDE_SHARE ->
            Tier.MEDIUM
        else -> Tier.LOW
    }
}

/**
 * The proposal for a day, or null when it is withheld (LOW, no attributed time, or a stay too
 * short to be even a half day). HIGH/MEDIUM propose the winning side; the granularity rule sets
 * FULL / half day, and a half day's AM/PM is read from when the winning side's fixes fall.
 */
fun computeProposal(
    tally: DailyTally,
    fixes: List<ClassifiedFix>,
    dayDate: String,
    expectedSamples: Int = expectedSamples(),
): Proposal? {
    val tier = computeTier(tally, expectedSamples)
    val kind = proposedKind(tally, tier) ?: return null
    val insideWins = kind == EntryKind.CH
    val winningMinutes = if (insideWins) tally.minutesSwitzerland else tally.minutesElsewhere
    val portion = if (winningMinutes > FULL_DAY_MINUTES) Portion.FULL else halfDayPortion(fixes, insideWins, dayDate)
    return Proposal(tier, kind, portion)
}

/**
 * The kind a tally would propose, or null if withheld - the KIND half of a proposal, shared by
 * computeProposal and the field export so both agree. LOW withholds; a winning side under 2h is
 * too thin; otherwise the winning side (INSIDE -> CH, OUTSIDE -> HOME).
 */
fun proposedKind(
    tally: DailyTally,
    tier: Tier,
): EntryKind? {
    if (tier == Tier.LOW) return null
    val insideWins = tally.minutesSwitzerland >= tally.minutesElsewhere
    val winningMinutes = if (insideWins) tally.minutesSwitzerland else tally.minutesElsewhere
    return when {
        winningMinutes < HALF_DAY_MINUTES -> null
        insideWins -> EntryKind.CH
        else -> EntryKind.HOME
    }
}

private fun halfDayPortion(
    fixes: List<ClassifiedFix>,
    insideWins: Boolean,
    dayDate: String,
): Portion {
    val window = workingWindowParis(dayDate)
    val midpoint = (window.first + window.last) / 2
    val winningSide = if (insideWins) Classification.INSIDE else Classification.OUTSIDE
    val winning = fixes.filter { it.classification == winningSide }
    val morning = winning.count { it.epochMillis < midpoint }
    val afternoon = winning.size - morning
    return if (morning >= afternoon) Portion.AM else Portion.PM
}
