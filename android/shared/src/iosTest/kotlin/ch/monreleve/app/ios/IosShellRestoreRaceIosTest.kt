package ch.monreleve.app.ios

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.isOn
import androidx.compose.ui.test.isToggleable
import androidx.compose.ui.test.runComposeUiTest
import androidx.lifecycle.Lifecycle
import ch.monreleve.app.Destination
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.fr.ParametresCopy
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// IOS-SHELL-3 R1374 (iOS Ruling 15 Q6). THE RESTORE RACE, MEASURED BEFORE IT IS FIXED - in code and by test:
//
// (1) DOES RESOLVING (and so restoreReminder) RUN ON EVERY SIGNED-IN COLD LAUNCH? In code: startDestination (common
//     Destination.kt) starts a signed-in phone at MAIN when its settings are cached and at RESOLVING only when they
//     are not; GET /me is asked by RESOLVING alone (ShellRoutes.kt - no MAIN controller reads it). So NOT on every
//     launch - on a signed-in cold launch with no cached settings: a process ended between a restore and the settings
//     cache (decideStartAfterSignIn writes the opt-in BEFORE the settings, on purpose), or between onboarding's opt-in
//     and its settings, or an account whose settings stay incomplete. By test, both sides:
//       - aSignedInOnboardedColdLaunchNeverResolves...: cached settings -> MAIN, no GET /me, a persisted ON stands;
//       - aColdLaunchThroughResolving...: no cached settings -> RESOLVING; /me answers before the centre's first
//         authorization read, and the restore must not write OFF over the server's ON (the DEFECT - RED first).
// (2) IS A RESTORED OFF EVER SENT BACK TO THE SERVER? In code, the iOS paths that write the opt-in to the server are
//     two, and both send the PERSON's choice, never a restored value: Paramètres' evening switch
//     (setEveningNotification - the tap's value) and onboarding's save (its reminder answer, only when the flow asked
//     it). Parametres' own save PATCHes the six settings with no reminder key (mePatchBody()), and iOS v1 has no push
//     registration (Android's PushRegistration is the one path that writes the PHONE's opt-in). By test: a restore
//     that legitimately wrote OFF (the phone may not notify), then the tabs, Paramètres and a foreground - and no
//     request carries reminderEnabled.

@OptIn(ExperimentalTestApi::class)
class IosShellRestoreRaceIosTest {
    private val week = (16..20).map { EVENING_REMINDER_ID_PREFIX + "2026-11-$it" }.toSet()

    /** A server whose /me holds [reminderEnabled]; everything else as the signed-in shell meets it. */
    private fun meSays(reminderEnabled: Boolean): RecordingTransport {
        val me = SHELL_COMPLETE_ME.replace("\"reminderEnabled\":false", "\"reminderEnabled\":$reminderEnabled")
        check("\"reminderEnabled\":$reminderEnabled" in me) { "the fixture's reminderEnabled was not found" }
        return RecordingTransport { method, path ->
            if (method == "GET" && path == "/api/v1/me") HttpResponse(200, me) else HttpResponse(200, "{}")
        }
    }

    @Test
    fun r1374aSignedInOnboardedColdLaunchNeverResolvesSoAPersistedOnStands() =
        runComposeUiTest {
            // The server would say OFF, if anything asked it: a restore that ran would be seen.
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = SHELL_COMPLETE_SETTINGS,
                    transport = meSays(reminderEnabled = false),
                    centre = RecordingCentre(late = true),
                    eveningOptedIn = true,
                )
            try {
                assertEquals(Destination.MAIN, rig.shell.start, "cached settings: the launch starts at MAIN")
                setShellContent(rig)
                waitFor("the shell planned the week (it ran, and the centre answered)") {
                    rig.centre.pendingNow() == week
                }
                assertTrue(rig.evening.isEnabled(), "no restore ran: the persisted ON stands")
                val asked = rig.transport.requests
                assertFalse("GET /api/v1/me" in asked, "MAIN never asks /me: $asked")
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1374aColdLaunchThroughResolvingKeepsTheServersOnWhenTheCentreAnswersLate() =
        runComposeUiTest {
            // No cached settings: RESOLVING. The server holds ON; the phone may notify, but says so only LATE.
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = null,
                    transport = meSays(reminderEnabled = true),
                    centre = RecordingCentre(late = true),
                    eveningOptedIn = true,
                )
            try {
                assertEquals(Destination.RESOLVING, rig.shell.start, "no cached settings: the launch resolves")
                setShellContent(rig)
                waitFor("RESOLVING reached the tabs") { clickable(NavCopy.PARAMETRES) }
                assertTrue("GET /api/v1/me" in rig.transport.requests, "RESOLVING asked /me (the case is the race's)")
                runBlocking { delay(RecordingCentre.LATE_MILLIS * 3) }
                assertTrue(
                    rig.evening.isEnabled(),
                    "R1374: a restore that ran before the centre's first answer wrote OFF over the server's ON",
                )
                waitFor("and the week is planned") { rig.centre.pendingNow() == week }
                openParametres()
                waitFor("the Paramètres tab's evening switch") { shows(ParametresCopy.EVENING_LABEL) }
                assertEquals(1, onAllNodes(isToggleable() and isOn()).fetchSemanticsNodes().size, "the switch reads ON")
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1374bARestoredOffIsNeverSentBackToTheServer() =
        runComposeUiTest {
            // The server holds ON, the phone may NOT notify: the restore writes OFF, legitimately (R1147).
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = null,
                    transport = meSays(reminderEnabled = true),
                    centre = RecordingCentre(grants = false),
                    eveningOptedIn = true,
                )
            try {
                setShellContent(rig)
                waitFor("RESOLVING reached the tabs") { clickable(NavCopy.PARAMETRES) }
                assertTrue("GET /api/v1/me" in rig.transport.requests, "the restore's case: RESOLVING ran")
                assertFalse(rig.evening.isEnabled(), "the case exists: the restore wrote OFF over this phone's ON")

                openParametres()
                waitFor("the Paramètres tab's evening switch") { shows(ParametresCopy.EVENING_LABEL) }
                rig.lifecycle.moveTo(Lifecycle.State.CREATED)
                rig.lifecycle.moveTo(Lifecycle.State.RESUMED)
                waitForIdle()
                runBlocking { delay(RecordingCentre.LATE_MILLIS * 3) }

                val sent = rig.transport.bodies
                assertTrue(sent.none { "reminderEnabled" in it }, "R1374 (2): no request carried the opt-in: $sent")
                assertFalse(
                    rig.transport.requests.any { it == "PATCH /api/v1/me" },
                    "no PATCH /me at all without the person's tap: ${rig.transport.requests}",
                )
            } finally {
                rig.close()
            }
        }
}
