package ch.monreleve.app.debug

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.sync.MAX_NOTE_LENGTH
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

// DEBUG-ONLY (R284). The deterministic dataset generator for the AN-AUDIT measurement pass. It JOINS the
// SessionInjection guard family: it lives only in src/debug, and both R284 guards - NoDebugInjectionInMainTest
// (the source scan, guard a) and checkReleaseNoDebugInjection (the merged-release-manifest check, guard b) -
// name "DebugSeeder" alongside "SessionInjection", so it can never reach a shipped source set or a release
// build. It is COMMITTED as test tooling (the same exception SessionInjection takes), and increment 3's
// built-APK sweep confirms DebugSeederActivity is ABSENT from the release APK.
//
// WHY A SEEDER AND NOT DIRECT SQLITE. sqlite3 is absent from the emulator image, so a schema-level seed is
// out; more to the point, the entry table's identity hash is Room's, and a hand-written INSERT that drifts
// from it corrupts the store silently. This generates real EntryEntity rows and DebugSeederActivity inserts
// them through the app's own EntryDao inside one Room transaction - the same write path fence 5 blesses.
//
// DETERMINISM (R197). generate(asOf, scenario) is a pure function of its inputs: same asOf, same scenario,
// byte-identical rows. clientMutationId and serverId are derived by name (UUID.nameUUIDFromBytes) from the
// scenario tag and the (day, portion) key, so re-seeding UPSERTs the same rows in place rather than
// duplicating - the seed is idempotent, and sign-out remains the only wipe (R295/R297). DebugSeederTest
// asserts the determinism, the exact counts, the disjoint date ranges and every consistency invariant.
//
// THE SCENARIOS, laid out in DISJOINT calendar years below a run-time anchor (asOf.year), so ALL composes
// into one coherent multi-year record with no (dayDate, portion) collision:
//   DECADE   anchor-9 .. anchor   weekdays, one FULL day each, a realistic CH/HOME/mission mix, SYNCED.
//                                 The anchor year is truncated at asOf - a user produces no future-dated rows.
//   HALF_DAY anchor-10            weekdays, an AM (CH) and a PM (HOME) row each, SYNCED.
//   ABSENT   anchor-11            weekdays, every one an absence with a cycling reason, SYNCED.
//   LATE     anchor-12            weekdays worked, but recorded in a single backfill the NEXT July - every
//                                 day's firstRecordedAt lands months after the day it records, SYNCED.
//   NOTES    anchor-13            four days carrying pathological-but-locally-legal notes (see below).
//
// PATHOLOGICAL NOTES, built from codepoints (R96), each sized against the server's own cap (R181):
//   - an OVERSIZED note of MAX_NOTE_LENGTH * OVERSIZE_FACTOR chars. Room has no length bound, so it is
//     locally legal and stores; it EXCEEDS the wire cap, so its consistent lifecycle is FAILED (the server
//     would 400 it) with null server columns - which also gives the dataset a real FAILED row to measure.
//   - a WHITESPACE-only note (one of every whitespace codepoint). The server schema is z.string().max(500)
//     with no .min()/.trim() (verified), so a whitespace note is wire-legal -> SYNCED.
//   - an RTL note (Hebrew and Arabic letters around an RLM) and an EMOJI note (a ZWJ family, a flag, a skin
//     tone), each within the cap -> SYNCED.

/** The five scenarios. ALL emits every one, in the disjoint ranges above. */
enum class SeedScenario {
    DECADE,
    HALF_DAY,
    ABSENT,
    LATE,
    NOTES,
    ALL,
}

private const val DECADE_YEARS = 10
private const val HALF_DAY_BACK = 10
private const val ABSENT_BACK = 11
private const val LATE_BACK = 12
private const val NOTES_BACK = 13
private const val RECORD_HOUR = 18
private const val OVERSIZE_FACTOR = 20
private const val BACKFILL_MONTH = 7
private const val BACKFILL_DAY = 1
private const val NOTE_DAYS = 4

private val CLAIM_OFFSET: ZoneOffset = ZoneOffset.ofHours(2)

