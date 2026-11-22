package ch.monreleve.app.ios

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.isOn
import androidx.compose.ui.test.isToggleable
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.runComposeUiTest
import androidx.lifecycle.Lifecycle
import ch.monreleve.app.Destination
import ch.monreleve.app.auth.onServerEndedSession
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.fr.ParametresCopy
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// IOS-SHELL-2 (R1330, R1337). THE EVENING REMINDER IS RE-PLANNED ON EVERY TRIGGER IN R1292's LIST - each proven THROUGH
// THE SHELL (R204): the root's lifecycle, the Aujourd'hui button, the shell's evening store, RESOLVING, the
// authorization answer - never by calling the plan. Each trigger is given its OWN observable: the recording centre is
// emptied (or one fact changed) just before it, and the refill - or the one day gone - is what is asserted, because a
// re-plan to the same set is otherwise invisible (the advisor's point 3).
//
// The week: Monday 2026-11-16 10:00Z, Paris - the plan holds the five working days' 19:00s, Monday to Friday (R1291).
// THE CENTRE ANSWERS THE AUTHORIZATION LATE in the foreground and relaunch cases, as the system does: a plan that read
// a cached "not permitted" instead of waiting for the answer would remove the whole window and fail them (R1330).
//
// iOS v1 HIDES the notification actions (iOS Ruling 3 Q4): every request the shell ever adds is asserted to be one of
// ours and to carry NO category - no category, no action buttons.

@OptIn(ExperimentalTestApi::class)
class IosShellRemindersIosTest {
    private val week = (16..20).map { EVENING_REMINDER_ID_PREFIX + "2026-11-$it" }.toSet()
    private val today = EVENING_REMINDER_ID_PREFIX + SHELL_TODAY

    private fun signedIn(
        centre: RecordingCentre = RecordingCentre(),
        eveningOptedIn: Boolean = true,
        foreground: Lifecycle.State = Lifecycle.State.RESUMED,
    ) = ShellRig(
        marked = true,
        pair = SHELL_PAIR,
        pendingAddress = null,
        account = "this-install",
        settings = SHELL_COMPLETE_SETTINGS,
        centre = centre,
        eveningOptedIn = eveningOptedIn,
        foreground = foreground,
    )

    private fun assertOnlyOursAndNoActions(rig: ShellRig) {
        val requests = rig.centre.requestsNow()
        assertTrue(requests.isNotEmpty(), "the shell planned something, or the next two checks prove nothing")
        assertTrue(requests.all { it.identifier.startsWith(EVENING_REMINDER_ID_PREFIX) }, "only evening reminders")
        assertTrue(
            requests.all { it.content.categoryIdentifier.isEmpty() },
            "iOS Ruling 3 Q4: no category, so no action (${requests.map { it.content.categoryIdentifier }})",
        )
    }

    @Test
    fun aForegroundReplansWaitingForTheAuthorizationTheCentreAnswersLate() =
        runComposeUiTest {
            val rig = signedIn(centre = RecordingCentre(late = true), foreground = Lifecycle.State.CREATED)
            try {
                setShellContent(rig)
                // The main shell opening plans first (a sign-in's trigger) - the BEFORE.
                waitFor("the opening plan holds the week") { rig.centre.pendingNow() == week }
                rig.centre.forgetPending()
                assertEquals(emptySet(), rig.centre.pendingNow())

                rig.lifecycle.moveTo(Lifecycle.State.RESUMED)
                waitFor("the FOREGROUND re-plans the week") { rig.centre.pendingNow() == week }
                assertOnlyOursAndNoActions(rig)
            } finally {
                rig.close()
            }
        }

    @Test
    fun recordingTodayOnAujourdhuiRemovesTodaysReminderAndKeepsTheRest() =
        runComposeUiTest {
            val rig = signedIn()
            try {
                setShellContent(rig)
                waitFor("the week is planned, today included") { rig.centre.pendingNow() == week }

                tap(AujourdhuiCopy.DOMICILE)
                waitFor("recording today re-plans: today's request is gone") { today !in rig.centre.pendingNow() }
                assertEquals(week - today, rig.centre.pendingNow(), "only today went; the other days stay")
            } finally {
                rig.close()
            }
        }

