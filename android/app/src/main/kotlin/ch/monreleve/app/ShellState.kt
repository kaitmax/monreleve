package ch.monreleve.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.ui.shell.AppTab
import java.time.Clock

// AN-STATE (R310). The main shell's STATE-HOLDING, moved OUT of the MainShell Composable into named seams -
// the same move R291 made for the WIRING, now for the state. WHY: the operator's finding was that rotating
// (or any rebuild - a text-size change, a dark-mode switch, a background kill) returned the app to its home
// screen. The cause was `var tab by remember { mutableStateOf(AUJOURDHUI) }` and `remember { MainGraph.build }`
// in MainShell: `remember` dies with the composition, so every rebuild reset the tab to the start screen and
// rebuilt the controllers from scratch, dropping the open sheet, the chosen month and every half-entered value.
//
// A seam a test can render. MainShell is a Composable no JVM test reaches (the AN10 bug lived there for the
// same reason); these seams are what StatePreservationInstrumentedTest drives under StateRestorationTester, so
// the regression the operator saw has a test that FAILS on the broken version and passes on the fixed one -
// the RED DEVICE-LOOP's D5 could never produce (it only asked "does rotation crash", on the start screen).
//
// R291 PRESERVED. rememberMainControllers still builds through MainGraph.build - the ONE construction site the
// wiring test also calls - so the DayWriter/requestSync census is unaffected; the seam only decides the state's
// LIFETIME, not the graph's shape.

/** The selected bottom-navigation tab. The operator's finding: this reset to Aujourd'hui on every rebuild. */
@Composable
fun rememberShellTab(): MutableState<AppTab> = remember { mutableStateOf(AppTab.AUJOURDHUI) }

/**
 * The shell's controllers, built once through MainGraph.build (R291 - the construction site the wiring test
 * checks). Held here so their state's lifetime is decided in one testable place rather than inline in MainShell.
 */
@Suppress("LongParameterList")
@Composable
fun rememberMainControllers(
    repository: EntryRepository,
    store: SettingsStore,
    taxYear: Int,
    clock: Clock,
    scope: kotlinx.coroutines.CoroutineScope,
    requestSync: () -> Unit,
    dossierFetch: suspend (Int) -> DossierResult,
    exportBytes: suspend (String) -> BytesOutcome,
    settingsSaver: SettingsSaver,
    revokeServer: suspend () -> Unit,
    localStore: LocalStore,
    authenticatedPost: suspend (String, String) -> PostOutcome,
): MainControllers =
    remember {
        MainGraph.build(
            repository, store, taxYear, clock, scope, requestSync, dossierFetch, exportBytes, settingsSaver,
            revokeServer, localStore, authenticatedPost,
        )
    }