// Explicit seconds/millis/offset, matching CalendarDay.CLAIM_FORMAT - the server's zod .datetime({offset:true})
// rejects the truncated "...T18:00+02:00" that ISO_OFFSET_DATE_TIME would emit when seconds are zero.
private val CLAIM_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSxxx")

// A realistic frontalier mix, keyed off the day so it is a pure function of the date: mostly Swiss office and
// home telework, an occasional mission either side of the border. The exact ratio is not load-bearing - a
// legal, consistent spread is (R197).
private val DECADE_KINDS =
    listOf(
        EntryKind.CH, EntryKind.CH, EntryKind.HOME, EntryKind.CH, EntryKind.HOME,
        EntryKind.MISSION_FR, EntryKind.CH, EntryKind.HOME, EntryKind.CH, EntryKind.MISSION_THIRD,
    )

object DebugSeeder {
    /** The rows for one scenario at one as-of date. Pure and deterministic (R197). */
    fun generate(
        asOf: LocalDate,
        scenario: SeedScenario,
    ): List<EntryEntity> {
        val anchor = asOf.year
        return when (scenario) {
            SeedScenario.DECADE -> decade(anchor, asOf)
            SeedScenario.HALF_DAY -> halfDay(anchor - HALF_DAY_BACK)
            SeedScenario.ABSENT -> absent(anchor - ABSENT_BACK)
            SeedScenario.LATE -> late(anchor - LATE_BACK)
            SeedScenario.NOTES -> notes(anchor - NOTES_BACK)
            SeedScenario.ALL ->
                decade(anchor, asOf) +
                    halfDay(anchor - HALF_DAY_BACK) +
                    absent(anchor - ABSENT_BACK) +
                    late(anchor - LATE_BACK) +
                    notes(anchor - NOTES_BACK)
        }
    }
}

private fun decade(
    anchor: Int,
    asOf: LocalDate,
): List<EntryEntity> =
    (anchor - DECADE_YEARS + 1..anchor).flatMap { year ->
        val upTo = if (year == anchor) asOf else null
        weekdays(year, upTo).map { date ->
            syncedRow("DECADE", date, Portion.FULL, kindFor(date))
        }
    }

private fun halfDay(year: Int): List<EntryEntity> =
    weekdays(year, null).flatMap { date ->
        listOf(
            syncedRow("HALF_DAY", date, Portion.AM, EntryKind.CH),
            syncedRow("HALF_DAY", date, Portion.PM, EntryKind.HOME),
        )
    }

private fun absent(year: Int): List<EntryEntity> {
    val reasons = AbsenceReason.entries
    return weekdays(year, null).mapIndexed { index, date ->
        absentRow(date, reasons[index % reasons.size])
    }
}

private fun late(year: Int): List<EntryEntity> {
    val backfill = LocalDate.of(year + 1, BACKFILL_MONTH, BACKFILL_DAY)
    return weekdays(year, null).map { date ->
        val kind = if (date.toEpochDay() % 2 == 0L) EntryKind.CH else EntryKind.HOME
        syncedRow("LATE", date, Portion.FULL, kind, recordedOn = backfill)
    }
}

private fun notes(year: Int): List<EntryEntity> {
    val days = weekdays(year, null).take(NOTE_DAYS)
    return listOf(
        failedNoteRow(days[0], "x".repeat(MAX_NOTE_LENGTH * OVERSIZE_FACTOR)),
        syncedRow("NOTES", days[1], Portion.FULL, EntryKind.CH, note = whitespaceNote()),
        syncedRow("NOTES", days[2], Portion.FULL, EntryKind.CH, note = rtlNote()),
        syncedRow("NOTES", days[3], Portion.FULL, EntryKind.CH, note = emojiNote()),
    )
}

private fun kindFor(date: LocalDate): EntryKind {
    val size = DECADE_KINDS.size
    return DECADE_KINDS[((date.toEpochDay() % size + size) % size).toInt()]
}

