package ch.monreleve.app.ios

import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.runComposeUiTest
import androidx.lifecycle.Lifecycle
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.remote.HttpBytesResponse
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.data.sync.ENTRIES_PATH
import ch.monreleve.app.fr.CodeCopy
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.PrevisionCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.fr.RythmeCopy
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.fr.WelcomeCopy
import ch.monreleve.app.parametres.DELETE_CONFIRMATION
import ch.monreleve.app.parametres.LegalPage
import ch.monreleve.app.parametres.Site
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-SHELL-2 (R1331, R1332, R1333, R1335, R1338). THE MAIN SHELL'S FACILITIES ON iOS, EACH DRIVEN THROUGH THE SHELL
// (R204): the root's lifecycle, the tabs, the rows and the dialogs a person taps - never the function behind them.
//   R1332  a foreground drains a write queued while the app was in the background (BEFORE: nothing drained);
//   R1331  an account export is written where the erasure deletes and handed to the share sheet; a failed one is SAID,
//          on screen, through the one notice seam (the iosTest has no window, so the presenter is recorded - the sheet
//          itself is the host probe's step (3) and IOS-WALK's);
//   R1333  a legal row opens the site's page; with no app to open it, the address is said (R299); « Ouvrir ma
//          messagerie » is HIDDEN when message:// cannot be opened and opens it when it can;
//   R1335  deleting the account through the shell ends the session through M3's seam: zero pending requests after;
//   R1338  the threshold alert's two entry points are ABSENT on iOS - Parametres' switch and Prevision's offer - each
//          beside a PRESENCE guard on the same screen (the evening switch; Prevision's title, so a projection exists).

@OptIn(ExperimentalTestApi::class)
class IosShellFacilitiesIosTest {
    private fun signedIn(
        transport: RecordingTransport = completeAccountServer(),
        foreground: Lifecycle.State = Lifecycle.State.RESUMED,
        opensUrls: Boolean = true,
        pendingAddress: String? = null,
    ) = ShellRig(
        marked = true,
        pair = SHELL_PAIR,
        pendingAddress = pendingAddress,
        account = "this-install",
        settings = SHELL_COMPLETE_SETTINGS,
        transport = transport,
        eveningOptedIn = true,
        opensUrls = opensUrls,
        foreground = foreground,
    )

    private val drained = "POST $ENTRIES_PATH"

