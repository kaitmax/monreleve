package ch.monreleve.app

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.aujourdhui.AujourdhuiController
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.calendar.CalendarController
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.releve.ReleveController
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import java.time.Clock

// AN10b increment 2 (R291). The composition root's controller wiring, moved OUT of the MainShell
// Composable so a plain JVM test can reach it.
//
// WHY THIS FILE EXISTS. AN10's walkthrough found a calendar that recorded to Room but never synced:
// MainShell built CalendarController WITHOUT requestSync (SPEC 13.2), inside a Composable, where no JVM
// test reaches - only driving the app end to end caught it (R176/R204). The controller's own unit test
// passed because it injects requestSync; the bug lived in the WIRING, not the controller. A wiring that
// lives in a Composable is a wiring no gate can check.

/**
 * A controller that writes a day (SPEC 11.2 Aujourd'hui, SPEC 11.3 the calendar). Every one MUST be
 * built with a real requestSync: a day written to Room but never enqueued for the drain (SPEC 13.2)
 * never reaches the server, which is the AN10 defect exactly. Implemented by the day-writing
 * controllers so MainGraphWiringTest can ENUMERATE them by type rather than by a hand-kept list - a
 * controller added here that writes a day is covered the day it is added.
 */
interface DayWriter {
    val requestSync: () -> Unit
}

/** The controllers the main shell drives, built once by [MainGraph.build]. */
class MainControllers(
    val aujourdhui: AujourdhuiController,
    val calendar: CalendarController,
    // AN11: the Releve controller. NOT a DayWriter (it reads the server's document, it records nothing), so
    // MainGraphWiringTest's requestSync census is unaffected - it filters by the DayWriter type.
    val releve: ReleveController,
    // AN12: the Parametres controller. NOT a DayWriter either (it edits settings and account state, it never
    // records a day), so it is outside the requestSync census by the same DayWriter filter.
    val parametres: ParametresController,
)

/**
 * The one construction site for the shell's controllers. MainShell calls [build]; MainGraphWiringTest
 * calls [build]; so the graph the test checks IS the graph the app uses. A controller wired here
 * without requestSync fails the test AND breaks the app - the two cannot diverge, which is the whole
 * point: the AN10 bug lived where no test could see it.
 */
object MainGraph {
    // The composition root's dependency list, moved here verbatim from MainShell (which carries the same
    // suppression for the same reason): these ARE the graph's dependencies, and bundling them into a
    // holder would only move the list. The point of R291 is that this list is now in a plain object a
    // JVM test can build, not that it is shorter.
    @Suppress("LongParameterList")
    fun build(
        repository: EntryRepository,
        settingsStore: SettingsStore,
        taxYear: Int,
        clock: Clock,
        scope: CoroutineScope,
        requestSync: () -> Unit,
        // AN11: the Releve controller's fetch seam (DossierApi::fetch in the app; a stub in tests), the same
        // lambda-seam idiom as requestSync. It reads GET /api/v1/dossier through the session.
        dossierFetch: suspend (Int) -> DossierResult,
        // AN11: the export seam (SessionManager::authenticatedGetBytes in the app), for the PDF and CSV.
        exportBytes: suspend (String) -> BytesOutcome,
        // AN12: the /api/v1/me PATCH seam (SessionSettingsSaver(session) in the app; a stub in tests), the
        // same seam onboarding uses - so the settings write has no second transport (R206).
        settingsSaver: SettingsSaver,
        // AN12 increment 2: the server-side session revoke (SessionManager::revokeServerSession) and the
        // device-wide erasure (R295). The Parametres export reuses the same exportBytes seam the Releve uses.
        revokeServer: suspend () -> Unit,
        localStore: LocalStore,
    ): MainControllers =
        MainControllers(
            aujourdhui = AujourdhuiController(repository, settingsStore, taxYear, clock, scope, requestSync),
            calendar = CalendarController(repository, settingsStore, taxYear, clock, scope, requestSync),
            releve = ReleveController(dossierFetch, exportBytes, repository, taxYear, scope),
            parametres =
                ParametresController(
                    settingsSaver,
                    settingsStore,
                    repository,
                    taxYear,
                    scope,
                    exportBytes,
                    revokeServer,
                    localStore,
                ),
        )
}
