package ch.monreleve.app.notification

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.repo.DayGranularity
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.data.repo.dayGranularityOf
import ch.monreleve.app.data.repo.portionsToOffer
import ch.monreleve.app.settings.SettingsStore

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
//
// AN-GRANULARITY-DRIVE (R576, closing PARK-W2): THE NOTIFICATION FOLLOWS THE SETTING. It is just another writer, so
// R490 holds for it: the day it records is always EMPTY (the stale-tap branch above refuses any day with a row), and
// an empty day takes the setting's granularity - one FULL row in whole-day mode, a morning and an afternoon of the
// kind tapped in half-day mode. It used to write one FULL row whatever the setting, which in half-day mode made a day
// held whole that R490 never lets be split (PARK-W1). The portions come from the record path's own rule
// (DayGranularity.portionsToOffer), and every row is written through the repository that refuses to break it (R492):
// a row of the other granularity arriving between the check and the write is refused there, never written beside it.

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
    /** R576: one command per row the empty day takes - FULL in whole-day mode, AM then PM in half-day mode. */
    data class Record(val commands: List<RecordCommand>) : EveningTapResult

    data class Ignore(val reason: EveningTapRefused) : EveningTapResult
}

/** Why a tap wrote nothing - each a section-3 "must never happen" case. */
enum class EveningTapRefused {
    WRONG_ACCOUNT,
    NOT_TODAY,
    ALREADY_RECORDED,
}

/**
 * What the device says when a button is tapped - who is signed in ([currentAccount]), which day it is in Paris
 * ([today]), and the device's clock ([claimNow], used verbatim for detectedAt on a detection confirm/correct, never
 * trusted as evidence - the server assigns the recording timestamp, R275). The receiver reads all three at the tap.
 * AN-GRANULARITY-DRIVE (R576): one value, so the decision could take the setting without growing a sixth parameter.
 */
data class TapMoment(
    val currentAccount: String?,
    val today: String,
    val claimNow: String,
)

/**
 * The receiver's decision. Returns the RecordCommands the in-app tap would build (R206) when the tap is for the
 * account signed in [at] the tap, for that day, on a day with no entry yet - one per portion [setting] gives an empty
 * day (R576); otherwise Ignore with the reason. clientMutationId (AN5), the account tag (R303) and clientClaimedAt
 * (R275) are stamped by the repository when it writes each returned command, exactly as for an in-app tap.
 *
 * Each return is one section-3 refusal, read top-to-bottom in security order, then the record: the guard-clause
 * shape is the clearest reading of "fail closed on any of these", so ReturnCount is suppressed as elsewhere.
 */
@Suppress("ReturnCount")
fun decideEveningTap(
    tap: EveningTap,
    at: TapMoment,
    hasEntryForShownDay: Boolean,
    setting: DayGranularity,
): EveningTapResult {
    if (tap.shownForAccount != at.currentAccount) return EveningTapResult.Ignore(EveningTapRefused.WRONG_ACCOUNT)
    if (tap.shownForDay != at.today) return EveningTapResult.Ignore(EveningTapRefused.NOT_TODAY)
    if (hasEntryForShownDay) return EveningTapResult.Ignore(EveningTapRefused.ALREADY_RECORDED)
    // A manual tap carries no detection; a confirm/correct carries the proposed side and the tap's time.
    val detectedAt = if (tap.provenance == Provenance.MANUAL) null else at.claimNow
    // R576: the day is EMPTY here (the stale-tap branch above), so it takes the setting's portions - asked of the
    // record path's own rule (DayGranularity.kt), the function every screen asks, never a portion chosen here.
    return EveningTapResult.Record(
        portionsToOffer(held = emptyList(), setting).map { portion ->
            RecordCommand(
                dayDate = tap.shownForDay,
                kind = tap.kind,
                portion = portion,
                provenance = tap.provenance,
                detectedKind = tap.detectedKind,
                detectedAt = detectedAt,
            )
        },
    )
}

/** R576: what the receiver's write did, for the glue to turn into a notification. */
sealed interface EveningWrite {
    /** The decision refused the tap ([reason]): nothing was written. */
    data class Ignored(val reason: EveningTapRefused) : EveningWrite

    /** Every row the day takes was written, each through the record path; the confirmation names the first. */
    data class Recorded(val commands: List<RecordCommand>) : EveningWrite

    /**
     * R492's record path refused at least one row: a row of the other granularity arrived between the check and the
     * write, and nothing is written beside it. [written] rows went in before the refusal - a sync is owed for them.
     */
    data class Refused(val written: Int) : EveningWrite
}

/**
 * R576: THE RECEIVER'S WRITE, everything but the Android glue (EveningActionReceiver), so a JVM test drives the real
 * repository through it. [deviceRows] is what the receiver read from the DAO - any recorded portion of the shown day
 * suppresses, the same way maybeNotifyEvening asks it, on this single-user device. The setting is read from
 * [settings] HERE, at the tap (R475): it decides only a day with no rows (R490). Every command goes through
 * [repository], R492's record path - never a direct DAO write (R206).
 */
suspend fun recordEveningTap(
    tap: EveningTap,
    at: TapMoment,
    deviceRows: List<EntryEntity>,
    settings: SettingsStore,
    repository: EntryRepository,
): EveningWrite {
    val hasEntry = deviceRows.any { it.dayDate == tap.shownForDay }
    val setting = dayGranularityOf(settings.load())
    return when (val decision = decideEveningTap(tap, at, hasEntry, setting)) {
        is EveningTapResult.Ignore -> EveningWrite.Ignored(decision.reason)
        is EveningTapResult.Record -> {
            val results = decision.commands.map { repository.record(it) }
            val written = results.count { it is RecordResult.Recorded }
            if (written == results.size) {
                EveningWrite.Recorded(decision.commands)
            } else {
                EveningWrite.Refused(written)
            }
        }
    }
}
