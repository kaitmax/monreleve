package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

// R323 / PARKAN-36. The evening proposal notification's PURE decision, tested before the Android glue around it.
// The rules, each a gate that returns null (no notification): AT MOST ONE per working day, AFTER the day
// concludes, ONLY if the day has no entry yet, NEVER on a non-working day, only in auto mode, and only when the
// person has opted in. A concluded working day with a HIGH proposal notifies its side (En Suisse / Domicile);
// one that is not sure invites manual recording (R312 spirit) - the same single notification. The decision is a
// value: nothing is recorded (D16), no coordinate is touched (D18); tapping only opens Aujourd'hui.

private val proposedCh = DetectionOutcome.Proposed(Proposal(Tier.HIGH, EntryKind.CH, Portion.FULL))
private val proposedHome = DetectionOutcome.Proposed(Proposal(Tier.HIGH, EntryKind.HOME, Portion.FULL))

@Suppress("LongParameterList") // a test helper with named defaults, one per condition the decision reads
private fun decide(
    optedIn: Boolean = true,
    autoMode: Boolean = true,
    workingDay: Boolean = true,
    hasEntryToday: Boolean = false,
    dayConcluded: Boolean = true,
    alreadyNotified: Boolean = false,
    outcome: DetectionOutcome = proposedCh,
) = eveningDecision(
    EveningConditions(optedIn, autoMode, workingDay, hasEntryToday, dayConcluded, alreadyNotified),
    outcome,
)

class EveningNotificationDecisionTest : FunSpec({
    test("a concluded working day with a HIGH proposal and no entry notifies the proposed side") {
        decide(outcome = proposedCh) shouldBe EveningNotice.Proposed(EntryKind.CH)
        decide(outcome = proposedHome) shouldBe EveningNotice.Proposed(EntryKind.HOME)
    }

    test("a concluded working day that is not sure invites manual recording - the same single notification") {
        decide(outcome = DetectionOutcome.NotSure) shouldBe EveningNotice.NotSure
    }

    test("opt-out never notifies") {
        decide(optedIn = false).shouldBeNull()
    }

    test("manual mode notifies with the manual question (R339) - no detection proposal needed") {
        decide(autoMode = false) shouldBe EveningNotice.Manual
        // The outcome is ignored in manual mode: there is no detection, so the question is asked regardless.
        decide(autoMode = false, outcome = DetectionOutcome.NotSure) shouldBe EveningNotice.Manual
    }

    test("never on a non-working day") {
        decide(workingDay = false).shouldBeNull()
    }

    test("only if the day has no entry yet") {
        decide(hasEntryToday = true).shouldBeNull()
    }

    test("only after the day concludes") {
        decide(dayConcluded = false).shouldBeNull()
    }

    test("at most one per working day - a day already notified is not notified again") {
        decide(alreadyNotified = true).shouldBeNull()
    }

    test("isWorkingDay is Monday..Friday - weekends are non-working (the calendar's convention)") {
        (1..5).forEach { isWorkingDay(it) shouldBe true } // Monday..Friday
        isWorkingDay(6) shouldBe false // Saturday
        isWorkingDay(7) shouldBe false // Sunday
    }
})
