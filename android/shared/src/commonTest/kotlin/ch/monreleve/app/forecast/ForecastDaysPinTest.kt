package ch.monreleve.app.forecast

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.dossier.SimChange
import ch.monreleve.app.fr.RythmeCopy
import ch.monreleve.app.settings.Settings
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.LocalDate
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.plus
import kotlin.test.Test
import kotlin.test.assertTrue

// IOS-2d R813. THE PIN, written and run green on the forecast's java.time weekdays BEFORE they move to :shared and
// onto kotlinx-datetime (R787's shape). kotlin.test only - no Kotest, no java.* - and it NEVER NAMES THE WEEKDAY TYPE:
// every weekday it handles comes out of the code under test (RHYTHM_WEEKDAYS, the maps, availableWeekdays) and is read
// through what both enums share - its name, its ordinal, equality with another value of the SAME type - so this file
// compiles against java.time.DayOfWeek before the swap and kotlinx.datetime.DayOfWeek after it, and is then moved to
// commonTest by `git mv`, unedited. The weekday the ENGINE receives is kotlinx on both sides (SimChange is shared), so
// its isoDayNumber is read directly. Every expected value is a literal or a position; the java.time run is the oracle.
//
// What the forecast does with a weekday, and so what is pinned (every place a day's name or number is stored, sent or
// compared):
//   - ORDER AND NUMBER: Monday..Friday in that order, ordinals 0..4, each one's label RythmeCopy.DAYS[ordinal] (the
//     screens' only arithmetic on a day) landing on its own position;
//   - STORED: withDay writes exactly that weekday's field of WeeklyRhythm - the column Room keeps (R341) - for every
//     weekday and both kinds, over an empty and a full rhythm;
//   - COMPARED: toChoiceMap keys each set field under its own weekday, and a weekday looked up there finds its choice;
//     availableWeekdays offers exactly the weekdays that are not a home day, in order;
//   - SENT: extraWeekdayChange hands the engine the SAME weekday by name and ISO number (1..5), and it is the very
//     weekday withDay's stored field projects to through toEntryKindMap (one engine day, two paths);
//   - THE DATE: projectedThresholdCrossing across the year end (the `$taxYear-` filter: a 2027 row never counts in
//     2026, a 2026 row never in 2027) and on 29 Feb 2024.
// The instant -> Paris day mapping on the DST change days (Europe/Paris and Europe/Zurich, the same EU instant), on
// 29 Feb 2024 and across 31 Dec -> 1 Jan is todayInParis's, already pinned by CalendarDatesPinTest's todayInParis
// group, ParisDayDstTest and CalendarDayGoldenTest - not re-proved here (R268). Each group collects every mismatch.
class ForecastDaysPinTest {
    private val names = listOf("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY")

    private fun fieldsOf(rhythm: WeeklyRhythm): List<RhythmKind?> =
        listOf(rhythm.monday, rhythm.tuesday, rhythm.wednesday, rhythm.thursday, rhythm.friday)

    private fun rhythmOf(vararg fields: RhythmKind?): WeeklyRhythm =
        WeeklyRhythm(fields[0], fields[1], fields[2], fields[3], fields[4])

    private val settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

    private fun home(day: String): EntryEntity =
        EntryEntity(
            clientMutationId = "pin-$day",
            dayDate = day,
            portion = Portion.FULL,
            kind = EntryKind.HOME,
            absenceReason = null,
            note = null,
            provenance = Provenance.MANUAL,
            detectedKind = null,
            detectedAt = null,
            clientClaimedAt = null,
            serverId = null,
            firstRecordedAt = null,
            lastModifiedAt = null,
            syncState = SyncState.SYNCED,
        )

    /** The first [count] weekdays from [first] on (Monday..Friday by the engine's own ISO number), as home rows. */
    private fun homeWeekdays(
        first: LocalDate,
        count: Int,
    ): List<EntryEntity> {
        val rows = mutableListOf<EntryEntity>()
        var day = first
        while (rows.size < count) {
            if (day.dayOfWeek.isoDayNumber <= FRIDAY_NUMBER) rows += home(day.toString())
            day = day.plus(1, DateTimeUnit.DAY)
        }
        return rows
    }

    private fun failIfAny(
        group: String,
        mismatches: List<String>,
    ) = assertTrue(mismatches.isEmpty(), "$group: ${mismatches.size} mismatch(es)\n" + mismatches.joinToString("\n"))

