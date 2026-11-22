package ch.monreleve.app

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calendar.SlotEdit
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.orgJsonParametresWire
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals

// IOS-MOVE-GRAPH R1311. MainGraphWiringTest's SECOND case (Kotest), TRANSCRIBED to kotlin.test with its values and
// expectations unchanged: the same fixed instant and zone, the same stub seams, the same two writes and the same two
// counts. R1311's order: seen green in :app against MainGraph where it lived; moved with it to :shared commonTest,
// where it runs on the JVM AND the iOS simulator; the original deleted (R268). The FIRST case - the census of every
// DayWriter, enumerated with kotlin.reflect.full - has no common equivalent (a KClass outside the JVM has no
// members), so it is JVM-only and stays in :app as MainGraphDayWriterCensusTest. REPORT-IOS-MOVE-GRAPH.txt maps both.
//
// The original's header, kept: AN10b increment 2 (R291). The wiring test that the AN10 calendar-never-synced bug
// proves is needed. That bug lived in MainShell (a Composable), where no JVM test reaches: the CalendarController was
// built without requestSync, so a saved day recorded to Room but never enqueued the drain (SPEC 13.2), and only the
// device walkthrough caught it. R291 moved the wiring into MainGraph; this asserts each day-writing controller the
// graph builds requests a sync when it writes. IT CHECKS THE WIRING THE APP ACTUALLY USES, NOT A COPY OF IT: the
// shell calls MainGraph.build and so does this test, so an omission planted in MainGraph fails here AND breaks the app.

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

// AN12: a stub /api/v1/me PATCH seam. The Parametres controller is not a DayWriter; the saver just has to exist for
// the graph to build.
private fun saver(): SettingsSaver =
    object : SettingsSaver {
        override suspend fun saveSettings(body: String): PostOutcome = PostOutcome.Ok(200, "{}")
    }

// AN12: a stub device-erasure. Same reason - the graph just has to build.
private fun localStore(): LocalStore =
    object : LocalStore {
        override suspend fun clearForSignOut() = Unit

        override suspend fun clearForDeletion() = Unit
    }

// AN-FORECAST: a stub rhythm store. The ForecastController is not a DayWriter; the repository just has to exist.
private fun rhythmRepository(): RhythmRepository =
    object : RhythmRepository {
        override fun observe(): Flow<WeeklyRhythm> = flowOf(WeeklyRhythm())

        override suspend fun save(rhythm: WeeklyRhythm) = Unit

        override suspend fun clear() = Unit
    }

@OptIn(ExperimentalCoroutinesApi::class)
class MainGraphWiringPinTest {
    // "each day-writing controller requests a sync when it writes a day (SPEC 13.2, R204)"
    @Test
    fun eachDayWritingControllerRequestsASyncWhenItWritesADay() =
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
                    dossierStaleCopy = { null },
                    exportBytes = { BytesOutcome.NetworkError },
                    settingsSaver = saver(),
                    revokeServer = {},
                    localStore = localStore(),
                    authenticatedPost = { _, _ -> PostOutcome.Ok(200, "{}") },
                    parametresWire = orgJsonParametresWire,
                )
            advanceUntilIdle()

            // Aujourd'hui's one-tap record (SPEC 11.2) enqueues the drain.
            controllers.aujourdhui.record(RecordedKind.SUISSE, Slot.FULL)
            advanceUntilIdle()
            assertEquals(1, syncs)

            // The calendar's Save (SPEC 11.3) must too - the exact path AN10 shipped unwired.
            controllers.calendar.openDay("2026-06-10")
            controllers.calendar.save("2026-06-10", listOf(SlotEdit(Slot.FULL, RecordedKind.DOMICILE, null, null)))
            advanceUntilIdle()
            assertEquals(2, syncs)
        }
}
