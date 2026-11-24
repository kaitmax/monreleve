package ch.monreleve.app.pilot

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiActions
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreen
import kotlinx.datetime.TimeZone
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

// IOS-1b-A R608/R609. THE WHOLE PILOT AS ONE COMPOSABLE: the shared Aujourd'hui screen, in the shared theme, driven by
// the real controller over the in-memory fixture (PilotFixture). It is what iOS's AujourdhuiPilotViewController hosts,
// and what the iOS UI test composes. A tap records into memory and the screen follows - exactly the app's loop, with
// no server, no account and no production anywhere in it.

/**
 * The pilot screen for [scenario] on the device's real clock - the fixture places its days relative to today.
 * [newMutationId] is the platform's id source. Navigation actions are no-ops: the pilot is one screen (the other
 * three do not move in this task).
 */
@OptIn(ExperimentalTime::class) // KMP-DT R590: the kotlin.time.Clock seam - on the allowlist.
@Composable
fun AujourdhuiPilot(
    scenario: PilotScenario,
    newMutationId: () -> String,
) {
    val scope = rememberCoroutineScope()
    val controller =
        remember(scenario) {
            PilotFixture.controller(scenario, scope, Clock.System, TimeZone.currentSystemDefault(), newMutationId)
        }
    val state by controller.state.collectAsState()
    val actions =
        remember(controller) {
            AujourdhuiActions(
                onRecord = { kind, slot, absence -> controller.record(kind, slot, absence) },
                onConfirmDetected = { kind, slot -> controller.confirmDetected(kind, slot) },
                onCorrectDetected = { kind, slot, absence, proposed ->
                    controller.correctDetected(kind, slot, absence, proposed)
                },
            )
        }
    FrontierTheme { AujourdhuiScreen(state, actions) }
}
