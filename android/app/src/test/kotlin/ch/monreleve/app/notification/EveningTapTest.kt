package ch.monreleve.app.notification

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.repo.RecordCommand
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// AN-NOTIF (R339). The RECEIVER'S PURE DECISION, tested before the Android glue around it (R291). R339 ratified
// that a notification button MAY record the day: D16 still holds exactly - nothing is written without the
// person's tap, and a tap on a clearly labelled button IS that tap. This class decides, from the tap and the
// day's facts, whether to RECORD (through the one repository path, R206) or to WRITE NOTHING. Every "must never
// happen" case in the prompt's section 3 that is a decision - wrong account (R303), future/other day, a stale
// tap over a newer entry - is a branch here and is tested here. It records through the SAME RecordCommand the
// in-app tap builds (R206): clientMutationId is born at the tap (AN5) and the account tag (R303) and
// clientClaimedAt (R275) are stamped by the repository; detectedAt (for a detection confirm/correct) is the tap.

private const val ACCOUNT = "acct-A"
private const val TODAY = "2026-10-06"
private const val CLAIM = "2026-10-06T18:30:00+02:00"

private fun manualTap(kind: EntryKind) =
    EveningTap(
        shownForDay = TODAY,
        shownForAccount = ACCOUNT,
        kind = kind,
        provenance = Provenance.MANUAL,
        detectedKind = null,
    )

private fun confirmTap(proposed: EntryKind) =
    EveningTap(
        shownForDay = TODAY,
        shownForAccount = ACCOUNT,
        kind = proposed,
        provenance = Provenance.DETECTED_CONFIRMED,
        detectedKind = proposed,
    )

private fun correctTap(
    chosen: EntryKind,
    proposed: EntryKind,
) = EveningTap(
    shownForDay = TODAY,
    shownForAccount = ACCOUNT,
    kind = chosen,
    provenance = Provenance.DETECTED_CORRECTED,
    detectedKind = proposed,
)

class EveningTapTest : FunSpec({
    test("manual En Suisse records a full CH day, MANUAL, with no detection") {
        decideEveningTap(manualTap(EntryKind.CH), ACCOUNT, TODAY, hasEntryForShownDay = false, CLAIM) shouldBe
            EveningTapResult.Record(
                RecordCommand(
                    dayDate = TODAY,
                    kind = EntryKind.CH,
                    portion = Portion.FULL,
                    provenance = Provenance.MANUAL,
                    detectedKind = null,
                    detectedAt = null,
                ),
            )
    }

    test("manual Domicile records a full HOME day, MANUAL") {
        val record = decideEveningTap(manualTap(EntryKind.HOME), ACCOUNT, TODAY, hasEntryForShownDay = false, CLAIM)
        val command = (record as EveningTapResult.Record).command
        command.kind shouldBe EntryKind.HOME
        command.provenance shouldBe Provenance.MANUAL
        command.detectedAt shouldBe null
    }

    test("Confirmer records DETECTED_CONFIRMED with the proposed side and the tap's time (R202/R314)") {
        val record = decideEveningTap(confirmTap(EntryKind.HOME), ACCOUNT, TODAY, hasEntryForShownDay = false, CLAIM)
        val command = (record as EveningTapResult.Record).command
        command.kind shouldBe EntryKind.HOME
        command.provenance shouldBe Provenance.DETECTED_CONFIRMED
        command.detectedKind shouldBe EntryKind.HOME
        command.detectedAt shouldBe CLAIM
    }

    test("the other likely kind records DETECTED_CORRECTED keeping the detected side (R202)") {
        val record =
            decideEveningTap(
                correctTap(EntryKind.CH, EntryKind.HOME),
                ACCOUNT,
                TODAY,
                hasEntryForShownDay = false,
                CLAIM,
            )
        val command = (record as EveningTapResult.Record).command
        command.kind shouldBe EntryKind.CH
        command.provenance shouldBe Provenance.DETECTED_CORRECTED
        command.detectedKind shouldBe EntryKind.HOME
        command.detectedAt shouldBe CLAIM
    }

    test("a record carries the day the button was shown for") {
        val record = decideEveningTap(manualTap(EntryKind.CH), ACCOUNT, TODAY, hasEntryForShownDay = false, CLAIM)
        (record as EveningTapResult.Record).command.dayDate shouldBe TODAY
    }

    // Section 3 - a record for the WRONG ACCOUNT (R303): the button carries the account it was shown for.
    test("a different account signed in writes nothing (R303)") {
        decideEveningTap(manualTap(EntryKind.CH), "acct-B", TODAY, hasEntryForShownDay = false, CLAIM) shouldBe
            EveningTapResult.Ignore(EveningTapRefused.WRONG_ACCOUNT)
    }

    test("no account signed in writes nothing (fail closed)") {
        decideEveningTap(
            manualTap(EntryKind.CH),
            currentAccount = null,
            TODAY,
            hasEntryForShownDay = false,
            CLAIM,
        ) shouldBe EveningTapResult.Ignore(EveningTapRefused.WRONG_ACCOUNT)
    }

    // Section 3 - a record for a FUTURE DAY, or a day OTHER THAN the one shown: only today may be written.
    test("a notification left overnight writes nothing once the day has rolled over") {
        decideEveningTap(
            manualTap(EntryKind.CH).copy(shownForDay = "2026-10-05"),
            ACCOUNT,
            TODAY,
            hasEntryForShownDay = false,
            CLAIM,
        ) shouldBe EveningTapResult.Ignore(EveningTapRefused.NOT_TODAY)
    }

    test("a button that names a future day writes nothing") {
        decideEveningTap(
            manualTap(EntryKind.CH).copy(shownForDay = "2026-10-07"),
            ACCOUNT,
            TODAY,
            hasEntryForShownDay = false,
            CLAIM,
        ) shouldBe EveningTapResult.Ignore(EveningTapRefused.NOT_TODAY)
    }

    // Section 3 - a STALE TAP must not overwrite a newer entry: if the day already has one, write nothing.
    test("the day already has an entry: nothing is written (stale tap, the notification shows the existing value)") {
        decideEveningTap(manualTap(EntryKind.CH), ACCOUNT, TODAY, hasEntryForShownDay = true, CLAIM) shouldBe
            EveningTapResult.Ignore(EveningTapRefused.ALREADY_RECORDED)
    }

    test("the account gate runs first: a wrong account is refused even with a stale day and an existing entry") {
        decideEveningTap(
            manualTap(EntryKind.CH).copy(shownForDay = "2026-10-05"),
            "acct-B",
            TODAY,
            hasEntryForShownDay = true,
            CLAIM,
        ) shouldBe EveningTapResult.Ignore(EveningTapRefused.WRONG_ACCOUNT)
    }
})
