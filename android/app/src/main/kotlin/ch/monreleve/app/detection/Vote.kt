package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import kotlin.math.max

// R320. FOUR CHECKS A DAY, AND A VOTE - the product decision that replaces the minutes-and-hysteresis tally
// (which assumed continuous sampling). AN6a's polygon and 150 m border-strip classifier are UNCHANGED
// (Classification stays INSIDE/OUTSIDE/BUFFER); only HOW A DAY IS DECIDED changes.
//
// THE VOTE (thresholds PROPOSED, R276/R320 - recorded in docs/detection-model.md, frozen when the field test
// starts):
//   HIGH    >= VOTE_MIN_CHECKS taken, ALL on the same side, none in the strip;
//   MEDIUM  >= VOTE_MIN_CHECKS taken, exactly one on the other side or in the strip;
//   LOW     anything else.
// One bad GPS reading can never decide a day on its own: a lone dissenter drops HIGH to MEDIUM, two drop it to
// LOW. Under R311 only HIGH proposes in the product; MEDIUM and LOW show the not-sure message.
//
// HALF-DAY GRANULARITY: each half is decided from ITS OWN two checks (AM = checks 1-2, PM = checks 3-4): both
// taken, both the same side, neither in the strip, or the half is not sure. Missions and absences are never
// detected - a proposal is only ever CH (En Suisse) or HOME (Domicile).
//
// NOTHING HERE WRITES AN ENTRY (D16). A Proposal is a value; only a confirming tap records.

/** A day needs at least this many checks taken to reach HIGH or MEDIUM (PROPOSED, R320). */
const val VOTE_MIN_CHECKS = 3

/** MEDIUM tolerates exactly this many dissenting checks - the other side, or the strip (PROPOSED, R320). */
const val MEDIUM_MAX_DISSENT = 1

/**
 * A day's four checks. null = the check was MISSED (no fix obtained inside its window). No coordinate - each
 * slot is only a Classification (INSIDE/OUTSIDE/BUFFER) or null, which is exactly what Room now holds.
 */
data class DayChecks(
    // around 09:30 Paris (morning)
    val check1: Classification?,
    // around 11:00 Paris (morning)
    val check2: Classification?,
    // around 14:30 Paris (afternoon)
    val check3: Classification?,
    // around 16:30 Paris (afternoon)
    val check4: Classification?,
) {
    /** The checks that were taken (a fix obtained), in order; MISSED checks are dropped. */
    fun taken(): List<Classification> = listOfNotNull(check1, check2, check3, check4)

    /** How many of the four windows produced no fix (MISSED). */
    fun missedCount(): Int = 4 - taken().size

    /** How many checks landed in the 150 m border strip - R313 reads this for near-border recognition. */
    fun stripCount(): Int = taken().count { it == Classification.BUFFER }

    /** A day with at least one check taken has data; a day with none is excluded from the near-border window. */
    fun hasData(): Boolean = taken().isNotEmpty()
}

/** The side that leads among the taken checks (CH if more inside, HOME if more outside), or null on a tie. */
private fun DayChecks.leadingSide(): EntryKind? {
    val taken = taken()
    val inside = taken.count { it == Classification.INSIDE }
    val outside = taken.count { it == Classification.OUTSIDE }
    return when {
        inside > outside -> EntryKind.CH
        outside > inside -> EntryKind.HOME
        else -> null
    }
}

/** HIGH / MEDIUM / LOW for the whole day, by the vote (R320). */
fun voteTier(checks: DayChecks): Tier {
    val taken = checks.taken()
    val n = taken.size
    val dominant = max(taken.count { it == Classification.INSIDE }, taken.count { it == Classification.OUTSIDE })
    return when {
        // >= 3 taken, all on the same side (dominant == n implies none in the strip).
        n >= VOTE_MIN_CHECKS && dominant == n -> Tier.HIGH
        // >= 3 taken, exactly one dissenter (the other side or the strip).
        n >= VOTE_MIN_CHECKS && dominant == n - MEDIUM_MAX_DISSENT -> Tier.MEDIUM
        else -> Tier.LOW
    }
}

/** The kind the day's vote proposes (CH/HOME), or null when the vote is LOW (withheld). */
fun votedKind(checks: DayChecks): EntryKind? = if (voteTier(checks) == Tier.LOW) null else checks.leadingSide()

/**
 * The whole-day proposal (day granularity), or null when withheld. A voted day is always a FULL day on the
 * winning side: a HIGH or MEDIUM vote needs >= 3 agreeing checks, spread across the working day.
 */
fun dayProposal(checks: DayChecks): Proposal? {
    val tier = voteTier(checks)
    val kind = votedKind(checks) ?: return null
    return Proposal(tier, kind, Portion.FULL)
}

/**
 * A half-day's decision from its own two checks: the side if BOTH are taken, BOTH the same side, and NEITHER is
 * in the strip; otherwise null (not sure). A decided half is as strong as a half can be, so it proposes under
 * R311; an undecided half shows the not-sure message.
 */
fun halfProposal(
    first: Classification?,
    second: Classification?,
    portion: Portion,
): Proposal? {
    val kind =
        when {
            first == Classification.INSIDE && second == Classification.INSIDE -> EntryKind.CH
            first == Classification.OUTSIDE && second == Classification.OUTSIDE -> EntryKind.HOME
            else -> null
        } ?: return null
    return Proposal(Tier.HIGH, kind, portion)
}

/** The morning proposal, from checks 1-2 (around 09:30 and 11:00), or null when not sure. */
fun morningProposal(checks: DayChecks): Proposal? = halfProposal(checks.check1, checks.check2, Portion.AM)

/** The afternoon proposal, from checks 3-4 (around 14:30 and 16:30), or null when not sure. */
fun afternoonProposal(checks: DayChecks): Proposal? = halfProposal(checks.check3, checks.check4, Portion.PM)