    @Test
    fun r1332AForegroundDrainsAWriteQueuedInTheBackground() =
        runComposeUiTest {
            val rig = signedIn(foreground = Lifecycle.State.CREATED)
            try {
                // A write queued with no drain asked for (the repository, not a controller): a foreground sends it.
                runBlocking { rig.shell.repository.record(RecordCommand(SHELL_TODAY, EntryKind.HOME)) }
                setShellContent(rig)
                waitFor("the tabs, in the background") { clickable(NavCopy.PARAMETRES) }
                assertFalse(drained in rig.transport.requests, "in the background nothing drained (the BEFORE)")

                rig.lifecycle.moveTo(Lifecycle.State.RESUMED)
                waitFor("the FOREGROUND drained the queued write") { drained in rig.transport.requests }
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1331AnAccountExportIsWrittenAndHandedToTheShareSheet() =
        runComposeUiTest {
            val bytes = "{\"fixture\":\"an export, not a record\"}".encodeToByteArray()
            val rig = signedIn(transport = completeAccountServer { HttpBytesResponse(200, bytes, emptyMap()) })
            try {
                setShellContent(rig)
                openParametres()
                tap(ParametresCopy.DATA_EXPORT_ROW)
                tap(ParametresCopy.EXPORT_JSON)
                waitFor("the share sheet was handed a file") { rig.shared.isNotEmpty() }
                val path = rig.shared.single()
                assertTrue(path.startsWith("${rig.directory}/exports/"), "written where the erasure deletes: $path")
                assertContentEquals(bytes, readFileBytes(path), "the server's bytes, verbatim")
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1331AFailedExportIsSaidOnScreenNeverSilently() =
        runComposeUiTest {
            val rig = signedIn(transport = completeAccountServer { HttpBytesResponse(500, ByteArray(0), emptyMap()) })
            try {
                setShellContent(rig)
                openParametres()
                tap(ParametresCopy.DATA_EXPORT_ROW)
                tap(ParametresCopy.EXPORT_JSON)
                waitFor("the failure, said through the notice seam") { shows(ReleveCopy.EXPORT_FAILED) }
                assertEquals(emptyList(), rig.shared, "nothing was handed to the share sheet")
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1333ALegalRowOpensTheSitesPage() =
        runComposeUiTest {
            val rig = signedIn()
            try {
                setShellContent(rig)
                openParametres()
                tap(ParametresCopy.PRIVACY_ROW)
                waitFor("the privacy page was opened") { rig.urls.opened.isNotEmpty() }
                assertEquals(listOf(Site.url(LegalPage.PRIVACY)), rig.urls.opened)
                assertFalse(shows(ParametresCopy.legalNoHandler(Site.url(LegalPage.PRIVACY))), "opened: no fallback")
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1333ALegalPageNothingCanOpenShowsItsAddressR299() =
        runComposeUiTest {
            val rig = signedIn(opensUrls = false)
            try {
                setShellContent(rig)
                openParametres()
                tap(ParametresCopy.PRIVACY_ROW)
                waitFor("R299: the address, said instead") {
                    shows(ParametresCopy.legalNoHandler(Site.url(LegalPage.PRIVACY)))
                }
            } finally {
                rig.close()
            }
        }

    /** The code screen, reached through the shell: Bienvenue, the address, the request. */
    private fun ShellRig.toTheCodeScreen(test: ComposeUiTest) =
        with(test) {
            setShellContent(this@toTheCodeScreen)
            tap(WelcomeCopy.START)
            waitFor("the address field") { onAllNodes(hasSetTextAction()).fetchSemanticsNodes().isNotEmpty() }
            onAllNodes(hasSetTextAction()).onFirst().performTextReplacement(SHELL_ADDRESS)
            tap(SignInCopy.SUBMIT)
            waitFor("the code screen") { shows(CodeCopy.TITLE) }
        }

    private fun signedOut(canOpenMail: Boolean) =
        ShellRig(
            marked = true,
            pair = null,
            pendingAddress = null,
            account = null,
            settings = null,
            canOpenMail = canOpenMail,
        )

    @Test
    fun r1333NoMailAppTheButtonIsHidden() =
        runComposeUiTest {
            val rig = signedOut(canOpenMail = false)
            try {
                rig.toTheCodeScreen(this)
                assertTrue(clickable(CodeCopy.SUBMIT), "the code screen's own button is there (the presence guard)")
                assertFalse(shows(CodeCopy.OPEN_MAIL), "iOS Ruling 3 Q5: hidden when message:// cannot be opened")
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1333AMailAppTheButtonOpensMessageScheme() =
        runComposeUiTest {
            val rig = signedOut(canOpenMail = true)
            try {
                rig.toTheCodeScreen(this)
                tap(CodeCopy.OPEN_MAIL)
                waitFor("message:// was opened") { rig.urls.opened.isNotEmpty() }
                assertEquals(listOf(MAIL_APP_URL), rig.urls.opened)
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1335DeletingTheAccountThroughTheShellLeavesZeroPendingRequests() =
        runComposeUiTest {
            val rig = signedIn(pendingAddress = SHELL_ADDRESS)
            try {
                runBlocking { rig.shell.replanReminders() }
                val before = rig.centre.pendingNow().size
                assertTrue(before > 0, "the BEFORE: the plan holds requests, or zero after proves nothing")

                setShellContent(rig)
                openParametres()
                tap(ParametresCopy.DELETE_ROW)
                waitFor("the typed-word field") { onAllNodes(hasSetTextAction()).fetchSemanticsNodes().isNotEmpty() }
                onAllNodes(hasSetTextAction()).onFirst().performTextReplacement(DELETE_CONFIRMATION)
                tap(ParametresCopy.DELETE_CONFIRM)
                tap(ParametresCopy.DELETE_DONE_ACK)
                waitFor("back on Bienvenue after the deletion") { shows(WelcomeCopy.TITLE) }

                assertTrue("POST /api/v1/account/delete" in rig.transport.requests, "the server deletion was asked")
                assertEquals(emptySet(), rig.centre.pendingNow(), "AFTER the deletion: no pending reminder")
                assertTrue(rig.centre.removeAllCalls >= 1, "M3's seam removed them on the deletion path")
                assertNull(rig.tokens.pair, "the token pair is gone")
                assertNull(rig.pending.value, "R289: deletion also clears the pending sign-in")
                assertNull(rig.settings.load(), "the settings are gone")
                assertFalse(rig.evening.isEnabled(), "the persisted opt-in is gone (R1337)")
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1338ParametresDrawsNoThresholdAlertSwitchOnIos() =
        runComposeUiTest {
            val rig = signedIn()
            try {
                setShellContent(rig)
                openParametres()
                waitFor("the evening switch - the presence guard on the same card") {
                    shows(ParametresCopy.EVENING_LABEL)
                }
                assertFalse(shows(ParametresCopy.ALERT_LABEL), "iOS Ruling 3 Q4: no threshold alert switch")
                assertFalse(shows(ParametresCopy.ALERT_DESCRIPTION), "nor its description")
            } finally {
                rig.close()
            }
        }

    @Test
    fun r1338PrevisionDrawsNoThresholdAlertOfferOnIos() =
        runComposeUiTest {
            val rig = signedIn()
            try {
                // A rhythm, so the forecast has a projection - the case where Android draws the offer.
                runBlocking {
                    rig.shell.rhythmRepository.save(
                        WeeklyRhythm(
                            monday = RhythmKind.SUISSE,
                            tuesday = RhythmKind.SUISSE,
                            wednesday = RhythmKind.DOMICILE,
                            thursday = RhythmKind.SUISSE,
                            friday = RhythmKind.SUISSE,
                        ),
                    )
                }
                setShellContent(rig)
                openParametres()
                tap(RythmeCopy.TITLE)
                tap(RythmeCopy.VIEW_FORECAST)
                waitFor("Prevision's title - a projection is drawn (the presence guard)") {
                    shows(PrevisionCopy.TITLE)
                }
                assertFalse(shows(PrevisionCopy.ALERT_OFFER), "iOS Ruling 3 Q4: no threshold alert offer")
            } finally {
                rig.close()
            }
        }
}
