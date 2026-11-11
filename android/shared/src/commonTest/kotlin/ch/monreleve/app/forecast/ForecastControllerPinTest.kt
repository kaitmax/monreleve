package ch.monreleve.app.forecast

import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.toAggregatable
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.dossier.forecastResults
import ch.monreleve.app.pilot.InMemorySettingsStore
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.toAggregatableUser
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.plus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-2d R814. THE FORECAST CONTROLLER'S PIN, written and run green in :app against the controller as it stood (on
// kotlinx-datetime and the kotlin.time Clock seam since R813), BEFORE it moved to :shared - then moved to commonTest
// by `git mv`, unedited (R768's shape, IOS-2c R788's). kotlin.test + kotlinx-coroutines-test only, over a rhythm
// repository that RECORDS every save in order and an entry repository whose record() throws (R340: a projection is
// never a record), so "the same requests in the same order" is asserted, not assumed. The Kotest specs
// (ForecastControllerTest, SettingsFollowedWithoutRestartTest) stay in :app through JavaTimeForecast.kt's factory.
//
// Pinned: TODAY - the Paris day of the clock, read through what it decides (the past weekdays left unrecorded, up to
// and including today, and the imagined working days, from the day after today to 31 December): either side of the
// first Monday after each 2026 DST change (Europe/Paris and Europe/Zurich change at the same instant, 01:00 UTC), of
// 29 Feb 2024 and of the year end; refresh() moving the tax year with it (`currentTaxYear = today.year`); setDay
// storing one rhythm per tap, in order, and showing it; the rhythm seeded ONCE (R310); the record read for its own
// tax year only and never written; the settings read at each emission. Counts are literals worked out by hand from
// the calendar (2026: 261 weekdays, 2024: 262, 2027: 261); rates come from the shared engine itself (R181).
@OptIn(ExperimentalCoroutinesApi::class)
class ForecastControllerPinTest {
    private class RecordingRhythms(initial: WeeklyRhythm) : RhythmRepository {
        val source = MutableStateFlow(initial)
        val saved = mutableListOf<WeeklyRhythm>()
        var clears = 0

        override fun observe(): Flow<WeeklyRhythm> = source

        override suspend fun save(rhythm: WeeklyRhythm) {
            saved += rhythm
        }

        override suspend fun clear() {
            clears++
        }
    }

    private class ReadOnlyEntries(seed: List<EntryEntity>) : EntryRepository {
        val rows = MutableStateFlow(seed)
        var records = 0

        override suspend fun record(command: RecordCommand): RecordResult {
            records++
            throw UnsupportedOperationException("the forecast never records a day (R340)")
        }

        override fun observePending(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())

        override fun observeAll(): Flow<List<EntryEntity>> = rows
    }

    /** The clock's instant, movable between steps (refresh reads it again). */
    private class Moment(var iso: String)

    private class Built(
        val controller: ForecastController,
        val rhythms: RecordingRhythms,
        val entries: ReadOnlyEntries,
        val moment: Moment,
    )

    @OptIn(ExperimentalTime::class) // KMP-DT R590: a kotlin.time Clock over the moment - on the allowlist.
    private fun TestScope.build(
        now: String,
        taxYear: Int = 2026,
        rhythm: WeeklyRhythm = WORKWEEK,
        seed: List<EntryEntity> = emptyList(),
        store: InMemorySettingsStore = InMemorySettingsStore(SETTINGS),
    ): Built {
        val moment = Moment(now)
        val rhythms = RecordingRhythms(rhythm)
        val entries = ReadOnlyEntries(seed)
        val controller =
            ForecastController(
                rhythmRepo = rhythms,
                entryRepo = entries,
                settingsStore = store,
                taxYear = taxYear,
                clock =
                    object : Clock {
                        override fun now(): Instant = Instant.parse(moment.iso)
                    },
                // backgroundScope: the controller observes the record forever; the test's end cancels it.
                scope = backgroundScope,
            )
        runCurrent()
        return Built(controller, rhythms, entries, moment)
    }

    private fun Built.projection(): Projection = assertNotNull(controller.state.value.projection, "no projection")

    private fun Built.counts(): Pair<Int, Int> = projection().let { it.unrecordedPastDays to it.imaginedWorkingDays }

