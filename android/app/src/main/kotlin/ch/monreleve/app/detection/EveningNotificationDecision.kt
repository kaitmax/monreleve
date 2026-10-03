package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind

// R323 / PARKAN-36. The evening proposal notification's DECISION, pure and separate from the Android glue that
// gathers its inputs (EveningNotification.kt) and posts it (EveningNotifier.kt). SPEC 13.3's reminder was parked
// as a server/FCM feature; this is a LOCAL notification that needs no server.
//
// THE RULES, each a gate (SPEC 13.3 / the AN-NEXT prompt): AT MOST ONE per working day; AFTER the day concludes
// (afterLastCheckWindow); ONLY if the day has no entry yet; NEVER on a non-working day; only while automatic
// detection is on (the proposal it carries comes from detection - without it there is nothing to propose, and a
// manual-mode daily reminder is the parked FCM feature R282 still forbids naming); and only when the person has
// opted in (separate from the detection toggle, off by default). No second reminder, no streak, no "you forgot".
//
// NOTHING HERE RECORDS A DAY (D16) AND NO COORDINATE IS TOUCHED (D18): the result is a value, and tapping the
// notification only opens Aujourd'hui.

/** What the single evening notification says. A HIGH day names its side; anything else invites manual recording. */
sealed interface EveningNotice {
    /** A HIGH-tier day (R311): the proposed side, CH (En Suisse) or HOME (Domicile). */
    data class Proposed(val kind: EntryKind) : EveningNotice

    /** A concluded day that cannot be proposed with confidence (MEDIUM/LOW/no data): invite manual recording. */
    data object NotSure : EveningNotice
}

/** The six conditions the decision reads, bundled so the rule is one readable guard rather than a boolean list. */
data class EveningConditions(
    val optedIn: Boolean,
    val autoMode: Boolean,
    val workingDay: Boolean,
    val hasEntryToday: Boolean,
    val dayConcluded: Boolean,
    val alreadyNotified: Boolean,
) {
    /**
     * All six rules satisfied: opted in, automatic detection on, a concluded working day with no entry yet, and
     * not already fired today. Expressed as a list so no single condition is complex (detekt ComplexCondition).
     */
    fun permitsNotification(): Boolean {
        val rules = listOf(optedIn, autoMode, workingDay, !hasEntryToday, dayConcluded, !alreadyNotified)
        return rules.all { it }
    }
}

/**
 * The one evening notification for TODAY, or null when any rule says not to. A HIGH proposal (DetectionOutcome
 * .Proposed under R311) carries its side; a withheld/absent proposal that still reaches a concluded working day
 * invites manual recording (the same single notification - never a guess, D16).
 */
fun eveningDecision(
    conditions: EveningConditions,
    outcome: DetectionOutcome,
): EveningNotice? {
    if (!conditions.permitsNotification()) return null
    return when (outcome) {
        is DetectionOutcome.Proposed -> EveningNotice.Proposed(outcome.proposal.kind)
        DetectionOutcome.NotSure -> EveningNotice.NotSure
    }
}

/** A working day is a weekday; weekends are non-working, the same convention the calendar uses (R206-adjacent). */
fun isWorkingDay(dayOfWeekValue: Int): Boolean = dayOfWeekValue in WORKING_DAYS

// java.time.DayOfWeek.value is 1 (Monday) .. 7 (Sunday); Saturday (6) and Sunday (7) are non-working. Taken as
// Ints so this stays a pure function the JVM test reaches without constructing a platform DayOfWeek.
private val WORKING_DAYS = 1..5
