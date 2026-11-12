package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind

// R323 / PARKAN-36, extended by AN-NOTIF (R339). The evening notification's DECISION, pure and separate from the
// Android glue that gathers its inputs (EveningNotification.kt) and posts it (EveningNotifier.kt). A LOCAL
// notification that needs no server.
//
// R339 (supersedes R323's "only in auto mode" reading): the notification now ASKS in manual mode, not only
// proposes in auto mode. SPEC 13.3's reminder addresses both; R323 gated on auto because its notification carried
// a DETECTION PROPOSAL (nothing to propose without detection). R339's notification can ask the one question
// instead, so it serves the manual user too - the commonest case for "a support, not something to open daily".
//
// THE RULES, each a gate (SPEC 13.3 / the AN-NOTIF prompt): AT MOST ONE per working day; AFTER the day concludes
// (auto) or at the reminder time (manual); ONLY if the day has no entry yet; NEVER on a non-working day; only when
// the person has opted in (separate from the detection toggle, off by default). No second reminder, no streak, no
// "you forgot". The MODE then chooses what it says: manual -> the question; auto HIGH -> the proposal; auto
// otherwise -> the not-sure invitation.
//
// NOTHING HERE RECORDS A DAY (D16) AND NO COORDINATE IS TOUCHED (D18): the result is a value; recording is the
// person's tap on a button (EveningActionReceiver), which R339 ratified as the tap D16 requires.

/** What the single evening notification says, by mode (R339). */
sealed interface EveningNotice {
    /** Auto mode, a HIGH-tier day (R311): the proposed side, CH (En Suisse) or HOME (Domicile). Confirm/correct. */
    data class Proposed(val kind: EntryKind) : EveningNotice

    /** Auto mode, a day that cannot be proposed with confidence (MEDIUM/LOW/no data): the not-sure invitation. */
    data object NotSure : EveningNotice

    /** Manual mode (R339): the one evening question, « Où avez-vous travaillé ? », with the two side buttons. */
    data object Manual : EveningNotice
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
     * The gates INDEPENDENT of mode (R339): opted in, a working day, no entry yet, the day concluded/at reminder
     * time, and not already fired today. autoMode is NOT a gate any more - it selects WHAT is said, not WHETHER.
     * Expressed as a list so no single condition is complex (detekt ComplexCondition).
     */
    fun permitsNotification(): Boolean {
        val rules = listOf(optedIn, workingDay, !hasEntryToday, dayConcluded, !alreadyNotified)
        return rules.all { it }
    }
}

/**
 * The one evening notification for TODAY, or null when any rule says not to. Manual mode asks the question
 * (EveningNotice.Manual); auto mode with a HIGH proposal (DetectionOutcome.Proposed under R311) carries its side;
 * auto mode otherwise invites manual recording (NotSure). Never a guess (D16) - the person's tap records.
 */
fun eveningDecision(
    conditions: EveningConditions,
    outcome: DetectionOutcome,
): EveningNotice? {
    if (!conditions.permitsNotification()) return null
    return when {
        !conditions.autoMode -> EveningNotice.Manual
        outcome is DetectionOutcome.Proposed -> EveningNotice.Proposed(outcome.proposal.kind)
        else -> EveningNotice.NotSure
    }
}

/** A working day is a weekday; weekends are non-working, the same convention the calendar uses (R206-adjacent). */
fun isWorkingDay(dayOfWeekValue: Int): Boolean = dayOfWeekValue in WORKING_DAYS

// java.time.DayOfWeek.value is 1 (Monday) .. 7 (Sunday); Saturday (6) and Sunday (7) are non-working. Taken as
// Ints so this stays a pure function the JVM test reaches without constructing a platform DayOfWeek.
private val WORKING_DAYS = 1..5