    @Test
    fun todayIsTheParisDayOfTheClockAcrossDstTheLeapDayAndTheYearEnd() =
        runTest {
            // instant -> (tax year, (unrecorded past weekdays up to today, imagined weekdays after today))
            val vectors =
                listOf(
                    Triple("2026-06-15T10:00:00Z", 2026, 118 to 143),
                    // Mon 30 Mar 2026 begins at 22:00Z on the 29th (00:00 CEST, after spring forward)
                    Triple("2026-03-29T21:59:59.999Z", 2026, 62 to 199),
                    Triple("2026-03-29T22:00:00Z", 2026, 63 to 198),
                    // Mon 26 Oct 2026 begins at 23:00Z on the 25th (00:00 CET, after fall back)
                    Triple("2026-10-25T22:59:59.999Z", 2026, 212 to 49),
                    Triple("2026-10-25T23:00:00Z", 2026, 213 to 48),
                    // Thu 29 Feb 2024 runs from 23:00Z on the 28th to 22:59:59.999Z (CET)
                    Triple("2024-02-28T22:59:59.999Z", 2024, 43 to 219),
                    Triple("2024-02-28T23:00:00Z", 2024, 44 to 218),
                    Triple("2024-02-29T22:59:59.999Z", 2024, 44 to 218),
                    Triple("2024-02-29T23:00:00Z", 2024, 45 to 217),
                    // 31 Dec 2026 ends at 22:59:59.999Z; at 23:00Z today is 1 Jan 2027, the tax year still 2026
                    Triple("2026-12-31T22:59:59.999Z", 2026, 261 to 0),
                    Triple("2026-12-31T23:00:00Z", 2026, 261 to 0),
                )
            val mismatches =
                vectors.mapNotNull { (now, year, expected) ->
                    val got = build(now, year).counts()
                    if (got == expected) null else "<$now> $got, expected $expected"
                }
            assertTrue(mismatches.isEmpty(), "today: ${mismatches.size} mismatch(es)\n" + mismatches.joinToString("\n"))
        }

    @Test
    fun refreshMovesTodayAndTheTaxYearWithTheClock() =
        runTest {
            val recorded = homeWeekdays(LocalDate(2026, 1, 1), 10)
            val built = build("2026-12-31T23:00:00Z", seed = recorded)
            assertEquals(261 - 10 to 0, built.counts(), "before refresh: 1 Jan 2027, tax year 2026")
            assertEquals(currentRate(recorded, LocalDate(2027, 1, 1), 2026), built.projection().currentRate)
            built.controller.refresh()
            runCurrent()
            assertEquals(1 to 260, built.counts(), "after refresh: tax year 2027, today Fri 1 Jan counted")
            assertEquals(0.0, built.projection().currentRate, "2026's rows never count in 2027")
            built.moment.iso = "2027-03-01T10:00:00Z"
            built.controller.refresh()
            runCurrent()
            assertEquals(42 to 219, built.counts(), "Mon 1 Mar 2027: Jan 21 + Feb 20 + today")
        }

    @Test
    fun setDayStoresOneRhythmPerTapInOrderAndShowsIt() =
        runTest {
            val built = build("2026-06-15T10:00:00Z", rhythm = WeeklyRhythm())
            assertNull(built.controller.state.value.projection, "an empty rhythm is the invitation")
            assertEquals(emptyMap(), built.controller.state.value.rhythmDays)
            val choices = listOf(SUISSE, DOMICILE, SUISSE, DOMICILE, SUISSE)
            // a tap at a time, the scope running between taps (as the UI's dispatcher does): one save per tap
            RHYTHM_WEEKDAYS.zip(choices).forEach { (day, choice) ->
                built.controller.setDay(day, choice)
                runCurrent()
            }
            // two taps before the scope runs: each launched save reads the HELD rhythm when it runs - the latest
            built.controller.setDay(DayOfWeek.MONDAY, DOMICILE)
            built.controller.setDay(DayOfWeek.FRIDAY, DOMICILE)
            runCurrent()
            val s = RhythmKind.SUISSE
            val d = RhythmKind.DOMICILE
            val expected =
                listOf(
                    WeeklyRhythm(s),
                    WeeklyRhythm(s, d),
                    WeeklyRhythm(s, d, s),
                    WeeklyRhythm(s, d, s, d),
                    WeeklyRhythm(s, d, s, d, s),
                    WeeklyRhythm(d, d, s, d, d),
                    WeeklyRhythm(d, d, s, d, d),
                )
            assertEquals(expected, built.rhythms.saved, "one save per tap, in order")
            val days = built.controller.state.value.rhythmDays
            assertEquals(listOf(DOMICILE, DOMICILE, SUISSE, DOMICILE, DOMICILE), RHYTHM_WEEKDAYS.map { days[it] })
            assertEquals(listOf(0, 1, 3, 4), built.projection().domicileDays)
            assertEquals(4, built.controller.state.value.domicileCount)
            assertEquals(0 to 0, built.rhythms.clears to built.entries.records, "nothing else written")
        }

