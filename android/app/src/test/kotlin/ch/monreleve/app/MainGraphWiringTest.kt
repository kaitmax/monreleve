package ch.monreleve.app

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calendar.SlotEdit
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.ints.shouldBeGreaterThanOrEqual
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import kotlin.reflect.full.memberProperties

// AN10b increment 2 (R291). The wiring test that the AN10 calendar-never-synced bug proves is needed.
// That bug lived in MainShell (a Composable), where no JVM test reaches: the CalendarController was
// built without requestSync, so a saved day recorded to Room but never enqueued the drain (SPEC 13.2),
// and only the device walkthrough caught it. R291 moved the wiring into MainGraph; this asserts every
// day-writing controller the graph builds is built WITH requestSync and requests a sync when it writes.
//
// IT CHECKS THE WIRING THE APP ACTUALLY USES, NOT A COPY OF IT: MainShell calls MainGraph.build and so
// does this test, so an omission planted in MainGraph fails here AND breaks the app. That identity is
// the whole point - a test against a re-declared graph would pass while the real one stayed broken.

private const val TAX_YEAR = 2026

// today is 15 June 2026 in Paris (R28): the calendar opens on June, and 2026-06-10 is a recordable past
// day the save path can write.
private val fixedClock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private fun store(): SettingsStore =
    object : SettingsStore {
        override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

        override fun save(settings: Settings) = Unit

        override fun clear() = Unit
    }

// AN12: a stub /api/v1/me PATCH seam. The Parametres controller is not a DayWriter, so it is outside this
// test's requestSync census; the saver just has to exist for the graph to build.
private fun saver(): SettingsSaver =
    object : SettingsSaver {
        override suspend fun saveSettings(body: String): PostOutcome = PostOutcome.Ok(200, "{}")
    }

// AN12: a stub device-erasure. Same reason - the graph just has to build; the sign-out/delete scopes are
// proven in LocalStoreTest and ParametresAccountTest.
private fun localStore(): LocalStore =
    object : LocalStore {
        override suspend fun clearForSignOut() = Unit

        override suspend fun clearForDeletion() = Unit
    }

// AN-FORECAST: a stub rhythm store. The ForecastController is not a DayWriter, so it is outside this test's
// requestSync census; the repository just has to exist for the graph to build.
private fun rhythmRepository(): RhythmRepository =
    object : RhythmRepository {
        override fun observe(): Flow<WeeklyRhythm> = flowOf(WeeklyRhythm())

        override suspend fun save(rhythm: WeeklyRhythm) = Unit

        override suspend fun clear() = Unit
    }

// The day-writers the graph builds, enumerated by TYPE off MainControllers' own properties (reflection),
// never a hand-kept list: a controller added to the holder that implements DayWriter is covered here
// without editing this test. KNOWN LIMIT: a day-writer the graph builds but does NOT store on
// MainControllers escapes this census - named in REPORT-AN10b.txt.
private fun dayWritersOf(controllers: MainControllers): List<DayWriter> =
    MainControllers::class.memberProperties
        .mapNotNull { it.getter.call(controllers) }
        .filterIsInstance<DayWriter>()

@OptIn(ExperimentalCoroutinesApi::class)
class MainGraphWiringTest : FunSpec({
    test("every day-writing controller in the app's graph is built with requestSync (R291)") {
        runTest {
            var syncs = 0
            val controllers =
                MainGraph.build(
                    repository = LocalEntryRepository(FakeEntryDao(), fixedClock),
                    rhythmRepository = rhythmRepository(),
                    settingsStore = store(),
                    taxYear = TAX_YEAR,
                    clock = fixedClock,
                    scope = this,
                    requestSync = { syncs++ },
                    // The Releve controller is not a DayWriter; stub seams keep this test about the sync wiring.
                    dossierFetch = { DossierResult.NetworkError },
                    exportBytes = { ch.monreleve.app.auth.BytesOutcome.NetworkError },
                    settingsSaver = saver(),
                    revokeServer = {},
                    localStore = localStore(),
                    authenticatedPost = { _, _ -> PostOutcome.Ok(200, "{}") },
                )

            val writers = dayWritersOf(controllers)
            // The reflection enumeration must actually find both controllers the shell drives (identity):
            // a controller dropped from MainControllers, or one that stops implementing DayWriter, falls
            // out of `writers` and is caught here - the census tripwire.
            writers shouldContain controllers.aujourdhui
            writers shouldContain controllers.calendar
            writers.size shouldBeGreaterThanOrEqual 2

            // Each enumerated writer must hold the SHARED requestSync (built WITH it, not the default
            // no-op): invoking each fires the one spy once, so the total equals the writer count. An
            // omission in MainGraph leaves one writer on its default no-op and the total falls short.
            writers.forEach { it.requestSync() }
            syncs shouldBe writers.size
        }
    }

    test("each day-writing controller requests a sync when it writes a day (SPEC 13.2, R204)") {
        runTest {
            var syncs = 0
            val dao = FakeEntryDao()
            val controllers =
                MainGraph.build(
                    repository = LocalEntryRepository(dao, fixedClock),
                    rhythmRepository = rhythmRepository(),
                    settingsStore = store(),
                    taxYear = TAX_YEAR,
                    clock = fixedClock,
                    scope = this,
                    requestSync = { syncs++ },
                    dossierFetch = { DossierResult.NetworkError },
                    exportBytes = { ch.monreleve.app.auth.BytesOutcome.NetworkError },
                    settingsSaver = saver(),
                    revokeServer = {},
                    localStore = localStore(),
                    authenticatedPost = { _, _ -> PostOutcome.Ok(200, "{}") },
                )
            advanceUntilIdle()

            // Aujourd'hui's one-tap record (SPEC 11.2) enqueues the drain.
            controllers.aujourdhui.record(RecordedKind.SUISSE, Slot.FULL)
            advanceUntilIdle()
            syncs shouldBe 1

            // The calendar's Save (SPEC 11.3) must too - the exact path AN10 shipped unwired.
            controllers.calendar.openDay("2026-06-10")
            controllers.calendar.save("2026-06-10", listOf(SlotEdit(Slot.FULL, RecordedKind.DOMICILE, null, null)))
            advanceUntilIdle()
            syncs shouldBe 2
        }
    }
})
