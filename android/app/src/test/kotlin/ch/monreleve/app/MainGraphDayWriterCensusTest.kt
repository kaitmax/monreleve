package ch.monreleve.app

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import kotlin.reflect.full.memberProperties
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-MOVE-GRAPH R1311. MainGraphWiringTest's FIRST case (Kotest), TRANSCRIBED to kotlin.test with its values and
// expectations unchanged, and KEPT IN :app because it is JVM-ONLY: it enumerates the day-writers off MainControllers'
// own properties with kotlin.reflect.full, and common Kotlin has no equivalent - a KClass outside the JVM has no
// members. Replacing the enumeration with a list would be the hand-kept list the census exists to avoid. It still
// checks the ONE graph: MainGraph.build is the construction site every platform calls, so the property set it
// enumerates on the JVM is the set iOS gets. The second case is MainGraphWiringPinTest (R1311 moves it to commonTest).
//
// The original's header, kept: AN10b increment 2 (R291). The wiring test that the AN10 calendar-never-synced bug
// proves is needed. R291 moved the wiring into MainGraph; this asserts every day-writing controller the graph builds
// is built WITH requestSync. IT CHECKS THE WIRING THE APP ACTUALLY USES, NOT A COPY OF IT: the shell calls
// MainGraph.build and so does this test, so an omission planted in MainGraph fails here AND breaks the app.

private const val TAX_YEAR = 2026

// today is 15 June 2026 in Paris (R28).
private val fixedClock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private fun store(): SettingsStore =
    object : SettingsStore {
        override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

        override fun save(settings: Settings) = Unit

        override fun clear() = Unit
    }

// AN12: stub seams. The Parametres, Releve and forecast controllers are not DayWriters, so they are outside this
// census; the seams just have to exist for the graph to build.
private fun saver(): SettingsSaver =
    object : SettingsSaver {
        override suspend fun saveSettings(body: String): PostOutcome = PostOutcome.Ok(200, "{}")
    }

private fun localStore(): LocalStore =
    object : LocalStore {
        override suspend fun clearForSignOut() = Unit

        override suspend fun clearForDeletion() = Unit
    }

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
class MainGraphDayWriterCensusTest {
    // "every day-writing controller in the app's graph is built with requestSync (R291)"
    @Test
    fun everyDayWritingControllerInTheAppsGraphIsBuiltWithRequestSync() =
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
                    dossierStaleCopy = { null },
                    exportBytes = { BytesOutcome.NetworkError },
                    settingsSaver = saver(),
                    revokeServer = {},
                    localStore = localStore(),
                    authenticatedPost = { _, _ -> PostOutcome.Ok(200, "{}") },
                )

            val writers = dayWritersOf(controllers)
            // The reflection enumeration must actually find both controllers the shell drives (identity):
            // a controller dropped from MainControllers, or one that stops implementing DayWriter, falls
            // out of `writers` and is caught here - the census tripwire.
            assertContains(writers, controllers.aujourdhui)
            assertContains(writers, controllers.calendar)
            assertTrue(writers.size >= 2, "expected at least 2 day-writers, found ${writers.size}")

            // Each enumerated writer must hold the SHARED requestSync (built WITH it, not the default
            // no-op): invoking each fires the one spy once, so the total equals the writer count. An
            // omission in MainGraph leaves one writer on its default no-op and the total falls short.
            writers.forEach { it.requestSync() }
            assertEquals(writers.size, syncs)
        }
}
