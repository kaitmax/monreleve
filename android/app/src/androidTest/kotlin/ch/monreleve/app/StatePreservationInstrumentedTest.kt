package ch.monreleve.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.Fr
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Rule
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/**
 * AN-STATE S3 (R310). THE RED DEVICE-LOOP's D5 COULD NEVER PRODUCE. D5 asked only "does rotation crash", and
 * it was checked on Aujourd'hui - the START screen - where losing your place and keeping it look identical.
 * This renders the REAL MainShell (R204: the entry point is the unit under test) and uses StateRestorationTester
 * to emulate a saved-instance-state restore - exactly what rotation, a text-size change, a dark-mode switch and
 * a background kill each do to the composition. On the BROKEN code (tab in `remember`, controllers in `remember`)
 * both tests FAIL: the tab reverts to Aujourd'hui and the open sheet closes. After the fix (rememberSaveable for
 * the tab, a restored seed for the controllers) both pass. It runs on a device (connectedDebugAndroidTest), so
 * it is exercised on the physical phone and the API-26 emulator, never by the JVM gate.
 *
 * Why render the whole shell rather than a copy of its state-holding: the AN10 sync bug and this one both lived
 * in MainShell because no test reached it; a test against a re-declared harness would pass while the shell stayed
 * broken. These drive rememberShellTab and rememberMainControllers - the SAME seams MainShell uses.
 */
class StatePreservationInstrumentedTest {
    @get:Rule
    val composeRule = createComposeRule()

    // today is 15 June 2026 in Paris (R28): the calendar opens on June, and day 10 is a recordable past day.
    private val fixedClock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

    // A minimal in-APK repository: the calendar needs a settings-driven month, not recorded rows, to render a
    // grid of recordable days. record() is never reached (these tests open a sheet, they do not save).
    private class FakeRepo : EntryRepository {
        private val all = MutableStateFlow<List<EntryEntity>>(emptyList())

        override suspend fun record(command: RecordCommand): EntryEntity =
            throw UnsupportedOperationException("not used by the state-preservation tests")

        override fun observePending(): Flow<List<EntryEntity>> = all

        override fun observeAll(): Flow<List<EntryEntity>> = all
    }

    private fun store(): SettingsStore =
        object : SettingsStore {
            override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

            override fun save(settings: Settings) = Unit

            override fun clear() = Unit
        }

    @Composable
    private fun Shell() {
        FrontierTheme {
            MainShell(
                repository = FakeRepo(),
                store = store(),
                taxYear = 2026,
                clock = fixedClock,
                scope = rememberCoroutineScope(),
                requestSync = {},
                dossierFetch = { DossierResult.NetworkError },
                exportBytes = { BytesOutcome.NoSession },
                settingsSaver =
                    object : SettingsSaver {
                        override suspend fun saveSettings(body: String): PostOutcome = PostOutcome.NoSession
                    },
                revokeServer = {},
                localStore =
                    object : LocalStore {
                        override suspend fun clearForSignOut() = Unit

                        override suspend fun clearForDeletion() = Unit
                    },
                authenticatedPost = { _, _ -> PostOutcome.NoSession },
                onSignedOut = {},
            )
        }
    }

    @Test
    fun navigationTabSurvivesRebuild() {
        val restorer = StateRestorationTester(composeRule)
        restorer.setContent { Shell() }

        // Start is Aujourd'hui (the greeting shows). Switch to Calendrier (a non-start screen).
        composeRule.onNodeWithText(Fr.greeting(null)).assertExists()
        composeRule.onNodeWithText(NavCopy.CALENDRIER).performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithText(Fr.greeting(null)).assertDoesNotExist()

        restorer.emulateSavedInstanceStateRestore()
        composeRule.waitForIdle()

        // The operator's finding: after the rebuild, the app must NOT have returned to Aujourd'hui.
        // Broken code resets the tab to AUJOURDHUI, so the greeting reappears -> this fails (RED).
        composeRule.onNodeWithText(Fr.greeting(null)).assertDoesNotExist()
    }

    @Test
    fun openEditSheetSurvivesRebuild() {
        val restorer = StateRestorationTester(composeRule)
        restorer.setContent { Shell() }

        composeRule.onNodeWithText(NavCopy.CALENDRIER).performClick()
        composeRule.waitForIdle()
        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule.onAllNodesWithText("10").fetchSemanticsNodes().isNotEmpty()
        }
        // The day number renders as both a merged cell node and its child text node; either opens the sheet.
        composeRule.onAllNodesWithText("10").onFirst().performClick() // open the edit sheet on 2026-06-10
        composeRule.waitForIdle()
        composeRule.onNodeWithText(CalendarCopy.SHEET_QUESTION).assertIsDisplayed()

        restorer.emulateSavedInstanceStateRestore()
        composeRule.waitForIdle()

        // Broken code rebuilds the controller, so editing=null and the sheet closes -> this fails (RED).
        composeRule.onNodeWithText(CalendarCopy.SHEET_QUESTION).assertExists()
    }
}