    @Test
    fun turningTheEveningSwitchOnInParametresPlansTheWeek() =
        runComposeUiTest {
            val rig = signedIn(eveningOptedIn = false)
            try {
                setShellContent(rig)
                openParametres()
                waitFor("the Paramètres tab's evening switch") { shows(ParametresCopy.EVENING_LABEL) }
                runBlocking { rig.shell.replanReminders() }
                assertEquals(emptySet(), rig.centre.pendingNow(), "opted out: nothing planned (the BEFORE)")

                // The evening switch is the tab's ONLY switch on iOS v1 (no detection, no threshold alert - R1338).
                assertEquals(1, onAllNodes(isToggleable()).fetchSemanticsNodes().size, "one switch: the evening's")
                onAllNodes(isToggleable()).onFirst().performScrollTo().performClick()
                waitFor("the opt-in, once the server took it, plans the week") { rig.centre.pendingNow() == week }
                assertTrue(rig.evening.isEnabled(), "the opt-in is persisted (R1337)")
                assertEquals(1, rig.centre.authorizationAsks, "ON asked the authorization first (R323)")
            } finally {
                rig.close()
            }
        }

    @Test
    fun theAuthorizationGrantedReplans() {
        val centre = RecordingCentre(grants = false)
        val rig = signedIn(centre = centre)
        try {
            runBlocking { rig.shell.replanReminders() }
            assertEquals(emptySet(), centre.pendingNow(), "not permitted: nothing planned (the BEFORE)")

            centre.grants = true
            rig.shell.onAuthorizationAnswer(true)
            runBlocking { assertTrue(eventually { centre.pendingNow() == week }, "the GRANT re-plans the week") }
        } finally {
            rig.close()
        }
    }

    @Test
    fun aSignInRestoresTheOptInFromTheServerAndPlans() =
        runComposeUiTest {
            val me = SHELL_COMPLETE_ME.replace("\"reminderEnabled\":false", "\"reminderEnabled\":true")
            check(me != SHELL_COMPLETE_ME) { "the fixture's reminderEnabled was not found to flip" }
            val server =
                RecordingTransport { method, path ->
                    if (method == "GET" && path == "/api/v1/me") HttpResponse(200, me) else HttpResponse(200, "{}")
                }
            val rig =
                ShellRig(
                    marked = true,
                    pair = SHELL_PAIR,
                    pendingAddress = null,
                    account = "this-install",
                    settings = null,
                    transport = server,
                    eveningOptedIn = false,
                )
            try {
                assertEquals(Destination.RESOLVING, rig.shell.start, "signed in, no settings: RESOLVING asks /me")
                assertFalse(rig.evening.isEnabled(), "off on this phone before the sign-in's restore")
                setShellContent(rig)
                waitFor("RESOLVING reached the tabs") { clickable(NavCopy.PARAMETRES) }
                waitFor("the restored opt-in planned the week") { rig.centre.pendingNow() == week }
                assertTrue(rig.evening.isEnabled(), "R1147: the server's opt-in restored where the phone may notify")
                // The switch Parametres draws agrees with what was planned: its controller reads the store ONCE when
                // built, so a restore that landed after it would show OFF beside a planned week.
                openParametres()
                waitFor("the Paramètres tab's evening switch") { shows(ParametresCopy.EVENING_LABEL) }
                assertEquals(1, onAllNodes(isToggleable() and isOn()).fetchSemanticsNodes().size, "the switch reads ON")
            } finally {
                rig.close()
            }
        }

    @Test
    fun aRelaunchRebuildsFromTheStoresAndStillPlansWithTheOptInOn() =
        runComposeUiTest {
            val rig = signedIn(centre = RecordingCentre(late = true), eveningOptedIn = false)
            try {
                // The person opts in through the shell's own store (what Parametres and onboarding write through).
                rig.shell.eveningStore.setEnabled(true)
                assertTrue(rig.evening.isEnabled(), "persisted before the relaunch")
                // That write re-planned (R1330); let it land before the old process's database is closed.
                waitFor("the first process planned the week") { rig.centre.pendingNow() == week }

                rig.relaunch()
                rig.centre.forgetPending()
                setShellContent(rig)
                waitFor("the RELAUNCHED shell plans the week from the stored opt-in") {
                    rig.centre.pendingNow() == week
                }
                assertTrue(rig.shell.eveningStore.isEnabled(), "R1337: the opt-in survived the relaunch")
                assertOnlyOursAndNoActions(rig)
            } finally {
                rig.close()
            }
        }

    @Test
    fun aServerEndedSessionClearsTheOptInAndLeavesNoPendingReminder() {
        val rig = signedIn()
        try {
            runBlocking { rig.shell.replanReminders() }
            assertEquals(week, rig.centre.pendingNow(), "the BEFORE: the week is planned")

            runBlocking { onServerEndedSession(rig.shell.localStore, rig.shell.sessionEnds) }
            assertEquals(emptySet(), rig.centre.pendingNow(), "M3's seam removed every request")
            assertFalse(rig.evening.isEnabled(), "R1337: every ending clears the persisted opt-in")
        } finally {
            rig.close()
        }
    }
}