    @Test
    fun theRhythmIsSeededOnceAndThenHeld() =
        runTest {
            val built = build("2026-06-15T10:00:00Z")
            built.rhythms.source.value = WeeklyRhythm(RhythmKind.DOMICILE)
            runCurrent()
            val days = built.controller.state.value.rhythmDays
            assertEquals(listOf(SUISSE, DOMICILE, SUISSE, DOMICILE, SUISSE), RHYTHM_WEEKDAYS.map { days[it] })
            built.controller.setDay(DayOfWeek.FRIDAY, DOMICILE)
            runCurrent()
            val held = WORKWEEK.copy(friday = RhythmKind.DOMICILE)
            assertEquals(listOf(held), built.rhythms.saved, "the held rhythm is saved, not the re-emitted one")
        }

    @Test
    fun theRecordIsReadForItsOwnYearAndNeverWritten() =
        runTest {
            val in2026 = homeWeekdays(LocalDate(2026, 1, 1), 10)
            val outside = homeWeekdays(LocalDate(2025, 12, 29), 3) + homeWeekdays(LocalDate(2027, 1, 4), 2)
            val built = build("2026-06-15T10:00:00Z", seed = in2026 + outside)
            assertEquals(118 - 10 to 143, built.counts())
            assertEquals(currentRate(in2026, LocalDate(2026, 6, 15), 2026), built.projection().currentRate)
            val projected = forecast(in2026, LocalDate(2026, 6, 15), 2026).projected
            assertEquals(projected, built.projection().projected)
            assertEquals(projected.declarableRate, built.projection().projectedRate)
            built.entries.rows.value = built.entries.rows.value + homeWeekdays(LocalDate(2026, 1, 15), 1)
            runCurrent()
            assertEquals(118 - 11 to 143, built.counts(), "a new row is read at once")
            val rules = ruleSetFor(2026)
            val ceilings = built.projection().let { it.fiscalCeiling to it.socialCeiling }
            assertEquals(rules.fiscalCeiling to rules.socialCeiling, ceilings)
            assertEquals(Triple(0, 0, 0), Triple(built.rhythms.saved.size, built.rhythms.clears, built.entries.records))
        }

    @Test
    fun theSettingsAreReadAtEachEmission() =
        runTest {
            val store = InMemorySettingsStore(null)
            val built = build("2026-06-15T10:00:00Z", store = store)
            assertNull(built.controller.state.value.projection, "no settings: the invitation")
            store.save(SETTINGS)
            built.controller.setDay(DayOfWeek.MONDAY, SUISSE)
            runCurrent()
            assertEquals("SIMPLIFIED240", built.projection().denominatorKind)
            assertEquals(240, built.projection().totalWorkDays)
            store.save(SETTINGS.copy(denominatorKind = "EXACT", exactTotalWorkDays = 220))
            built.controller.refresh()
            runCurrent()
            assertEquals("EXACT" to 220, built.projection().let { it.denominatorKind to it.totalWorkDays })
        }

    private fun currentRate(
        recorded: List<EntryEntity>,
        today: LocalDate,
        taxYear: Int,
    ): Double = forecast(recorded, today, taxYear).current.declarableRate

    private fun forecast(
        recorded: List<EntryEntity>,
        today: LocalDate,
        taxYear: Int,
    ) = assertNotNull(
        forecastResults(
            SETTINGS.toAggregatableUser(),
            recorded.map { it.toAggregatable() },
            WORKWEEK.toEntryKindMap(),
            today,
            taxYear,
        ),
    )

    private companion object {
        const val FRIDAY_NUMBER = 5
        val SUISSE = RhythmChoice.SUISSE
        val DOMICILE = RhythmChoice.DOMICILE
        val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

        /** Monday Suisse, Tuesday Domicile, Wednesday Suisse, Thursday Domicile, Friday Suisse. */
        val WORKWEEK =
            WeeklyRhythm(
                RhythmKind.SUISSE,
                RhythmKind.DOMICILE,
                RhythmKind.SUISSE,
                RhythmKind.DOMICILE,
                RhythmKind.SUISSE,
            )

        /** [count] weekdays from [first] on (by the engine's own ISO number), each a synced home row. */
        fun homeWeekdays(
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

        fun home(day: String): EntryEntity =
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
    }
}
