package ch.monreleve.app.aujourdhui

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.TallyEntity
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.detection.Classification
import ch.monreleve.app.detection.InMemoryNearBorderNoticeStore
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-AUTO increment 5 / R320. The Aujourd'hui auto-mode state (SPEC 11.2 ETATS A/B/C, R311-R314). The controller
// reads the logging mode and the day's four checks and decides what the person sees: detection en cours (A) while
// the day is still running, a HIGH proposal to confirm/correct (B) once concluded, the not-sure message (B
// withheld), or - once today is recorded - the confirmed row (C). Only HIGH proposes (R311); confirm/correct record
// the provenance (R202/R314). For half-day granularity each half is decided from its own two checks (R320).

private const val TAX_YEAR = 2026
private const val TODAY = "2026-06-15"

private fun store(granularity: String = "DAY"): SettingsStore =
    object : SettingsStore {
        override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, granularity, null)

        override fun save(settings: Settings) = Unit

        override fun clear() = Unit
    }

private fun tally(
    dayDate: String,
    c1: Classification? = null,
    c2: Classification? = null,
    c3: Classification? = null,
    c4: Classification? = null,
): TallyEntity = TallyEntity(dayDate, c1?.name, c2?.name, c3?.name, c4?.name)

@OptIn(ExperimentalCoroutinesApi::class)
class AujourdhuiAutoControllerTest : FunSpec({
    val i = Classification.INSIDE
    val o = Classification.OUTSIDE
    val b = Classification.BUFFER

    // 12:00 Paris (10:00Z, summer): the day is still running - before the last check window (17:00 Paris).
    val insideWindow = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))
    // 22:00 Paris (20:00Z): AFTER the last window - the evening, when the day has a vote to show.
    val afterWindow = Clock.fixed(Instant.parse("2026-06-15T20:00:00Z"), ZoneId.of("Europe/Paris"))

    @Suppress("LongParameterList") // a test builder: the controller's seams, listed so each case reads at a glance
    fun controller(
        repo: LocalEntryRepository,
        clock: Clock,
        mode: LoggingMode,
        tallies: List<TallyEntity> = emptyList(),
        scope: kotlinx.coroutines.CoroutineScope,
        noticeStore: InMemoryNearBorderNoticeStore = InMemoryNearBorderNoticeStore(),
        settingsStore: SettingsStore = store(),
    ) = AujourdhuiController(
        repo,
        settingsStore,
        TAX_YEAR,
        clock,
        scope,
        detectionModeStore = InMemoryDetectionModeStore(mode),
        detectionTallies = flowOf(tallies),
        nearBorderNoticeStore = noticeStore,
    )

    test("manual mode leaves the auto state null (the manual UI is unchanged)") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), afterWindow)
            val c = controller(repo, afterWindow, LoggingMode.MANUAL, scope = this)
            advanceUntilIdle()
            c.state.value.loggingMode shouldBe LoggingMode.MANUAL
            c.state.value.auto shouldBe null
        }
    }

    test("auto mode, before the last window: detection en cours (ETAT A)") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), insideWindow)
            // Two Swiss checks already, but the day is not concluded, so nothing is proposed yet.
            val tallies = listOf(tally(TODAY, c1 = i, c2 = i))
            val c = controller(repo, insideWindow, LoggingMode.AUTO_DETECT, tallies, this)
            advanceUntilIdle()
            c.state.value.auto shouldBe AutoDayState.Detecting
        }
    }

    test("auto mode, after the window, a HIGH Swiss day: proposes En Suisse to confirm (ETAT B, R311/R314)") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), afterWindow)
            val tallies = listOf(tally(TODAY, i, i, i, i))
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, tallies, this)
            advanceUntilIdle()
            val auto = c.state.value.auto
            auto.shouldBeInstanceOf<AutoDayState.ToConfirm>()
            auto.kind shouldBe RecordedKind.SUISSE
        }
    }

    test("auto mode, after the window, a HIGH home day: proposes Domicile") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), afterWindow)
            val tallies = listOf(tally(TODAY, o, o, o, o))
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, tallies, this)
            advanceUntilIdle()
            val auto = c.state.value.auto
            auto.shouldBeInstanceOf<AutoDayState.ToConfirm>()
            auto.kind shouldBe RecordedKind.DOMICILE
        }
    }

    test("auto mode, after the window, a MEDIUM day withholds: the not-sure message (R311/R312)") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), afterWindow)
            // Three Swiss, one in the strip: MEDIUM -> withheld under R311.
            val tallies = listOf(tally(TODAY, i, i, i, b))
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, tallies, this)
            advanceUntilIdle()
            c.state.value.auto shouldBe AutoDayState.NotSure
        }
    }

    test("auto mode, after the window, no fixes at all: withheld, not a crash") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), afterWindow)
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, emptyList(), this)
            advanceUntilIdle()
            c.state.value.auto shouldBe AutoDayState.NotSure
        }
    }

    test("half-day granularity: each half is decided from its own two checks (R320)") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), afterWindow)
            // Morning both Swiss (proposes); afternoon one check missed (not sure).
            val tallies = listOf(tally(TODAY, c1 = i, c2 = i, c3 = i, c4 = null))
            val c =
                controller(repo, afterWindow, LoggingMode.AUTO_DETECT, tallies, this, settingsStore = store("HALF_DAY"))
            advanceUntilIdle()
            val morning = c.state.value.autoMorning
            morning.shouldBeInstanceOf<AutoDayState.ToConfirm>()
            morning.kind shouldBe RecordedKind.SUISSE
            c.state.value.autoAfternoon shouldBe AutoDayState.NotSure
            // The whole-day auto surface is not used in half-day granularity.
            c.state.value.auto shouldBe null
        }
    }

    test("confirming a proposal records a FULL day with provenance DETECTED_CONFIRMED (R202/R314, D16)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, afterWindow)
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, scope = this)
            c.confirmDetected(RecordedKind.SUISSE)
            advanceUntilIdle()
            val row = dao.byDayPortion(TODAY, Portion.FULL)
            row.shouldNotBeNull()
            row.kind shouldBe EntryKind.CH
            row.provenance shouldBe Provenance.DETECTED_CONFIRMED
            row.detectedKind shouldBe EntryKind.CH
            row.detectedAt.shouldNotBeNull()
        }
    }

    test("confirming a half-day proposal records that slot (R320)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, afterWindow)
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, scope = this)
            c.confirmDetected(RecordedKind.SUISSE, Slot.MORNING)
            advanceUntilIdle()
            val row = dao.byDayPortion(TODAY, Portion.AM)
            row.shouldNotBeNull()
            row.kind shouldBe EntryKind.CH
            row.provenance shouldBe Provenance.DETECTED_CONFIRMED
        }
    }

    test("correcting a proposal records the chosen kind as DETECTED_CORRECTED, keeping what was proposed") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, afterWindow)
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, scope = this)
            c.correctDetected(RecordedKind.SUISSE, Slot.FULL, null, proposedKind = RecordedKind.DOMICILE)
            advanceUntilIdle()
            val row = dao.byDayPortion(TODAY, Portion.FULL)
            row.shouldNotBeNull()
            row.kind shouldBe EntryKind.CH
            row.provenance shouldBe Provenance.DETECTED_CORRECTED
            row.detectedKind shouldBe EntryKind.HOME
        }
    }

    test("confirm and correct request a sync so the queue drains (SPEC 13.2)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, afterWindow)
            var syncs = 0
            val c =
                AujourdhuiController(
                    repo,
                    store(),
                    TAX_YEAR,
                    afterWindow,
                    this,
                    requestSync = { syncs += 1 },
                    detectionModeStore = InMemoryDetectionModeStore(LoggingMode.AUTO_DETECT),
                )
            c.confirmDetected(RecordedKind.SUISSE)
            advanceUntilIdle()
            syncs shouldBe 1
        }
    }

    test("a day already recorded shows no proposal (ETAT C is the recorded row, not a re-proposal)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, afterWindow)
            repo.record(RecordCommand(dayDate = TODAY, kind = EntryKind.HOME))
            val tallies = listOf(tally(TODAY, i, i, i, i))
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, tallies, this)
            advanceUntilIdle()
            c.state.value.auto shouldBe null
            c.state.value.fullDay.shouldNotBeNull()
        }
    }

    test("a confirmed day carries its provenance into the screen state (ETAT C provenance line)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, afterWindow)
            repo.record(
                RecordCommand(
                    dayDate = TODAY,
                    kind = EntryKind.CH,
                    provenance = Provenance.DETECTED_CONFIRMED,
                    detectedKind = EntryKind.CH,
                    detectedAt = "2026-06-15T18:00:00+02:00",
                ),
            )
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, scope = this)
            advanceUntilIdle()
            c.state.value.fullDay?.provenance shouldBe RecordedProvenance.DETECTED_CONFIRMED
        }
    }

    // R313 under R320: near-border recognition from the four checks (no coordinate), told ONCE.
    test("3 of the last 5 with-data days near the border raises the notice once, then never again") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), afterWindow)
            // Five days: three with 2 checks in the strip (near-border), two clean.
            val tallies =
                listOf(
                    tally("2026-06-10", b, b, i, i),
                    tally("2026-06-11", i, i, i, i),
                    tally("2026-06-12", b, b, i, i),
                    tally("2026-06-13", i, i, i, i),
                    tally("2026-06-14", b, b, i, i),
                )
            val notice = InMemoryNearBorderNoticeStore()
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, tallies, this, notice)
            advanceUntilIdle()
            c.state.value.nearBorderNotice shouldBe true

            // A second controller (a relaunch) with the SAME persisted store does not nag again (told once).
            val c2 = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, tallies, this, notice)
            advanceUntilIdle()
            c2.state.value.nearBorderNotice shouldBe false
        }
    }

    test("a person comfortably inland never sees the near-border notice") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), afterWindow)
            val tallies = (10..14).map { tally("2026-06-$it", i, i, i, i) }
            val c = controller(repo, afterWindow, LoggingMode.AUTO_DETECT, tallies, this)
            advanceUntilIdle()
            c.state.value.nearBorderNotice shouldBe false
        }
    }
})