    @Test
    fun theWeekdaysAreMondayToFridayInOrderAndEachLabelIsItsOwnPosition() {
        val m = mutableListOf<String>()
        if (RHYTHM_WEEKDAYS.map { it.name } != names) m += "names ${RHYTHM_WEEKDAYS.map { it.name }}"
        val ordinals = RHYTHM_WEEKDAYS.map { it.ordinal }
        if (ordinals != listOf(0, 1, 2, 3, 4)) m += "ordinals $ordinals"
        if (RHYTHM_WEEKDAYS.map { RythmeCopy.DAYS[it.ordinal] } != RythmeCopy.DAYS) {
            m += "labels ${RHYTHM_WEEKDAYS.map { RythmeCopy.DAYS[it.ordinal] }} are not RythmeCopy.DAYS in order"
        }
        if (RHYTHM_WEEKDAYS.toSet().size != names.size) m += "a weekday listed twice"
        failIfAny("order", m)
    }

    @Test
    fun withDayStoresExactlyThatWeekdaysField() {
        val m = mutableListOf<String>()
        val full = rhythmOf(RhythmKind.SUISSE, RhythmKind.DOMICILE, RhythmKind.SUISSE, RhythmKind.DOMICILE, null)
        for ((index, day) in RHYTHM_WEEKDAYS.withIndex()) {
            for (kind in RhythmKind.entries) {
                val fromEmpty = fieldsOf(WeeklyRhythm().withDay(day, kind))
                val expectedEmpty = List(names.size) { if (it == index) kind else null }
                if (fromEmpty != expectedEmpty) m += "<${day.name}, $kind> on empty: $fromEmpty, not $expectedEmpty"
                val fromFull = fieldsOf(full.withDay(day, kind))
                val expectedFull = fieldsOf(full).mapIndexed { i, f -> if (i == index) kind else f }
                if (fromFull != expectedFull) m += "<${day.name}, $kind> over $full: $fromFull, expected $expectedFull"
            }
        }
        failIfAny("withDay", m)
    }

    @Test
    fun toChoiceMapKeysEachSetFieldUnderItsOwnWeekday() {
        val m = mutableListOf<String>()
        if (WeeklyRhythm().toChoiceMap().isNotEmpty()) m += "the empty rhythm maps to ${WeeklyRhythm().toChoiceMap()}"
        val s = RhythmKind.SUISSE
        val d = RhythmKind.DOMICILE
        val full = rhythmOf(d, s, d, s, s)
        val map = full.toChoiceMap()
        if (map.keys.map { it.name } != names) m += "full rhythm keys ${map.keys.map { it.name }}"
        val expectedChoices = fieldsOf(full).map { it?.toChoice() }
        if (RHYTHM_WEEKDAYS.map { map[it] } != expectedChoices) {
            m += "looked up by weekday: ${RHYTHM_WEEKDAYS.map { map[it] }}, expected $expectedChoices"
        }
        for (day in RHYTHM_WEEKDAYS) {
            for (choice in RhythmChoice.entries) {
                val round = WeeklyRhythm().withDay(day, choice.toKind()).toChoiceMap()
                if (round != mapOf(day to choice)) m += "<${day.name}, $choice> round trip: $round"
                if (round.keys.single().ordinal != day.ordinal) m += "<${day.name}> key ordinal moved"
            }
        }
        if (RhythmChoice.entries.map { it.toKind().toChoice() } != RhythmChoice.entries) m += "choice <-> kind not 1:1"
        if (RhythmChoice.entries.map { it.toKind().name } != RhythmChoice.entries.map { it.name }) {
            m += "a choice maps to a kind of another name: ${RhythmChoice.entries.map { it.toKind() }}"
        }
        failIfAny("toChoiceMap", m)
    }

    @Test
    fun availableWeekdaysOffersExactlyTheWeekdaysThatAreNotHomeInOrder() {
        val m = mutableListOf<String>()
        val s = RhythmKind.SUISSE
        val d = RhythmKind.DOMICILE
        val vectors: List<Pair<WeeklyRhythm, List<String>>> =
            listOf(
                WeeklyRhythm() to names,
                rhythmOf(s, s, s, s, s) to names,
                rhythmOf(d, d, d, d, d) to emptyList(),
                rhythmOf(null, d, null, d, null) to listOf("MONDAY", "WEDNESDAY", "FRIDAY"),
                rhythmOf(s, d, s, d, s) to listOf("MONDAY", "WEDNESDAY", "FRIDAY"),
                rhythmOf(d, null, null, null, d) to listOf("TUESDAY", "WEDNESDAY", "THURSDAY"),
                rhythmOf(d, d, d, d, null) to listOf("FRIDAY"),
                rhythmOf(null, d, d, d, d) to listOf("MONDAY"),
            )
        for ((rhythm, expected) in vectors) {
            val offered = availableWeekdays(rhythm)
            val offeredNames = offered.map { it.name }
            if (offeredNames != expected) m += "$rhythm offers $offeredNames, expected $expected"
            val labels = offered.map { RythmeCopy.DAYS[it.ordinal] }
            val expectedLabels = expected.map { RythmeCopy.DAYS[names.indexOf(it)] }
            if (labels != expectedLabels) m += "$rhythm labels $labels, expected $expectedLabels"
        }
        failIfAny("availableWeekdays", m)
    }

