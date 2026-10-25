package ch.monreleve.app.notification

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.repo.DayGranularity
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
//
// AN-GRANULARITY-DRIVE (R576): the decision now takes the setting's granularity, and the device's three facts at the
// tap (the account, the day, the clock) as one TapMoment. Every test written before R576 ran in whole-day mode - the
// only mode the decision knew - so each passes WHOLE_DAY and reads its one FULL command as `commands.single()`: a
// whole-day decision that grew a second row could not pass them. Their assertions are otherwise unchanged.

private const val ACCOUNT = "acct-A"
private const val TODAY = "2026-10-06"
private const val CLAIM = "2026-10-06T18:30:00+02:00"

/** The device at the tap: [ACCOUNT] signed in, [TODAY] in Paris, the clock reading [CLAIM]. */
private val AT_THE_TAP = TapMoment(currentAccount = ACCOUNT, today = TODAY, claimNow = CLAIM)
private val WHOLE_DAY = DayGranularity.WHOLE_DAY
private val HALF_DAYS = DayGranularity.HALF_DAYS

/** The decision for an empty [TODAY] in whole-day mode, at [AT_THE_TAP] - the shape most tests below ask about. */
private fun decideWhole(tap: EveningTap): EveningTapResult =
    decideEveningTap(tap, AT_THE_TAP, hasEntryForShownDay = false, WHOLE_DAY)

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
        decideWhole(manualTap(EntryKind.CH)) shouldBe
            EveningTapResult.Record(
                listOf(
                    RecordCommand(
                        dayDate = TODAY,
                        kind = EntryKind.CH,
                        portion = Portion.FULL,
                        provenance = Provenance.MANUAL,
                        detectedKind = null,
                        detectedAt = null,
                    ),
                ),
            )
    }

    test("manual Domicile records a full HOME day, MANUAL") {
        val record = decideWhole(manualTap(EntryKind.HOME))
        val command = (record as EveningTapResult.Record).commands.single()
        command.kind shouldBe EntryKind.HOME
        command.provenance shouldBe Provenance.MANUAL
        command.detectedAt shouldBe null
    }

    test("Confirmer records DETECTED_CONFIRMED with the proposed side and the tap's time (R202/R314)") {
        val record = decideWhole(confirmTap(EntryKind.HOME))
        val command = (record as EveningTapResult.Record).commands.single()
        command.kind shouldBe EntryKind.HOME
        command.provenance shouldBe Provenance.DETECTED_CONFIRMED
        command.detectedKind shouldBe EntryKind.HOME
        command.detectedAt shouldBe CLAIM
    }

    test("the other likely kind records DETECTED_CORRECTED keeping the detected side (R202)") {
        val record = decideWhole(correctTap(EntryKind.CH, EntryKind.HOME))
        val command = (record as EveningTapResult.Record).commands.single()
        command.kind shouldBe EntryKind.CH
        command.provenance shouldBe Provenance.DETECTED_CORRECTED
        command.detectedKind shouldBe EntryKind.HOME
        command.detectedAt shouldBe CLAIM
    }

    test("a record carries the day the button was shown for") {
        val record = decideWhole(manualTap(EntryKind.CH))
        (record as EveningTapResult.Record).commands.single().dayDate shouldBe TODAY
    }

    // AN-GRANULARITY-DRIVE (R576): in half-day mode the empty day is a morning and an afternoon, each the whole tap -
    // the same kind, provenance, detected side and time - so neither half says less than the one FULL row did.
    test("R576 - half-day mode: the empty day is decided as AM then PM, each carrying the whole tap") {
        val record = decideEveningTap(confirmTap(EntryKind.HOME), AT_THE_TAP, hasEntryForShownDay = false, HALF_DAYS)
        (record as EveningTapResult.Record).commands shouldBe
            listOf(Portion.AM, Portion.PM).map { portion ->
                RecordCommand(
                    dayDate = TODAY,
                    kind = EntryKind.HOME,
                    portion = portion,
                    provenance = Provenance.DETECTED_CONFIRMED,
                    detectedKind = EntryKind.HOME,
                    detectedAt = CLAIM,
                )
            }
    }

    // Section 3 - a record for the WRONG ACCOUNT (R303): the button carries the account it was shown for.
    test("a different account signed in writes nothing (R303)") {
        decideEveningTap(
            manualTap(EntryKind.CH),
            AT_THE_TAP.copy(currentAccount = "acct-B"),
            hasEntryForShownDay = false,
            WHOLE_DAY,
        ) shouldBe EveningTapResult.Ignore(EveningTapRefused.WRONG_ACCOUNT)
    }

    test("no account signed in writes nothing (fail closed)") {
        decideEveningTap(
            manualTap(EntryKind.CH),
            AT_THE_TAP.copy(currentAccount = null),
            hasEntryForShownDay = false,
            WHOLE_DAY,
        ) shouldBe EveningTapResult.Ignore(EveningTapRefused.WRONG_ACCOUNT)
    }

    // Section 3 - a record for a FUTURE DAY, or a day OTHER THAN the one shown: only today may be written.
    test("a notification left overnight writes nothing once the day has rolled over") {
        decideWhole(manualTap(EntryKind.CH).copy(shownForDay = "2026-10-05")) shouldBe
            EveningTapResult.Ignore(EveningTapRefused.NOT_TODAY)
    }

    test("a button that names a future day writes nothing") {
        decideWhole(manualTap(EntryKind.CH).copy(shownForDay = "2026-10-07")) shouldBe
            EveningTapResult.Ignore(EveningTapRefused.NOT_TODAY)
    }

    // Section 3 - a STALE TAP must not overwrite a newer entry: if the day already has one, write nothing.
    test("the day already has an entry: nothing is written (stale tap, the notification shows the existing value)") {
        decideEveningTap(manualTap(EntryKind.CH), AT_THE_TAP, hasEntryForShownDay = true, WHOLE_DAY) shouldBe
            EveningTapResult.Ignore(EveningTapRefused.ALREADY_RECORDED)
    }

    test("the account gate runs first: a wrong account is refused even with a stale day and an existing entry") {
        decideEveningTap(
            manualTap(EntryKind.CH).copy(shownForDay = "2026-10-05"),
            AT_THE_TAP.copy(currentAccount = "acct-B"),
            hasEntryForShownDay = true,
            WHOLE_DAY,
        ) shouldBe EveningTapResult.Ignore(EveningTapRefused.WRONG_ACCOUNT)
    }
})