private fun weekdays(
    year: Int,
    upTo: LocalDate?,
): List<LocalDate> {
    val end = upTo ?: LocalDate.of(year, 12, 31)
    return generateSequence(LocalDate.of(year, 1, 1)) { it.plusDays(1) }
        .takeWhile { !it.isAfter(end) }
        .filter { it.dayOfWeek != DayOfWeek.SATURDAY && it.dayOfWeek != DayOfWeek.SUNDAY }
        .toList()
}

private fun claimAt(date: LocalDate): String =
    OffsetDateTime.of(
        date,
        LocalTime.of(RECORD_HOUR, 0),
        CLAIM_OFFSET,
    ).format(CLAIM_FORMAT)

private fun idOf(vararg parts: String): String =
    UUID.nameUUIDFromBytes(
        parts.joinToString("|").toByteArray(),
    ).toString()

private fun syncedRow(
    tag: String,
    date: LocalDate,
    portion: Portion,
    kind: EntryKind,
    recordedOn: LocalDate = date,
    note: String? = null,
): EntryEntity {
    val day = date.toString()
    val recorded = claimAt(recordedOn)
    return EntryEntity(
        clientMutationId = idOf(tag, day, portion.name),
        dayDate = day,
        portion = portion,
        kind = kind,
        absenceReason = null,
        note = note,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = claimAt(date),
        serverId = idOf("server", tag, day, portion.name),
        firstRecordedAt = recorded,
        lastModifiedAt = recorded,
        syncState = SyncState.SYNCED,
    )
}

private fun absentRow(
    date: LocalDate,
    reason: AbsenceReason,
): EntryEntity {
    val day = date.toString()
    val recorded = claimAt(date)
    return EntryEntity(
        clientMutationId = idOf("ABSENT", day, Portion.FULL.name),
        dayDate = day,
        portion = Portion.FULL,
        kind = EntryKind.ABSENT,
        absenceReason = reason,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = recorded,
        serverId = idOf("server", "ABSENT", day, Portion.FULL.name),
        firstRecordedAt = recorded,
        lastModifiedAt = recorded,
        syncState = SyncState.SYNCED,
    )
}

// The oversized note exceeds the wire cap, so it never reaches SYNCED: the server would 400 it and the client
// holds it FAILED (SyncState doc), with null server columns because no server row was ever returned.
private fun failedNoteRow(
    date: LocalDate,
    note: String,
): EntryEntity {
    val day = date.toString()
    return EntryEntity(
        clientMutationId = idOf("NOTES", day, Portion.FULL.name),
        dayDate = day,
        portion = Portion.FULL,
        kind = EntryKind.CH,
        absenceReason = null,
        note = note,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = claimAt(date),
        serverId = null,
        firstRecordedAt = null,
        lastModifiedAt = null,
        syncState = SyncState.FAILED,
    )
}

private fun fromCodepoints(vararg codepoints: Int): String =
    codepoints.joinToString("") {
        String(Character.toChars(it))
    }

// One of every whitespace codepoint, including NBSP (U+00A0), figure/narrow spaces and the ideographic space -
// exactly the characters Character.isWhitespace does NOT recognise, which is what makes them worth storing.
private fun whitespaceNote(): String =
    fromCodepoints(
        0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x0020,
        0x00A0, 0x2002, 0x2003, 0x2007, 0x2009, 0x202F, 0x2028, 0x2029, 0x3000,
    )

// Hebrew "shalom" and Arabic "marhaba" around a right-to-left mark.
private fun rtlNote(): String =
    fromCodepoints(
        0x05E9, 0x05DC, 0x05D5, 0x05DD, 0x200F, 0x0645, 0x0631, 0x062D, 0x0628, 0x0627,
    )

// A ZWJ family, the Swiss flag as regional indicators, and a thumbs-up with a medium skin tone modifier -
// astral-plane codepoints and combining sequences, the shape that breaks naive substring rendering.
private fun emojiNote(): String =
    fromCodepoints(
        0x1F468, 0x200D, 0x1F469, 0x200D, 0x1F467, 0x1F1E8, 0x1F1ED, 0x1F44D, 0x1F3FD,
    )