    @Test
    fun theEngineReceivesTheSameWeekdayByNameAndIsoNumberAsTheStoredField() {
        val m = mutableListOf<String>()
        for ((index, day) in RHYTHM_WEEKDAYS.withIndex()) {
            val change = extraWeekdayChange(day)
            if (change !is SimChange.ExtraWeekday) {
                m += "<${day.name}> sends $change, not an ExtraWeekday"
                continue
            }
            if (change.day.name != day.name) m += "<${day.name}> sends ${change.day.name}"
            if (change.day.isoDayNumber != index + 1) m += "<${day.name}> sends ISO ${change.day.isoDayNumber}"
            val projected = WeeklyRhythm().withDay(day, RhythmKind.DOMICILE).toEntryKindMap()
            if (projected.keys.toList() != listOf(change.day)) {
                m += "<${day.name}> stored field projects to ${projected.keys}, the engine gets ${change.day}"
            }
            if (projected[change.day] != EntryKind.HOME) m += "<${day.name}> stored DOMICILE projects to $projected"
        }
        if (extraWeekdayChange(null) != SimChange.ExtraMonthDays(0)) m += "no weekday sends ${extraWeekdayChange(null)}"
        failIfAny("extraWeekdayChange", m)
    }

    @Test
    fun theThresholdCrossingCountsOnlyItsOwnYearAcrossTheYearEndAndOnTheLeapDay() {
        val m = mutableListOf<String>()
        val s = RhythmKind.SUISSE
        val d = RhythmKind.DOMICILE
        val allSuisse = rhythmOf(s, s, s, s, s)
        val mwf = rhythmOf(d, s, d, s, d)
        val in2026 = homeWeekdays(LocalDate(2026, 1, 1), ROWS_2026)
        val in2027 = homeWeekdays(LocalDate(2027, 1, 1), ROWS_2027)
        val leapYear = homeWeekdays(LocalDate(2024, 1, 1), ROWS_2024)

        data class Vector(
            val name: String,
            val entries: List<EntryEntity>,
            val rhythm: WeeklyRhythm,
            val today: LocalDate,
            val taxYear: Int,
            val expected: Pair<Boolean, Boolean>?,
        )
        val vectors =
            listOf(
                // 100 + 20 home days, the 20 dated January 2027: only the 100 count in 2026 (100/240 > 40 %, < 49,9 %).
                Vector("31 Dec 2026, 2026", in2026 + in2027, allSuisse, LocalDate(2026, 12, 31), 2026, true to false),
                // ... and only the 20 in 2027 (20/240): the 2026 rows never count across the year end.
                Vector("1 Jan 2027, 2027", in2026 + in2027, allSuisse, LocalDate(2027, 1, 1), 2027, false to false),
                Vector("1 Jan 2027, 2026 rows only", in2026, allSuisse, LocalDate(2027, 1, 1), 2027, false to false),
                Vector("31 Dec 2026, 2026 rows only", in2026, allSuisse, LocalDate(2026, 12, 31), 2026, true to false),
                // 44 home days to 29 Feb 2024 inclusive (Jan 23 + Feb 21 weekdays), then the rhythm to 31 Dec 2024.
                Vector("29 Feb 2024, all Suisse", leapYear, allSuisse, LocalDate(2024, 2, 29), 2024, false to false),
                Vector("29 Feb 2024, M-W-F", leapYear, mwf, LocalDate(2024, 2, 29), 2024, true to true),
                Vector("29 Feb 2024, no rhythm", leapYear, WeeklyRhythm(), LocalDate(2024, 2, 29), 2024, null),
            )
        for (v in vectors) {
            val crossing = projectedThresholdCrossing(settings, v.entries, v.rhythm, v.today, v.taxYear)
            val got = crossing?.let { it.fiscal to it.social }
            if (got != v.expected) m += "<${v.name}> crossing $got, expected ${v.expected}"
        }
        val lastLeapRow = leapYear.last().dayDate
        if (lastLeapRow != "2024-02-29") m += "positive control: the leap-year rows end on $lastLeapRow"
        failIfAny("projectedThresholdCrossing", m)
    }

    private companion object {
        const val FRIDAY_NUMBER = 5
        const val ROWS_2026 = 100
        const val ROWS_2027 = 20
        const val ROWS_2024 = 44
    }
}
