package ch.monreleve.app.notification

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.repo.RecordCommand

// AN-NOTIF (R339). The evening notification's RECEIVER LOGIC, pure and JVM-testable (R291), separate from the
// Android BroadcastReceiver glue that parses the intent and performs the write (EveningActionReceiver).
//
// R339 (ratified product decision, supersedes one line of R323): A NOTIFICATION BUTTON MAY RECORD THE DAY. D16
// still holds exactly - nothing is written without the person's tap; a tap on a clearly labelled notification
// button IS that tap, and D16 never required the tap to happen inside the app. So this returns a RecordCommand to
// be written through the ONE repository path (R206: no second writer), never a direct DAO write.
//
// IT LIVES OUTSIDE detection/ (Fence 7, D16): detection/ may never reach EntryRepository/RecordCommand - a
// proposal is a value, only a tap records. This package is that tap's home, the peer of aujourdhui/ and calendar/.
//
// EVERY "MUST NEVER HAPPEN" CASE IN THE PROMPT'S SECTION 3 THAT IS A DECISION IS A BRANCH HERE, in security order:
//   - WRONG ACCOUNT (R303): the button carries the account it was shown for; a different (or absent) account
//     signed in now writes nothing. Checked FIRST - it is the security gate.
//   - FUTURE / OTHER DAY: only today may be written. A notification left overnight, or any day != today, writes
//     nothing (there is no path to a future day - the button only ever records the day it was shown for, gated
//     on that day still being today).
//   - STALE TAP over a newer entry: if the day already has an entry (recorded by any path - app, calendar,
//     another button), nothing is written; the glue shows the existing value.

/** What a recording button carries: the day and account it was shown for, and what it would record. */
data class EveningTap(
    val shownForDay: String,
    val shownForAccount: String?,
    val kind: EntryKind,
    val provenance: Provenance,
    /** The side detection proposed, kept for a DETECTED_CONFIRMED/CORRECTED record (R202); null for a manual tap. */
    val detectedKind: EntryKind?,
)

/** Record through the one repository path, or write nothing and say why. */
sealed interface EveningTapResult {
    data class Record(val command: RecordCommand) : EveningTapResult

    data class Ignore(val reason: EveningTapRefused) : EveningTapResult
}

/** Why a tap wrote nothing - each a section-3 "must never happen" case. */
enum class EveningTapRefused {
    WRONG_ACCOUNT,
    NOT_TODAY,
    ALREADY_RECORDED,
}

/**
 * The receiver's decision. Returns the RecordCommand the in-app tap would build (R206) when the tap is for the
 * current account, for today, on a day with no entry yet; otherwise Ignore with the reason. `claimNow` is the
 * device's clock at the tap, used verbatim for detectedAt on a detection confirm/correct (never trusted as
 * evidence - the server assigns the recording timestamp, R275). clientMutationId (AN5), the account tag (R303)
 * and clientClaimedAt (R275) are stamped by the repository when it writes the returned command, exactly as for
 * an in-app tap.
 *
 * Each return is one section-3 refusal, read top-to-bottom in security order, then the record: the guard-clause
 * shape is the clearest reading of "fail closed on any of these", so ReturnCount is suppressed as elsewhere.
 */
@Suppress("ReturnCount")
fun decideEveningTap(
    tap: EveningTap,
    currentAccount: String?,
    today: String,
    hasEntryForShownDay: Boolean,
    claimNow: String,
): EveningTapResult {
    if (tap.shownForAccount != currentAccount) return EveningTapResult.Ignore(EveningTapRefused.WRONG_ACCOUNT)
    if (tap.shownForDay != today) return EveningTapResult.Ignore(EveningTapRefused.NOT_TODAY)
    if (hasEntryForShownDay) return EveningTapResult.Ignore(EveningTapRefused.ALREADY_RECORDED)
    // A manual tap carries no detection; a confirm/correct carries the proposed side and the tap's time.
    val detectedAt = if (tap.provenance == Provenance.MANUAL) null else claimNow
    return EveningTapResult.Record(
        RecordCommand(
            dayDate = tap.shownForDay,
            kind = tap.kind,
            portion = Portion.FULL,
            provenance = tap.provenance,
            detectedKind = tap.detectedKind,
            detectedAt = detectedAt,
        ),
    )
}
