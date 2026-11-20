package ch.monreleve.app.parametres

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.remote.ExportBytes
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.pilot.InMemorySettingsStore
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.InMemoryEveningNotificationStore
import ch.monreleve.app.settings.InMemoryThresholdAlertStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2e R829. THE PARAMETRES CONTROLLER'S PIN, written and run green in :app against the controller as it stood
// after R826/R827 (its wire a parameter, its start-date check the shared isIsoDay), BEFORE it moved to :shared - then
// moved to commonTest by `git mv`, unedited (R768's shape, IOS-2d R814's). kotlin.test + kotlinx-coroutines-test
// only, over a wire that RECORDS what it is asked to encode, a saver and a POST that record what is sent and answer
// as told, a LocalStore and a revoke that log their calls in one ordered list, and in-memory stores - so "the same
// requests in the same order, the same errors, the same storage" is asserted, not assumed. The Kotest specs
// (ParametresControllerTest, ParametresAccountTest, DetectionSettingsTest, SignOutSyncFirstTest,
// ParametresKeepsTheNameTest) stay in :app (Kotest and java.time cannot run in commonTest) through
// OrgJsonParametres.kt's factory; the org.json bytes are ParametresWirePinTest's, which stays in :app with the
// library it needs.
//
// Pinned: the state opened from the stored settings and the three toggle stores; a save that moves no rate (one
// patch, the name carried over - R475), every validation refusal and every outcome of the PATCH; a save that moves the
// rate (R290's before/after from the shared engine - R181 - cancel, then confirm); a change the record cannot support;
// sign-out sending the pending days first and naming what is left (R440), then revoke -> wipe -> SignedOut in that
// order; deletion's prompt, its POST, erasure on success only (SPEC 14.2) and its three outcomes; the three toggles
// and a revoked location permission; both exports; a restore reopening a confirmation once the rows load (R310).

private const val TAX_YEAR = 2026
private val STORED = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = "Camille")

private fun row(
    day: String,
    sync: SyncState = SyncState.SYNCED,
    portion: Portion = Portion.FULL,
) = EntryEntity(
    clientMutationId = "pin-$day-$portion",
    dayDate = day,
    portion = portion,
    kind = EntryKind.HOME,
    absenceReason = null,
    note = null,
    provenance = Provenance.MANUAL,
    detectedKind = null,
    detectedAt = null,
    clientClaimedAt = null,
    serverId = null,
    firstRecordedAt = null,
    lastModifiedAt = null,
    syncState = sync,
)

@OptIn(ExperimentalCoroutinesApi::class)
class ParametresControllerPinTest {
    private class Wire : ParametresWire {
        val patched = mutableListOf<Settings>()
        val receipts = mutableListOf<String>()

        override fun patchBody(settings: Settings): String {
            patched += settings
            return "patch#${patched.size}"
        }

        override fun consentBody(enable: Boolean): String = "consent:$enable"

        override fun reminderBody(enable: Boolean): String = "reminder:$enable"

        override fun deleteBody(): String = "delete-body"

        override fun parseReceipt(body: String): DeleteOutcome.Done {
            receipts += body
            return DeleteOutcome.Done(removedEntries = 5, alertSubscriptionRemains = true)
        }
    }

    private class Saver(var answer: PostOutcome = PostOutcome.Ok(200, "{}")) : SettingsSaver {
        val bodies = mutableListOf<String>()

        override suspend fun saveSettings(body: String): PostOutcome {
            bodies += body
            return answer
        }
    }

    private class Rows(seed: List<EntryEntity>) : EntryRepository {
        val flow = MutableStateFlow(seed)

        override suspend fun record(command: RecordCommand): RecordResult =
            throw UnsupportedOperationException("Parametres never records a day")

        override fun observePending(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())

        override fun observeAll(): Flow<List<EntryEntity>> = flow
    }

    /** Every side effect the account actions have, in the order they happened. */
    private class Log : LocalStore {
        val calls = mutableListOf<String>()

        override suspend fun clearForSignOut() {
            calls += "clearForSignOut"
        }

        override suspend fun clearForDeletion() {
            calls += "clearForDeletion"
        }
    }

    @Suppress("LongParameterList") // one holder for everything a test reads back - the fakes, by name
    private class Rig(
        val controller: ParametresController,
        val wire: Wire,
        val saver: Saver,
        val rows: Rows,
        val log: Log,
        val modes: InMemoryDetectionModeStore,
        val evening: InMemoryEveningNotificationStore,
        val alert: InMemoryThresholdAlertStore,
        val store: InMemorySettingsStore,
        val posts: MutableList<Pair<String, String>>,
        val exports: MutableList<String>,
        val events: MutableList<Any>,
    ) {
        var postAnswer: PostOutcome = PostOutcome.Ok(200, "receipt")
        var bytesAnswer: BytesOutcome = BytesOutcome.NetworkError
        var onSync: () -> Unit = {}
    }

    @Suppress("LongMethod")
    private fun TestScope.rig(
        seed: List<EntryEntity> = emptyList(),
        stored: Settings = STORED,
        restored: ParametresSnapshot? = null,
    ): Rig {
        val log = Log()
        val posts = mutableListOf<Pair<String, String>>()
        val exports = mutableListOf<String>()
        lateinit var r: Rig
        val wire = Wire()
        val saver = Saver()
        val rows = Rows(seed)
        val modes = InMemoryDetectionModeStore()
        val evening = InMemoryEveningNotificationStore()
        val alert = InMemoryThresholdAlertStore()
        val store = InMemorySettingsStore(stored)
        val controller =
            ParametresController(
                saver = saver,
                store = store,
                repository = rows,
                taxYear = TAX_YEAR,
                scope = backgroundScope,
                exportBytes = { path ->
                    exports += path
                    r.bytesAnswer
                },
                revokeServer = { log.calls += "revokeServer" },
                syncNow = {
                    log.calls += "syncNow"
                    r.onSync()
                },
                localStore = log,
                authenticatedPost = { path, body ->
                    posts += path to body
                    r.postAnswer
                },
                modeStore = modes,
                startSampling = { log.calls += "startSampling" },
                stopSampling = { log.calls += "stopSampling" },
                eveningNotificationStore = evening,
                thresholdAlertStore = alert,
                restored = restored,
                wire = wire,
            )
        val events = mutableListOf<Any>()
        r = Rig(controller, wire, saver, rows, log, modes, evening, alert, store, posts, exports, events)
        backgroundScope.launch { controller.accountEvents.collect { events += it } }
        backgroundScope.launch { controller.exportEvents.collect { events += it } }
        runCurrent()
        return r
    }

    @Test
    fun theStateOpensFromTheStoredSettingsAndTheToggleStores() =
        runTest {
            val r = rig(stored = Settings("VD", 80, "EXACT", 220, "HALF_DAY", "2026-03-01"))
            val s = r.controller.state.value
            assertEquals(Canton.VD, s.canton)
            assertEquals("80" to "220", s.employmentRate to s.exactTotalWorkDays)
            assertEquals(DenominatorChoice.EXACT to GranularityChoice.HALF_DAY, s.denominator to s.granularity)
            assertEquals("2026-03-01", s.activityStartDate)
            assertEquals(ParametresPhase.EDITING, s.phase)
            val toggles = listOf(s.autoDetectionEnabled, s.eveningNotificationEnabled, s.thresholdAlertEnabled)
            assertEquals(listOf(false, false, false), toggles, "the three toggles off, as their stores are")
            val unknown = rig(stored = Settings("XX", 100, "SIMPLIFIED240", null, "DAY", null)).controller.state.value
            assertNull(unknown.canton, "an unknown stored canton opens unchosen")
            assertEquals("" to "", unknown.exactTotalWorkDays to unknown.activityStartDate)
            val choices = unknown.denominator to unknown.granularity
            assertEquals(DenominatorChoice.SIMPLIFIED240 to GranularityChoice.DAY, choices)
        }

    @Test
    fun aSaveThatMovesNoRateSendsOnePatchKeepsTheNameAndReportsEachOutcome() =
        runTest {
            val r = rig()
            r.controller.onEmploymentRateChange(" 80 ")
            r.controller.save()
            runCurrent()
            val sent = Settings("GE", 80, "SIMPLIFIED240", null, "DAY", null)
            assertEquals(listOf(sent), r.wire.patched, "the six fields, the name never sent")
            assertEquals(listOf("patch#1"), r.saver.bodies, "one PATCH, the wire's body")
            assertEquals(sent.copy(name = "Camille"), r.store.load(), "stored with the name carried over (R475)")
            assertEquals(ParametresPhase.SAVED, r.controller.state.value.phase)
            val outcomes =
                listOf(
                    PostOutcome.NetworkError to (ParametresPhase.NETWORK_ERROR to null),
                    PostOutcome.SessionExpired to (ParametresPhase.NETWORK_ERROR to null),
                    PostOutcome.SessionEnded to (ParametresPhase.SESSION_ENDED to null),
                    PostOutcome.NoSession to (ParametresPhase.SESSION_ENDED to null),
                    PostOutcome.Ok(422, "{}") to (ParametresPhase.EDITING to SettingsError.SAVE_REFUSED),
                )
            for ((answer, expected) in outcomes) {
                val o = rig()
                o.saver.answer = answer
                o.controller.onEmploymentRateChange("90")
                o.controller.save()
                runCurrent()
                val state = o.controller.state.value
                assertEquals(expected, state.phase to state.error, "outcome $answer")
                assertEquals(STORED, o.store.load(), "nothing stored on $answer")
            }
        }

    @Test
    fun everyValidationRefusalNamesItsErrorAndSendsNothing() =
        runTest {
            val refusals =
                listOf<Pair<(ParametresController) -> Unit, SettingsError>>(
                    { c: ParametresController -> c.onEmploymentRateChange("abc") } to SettingsError.RATE_INVALID,
                    { c: ParametresController -> c.onEmploymentRateChange("0") } to SettingsError.RATE_INVALID,
                    { c: ParametresController -> c.onEmploymentRateChange("101") } to SettingsError.RATE_INVALID,
                    { c: ParametresController -> c.onDenominatorChange(DenominatorChoice.EXACT) } to
                        SettingsError.EXACT_TOTAL_MISSING,
                    { c: ParametresController ->
                        c.onDenominatorChange(DenominatorChoice.EXACT)
                        c.onExactTotalChange("x")
                    } to SettingsError.EXACT_TOTAL_INVALID,
                    { c: ParametresController ->
                        c.onDenominatorChange(DenominatorChoice.EXACT)
                        c.onExactTotalChange("0")
                    } to SettingsError.EXACT_TOTAL_INVALID,
                    { c: ParametresController -> c.onActivityStartDateChange("2027-03-01") } to
                        SettingsError.PERIOD_INVALID,
                    { c: ParametresController -> c.onActivityStartDateChange("2026-02-30") } to
                        SettingsError.START_DATE_INVALID,
                )
            for ((edit, error) in refusals) {
                val r = rig()
                edit(r.controller)
                r.controller.save()
                runCurrent()
                assertEquals(error to ParametresPhase.EDITING, r.controller.state.value.let { it.error to it.phase })
                assertTrue(r.saver.bodies.isEmpty() && r.wire.patched.isEmpty(), "nothing sent for $error")
                r.controller.onCantonChange(Canton.VD)
                assertNull(r.controller.state.value.error, "an edit clears the error")
            }
            val noCanton = rig(stored = Settings("XX", 100, "SIMPLIFIED240", null, "DAY", null))
            noCanton.controller.save()
            assertEquals(SettingsError.CANTON_MISSING, noCanton.controller.state.value.error)
        }

    @Test
    fun aSaveThatMovesTheRateAsksFirstAndARecordItCannotSupportIsRefused() =
        runTest {
            val home = (10..19).map { row("2026-03-$it") }
            val r = rig(home)
            r.controller.onEmploymentRateChange("50")
            r.controller.save()
            runCurrent()
            val before = deviceDeclarableRate(STORED, home, TAX_YEAR)
            val after = deviceDeclarableRate(STORED.copy(employmentRate = 50, name = null), home, TAX_YEAR)
            assertNotEquals(before, after, "the fixture moves the rate")
            val change = RateChange(before!!, after!!)
            assertEquals(change, r.controller.state.value.pendingRateChange, "R290: before/after, the shared engine's")
            assertTrue(r.saver.bodies.isEmpty(), "nothing sent before the person confirms")
            r.controller.cancelSave()
            runCurrent()
            assertNull(r.controller.state.value.pendingRateChange)
            assertTrue(r.saver.bodies.isEmpty(), "cancelled: nothing sent")
            r.controller.save()
            r.controller.confirmSave()
            runCurrent()
            assertEquals(listOf(50), r.wire.patched.map { it.employmentRate }, "confirmed: one patch")
            assertEquals(ParametresPhase.SAVED, r.controller.state.value.phase)

            val halves = rig(listOf(row("2026-03-10", portion = Portion.AM)), STORED.copy(granularity = "HALF_DAY"))
            halves.controller.onGranularityChange(GranularityChoice.DAY)
            halves.controller.save()
            runCurrent()
            assertEquals(SettingsError.CHANGE_CONFLICTS_WITH_RECORD, halves.controller.state.value.error)
            assertTrue(halves.saver.bodies.isEmpty(), "a conflicting change is never sent")
        }

    @Test
    fun signOutSendsThePendingDaysFirstNamesWhatIsLeftThenRevokesWipesAndLeaves() =
        runTest {
            val idle = rig(listOf(row("2026-03-02")))
            idle.controller.requestSignOut()
            runCurrent()
            assertEquals(SignOutPrompt(emptyList()), idle.controller.state.value.signOutPrompt, "nothing pending")
            assertTrue("syncNow" !in idle.log.calls, "no send when nothing is pending")
            idle.controller.cancelSignOut()
            assertNull(idle.controller.state.value.signOutPrompt)

            val pending =
                listOf(
                    row("2026-03-05", SyncState.PENDING, Portion.AM),
                    row("2026-03-05", SyncState.PENDING, Portion.PM),
                    row("2026-03-03", SyncState.PENDING),
                    row("2026-03-04", SyncState.PENDING),
                    row("2026-03-02"),
                )
            val r = rig(pending)
            r.onSync = {
                r.rows.flow.value =
                    r.rows.flow.value.map {
                        if (it.dayDate == "2026-03-04") it.copy(syncState = SyncState.SYNCED) else it
                    }
            }
            r.controller.requestSignOut()
            runCurrent()
            assertEquals(listOf("syncNow"), r.log.calls, "one send before the prompt")
            assertEquals(listOf("2026-03-03", "2026-03-05"), r.controller.state.value.signOutPrompt?.pendingDates)
            assertEquals(false, r.controller.state.value.signOutSending)
            r.controller.retrySignOutSync()
            runCurrent()
            assertEquals(listOf("syncNow", "syncNow"), r.log.calls, "R440: one more send on retry")
            r.controller.confirmSignOut()
            runCurrent()
            assertEquals(listOf("syncNow", "syncNow", "revokeServer", "clearForSignOut"), r.log.calls)
            assertEquals(listOf<Any>(AccountEvent.SignedOut), r.events)
        }

    @Test
    fun deleteNamesWhatIsDestroyedAndErasesTheDeviceOnlyOnSuccess() =
        runTest {
            val seed = listOf(row("2026-03-02"), row("2026-03-03", SyncState.PENDING), row("2025-12-01"))
            val r = rig(seed)
            r.controller.requestDelete()
            assertEquals(DeletePrompt(recordedDays = 3, unsyncedDays = 1), r.controller.state.value.deletePrompt)
            r.controller.confirmDelete()
            runCurrent()
            assertEquals(listOf("/api/v1/account/delete" to "delete-body"), r.posts, "one POST, the wire's body")
            assertEquals(listOf("receipt"), r.wire.receipts, "the receipt handed to the wire's parse")
            assertEquals(DeleteOutcome.Done(5, true), r.controller.state.value.deleteOutcome)
            assertEquals(listOf("clearForDeletion"), r.log.calls, "erased after the server's success")
            r.controller.acknowledgeDelete()
            runCurrent()
            assertEquals(listOf<Any>(AccountEvent.Deleted), r.events)
            assertNull(r.controller.state.value.deleteOutcome)
            val others =
                listOf(
                    PostOutcome.Ok(500, "{}") to DeleteOutcome.Refused,
                    PostOutcome.NetworkError to DeleteOutcome.Unknown,
                    PostOutcome.SessionEnded to DeleteOutcome.Unknown,
                )
            for ((answer, outcome) in others) {
                val o = rig(seed)
                o.postAnswer = answer
                o.controller.confirmDelete()
                runCurrent()
                assertEquals(outcome, o.controller.state.value.deleteOutcome, "$answer")
                assertTrue(o.log.calls.isEmpty() && o.wire.receipts.isEmpty(), "$answer: device kept, nothing parsed")
                o.controller.acknowledgeDelete()
                runCurrent()
                assertTrue(o.events.isEmpty(), "$answer: the person stays")
            }
        }

    @Test
    fun theTogglesPersistAndReflectAndARevokedPermissionFallsBackToManual() =
        runTest {
            val r = rig()
            r.controller.setAutoDetection(true)
            runCurrent()
            assertEquals(listOf("consent:true"), r.saver.bodies)
            val on = r.modes.load() to r.controller.state.value.autoDetectionEnabled
            assertEquals(LoggingMode.AUTO_DETECT to true, on)
            r.controller.setAutoDetection(false)
            runCurrent()
            assertEquals(LoggingMode.MANUAL, r.modes.load())
            assertEquals(listOf("startSampling", "stopSampling"), r.log.calls)
            r.saver.answer = PostOutcome.Ok(403, "{}")
            r.controller.setAutoDetection(true)
            runCurrent()
            val refused = r.controller.state.value.error to r.modes.load()
            assertEquals(SettingsError.SAVE_REFUSED to LoggingMode.MANUAL, refused)
            // AN-MANUAL-REMINDER (R1146): the evening switch now PATCHes too, so it is driven on a taken answer here;
            // its refusals are theEveningSwitchPatchesAndMovesOnlyOnA2xx's.
            r.saver.answer = PostOutcome.Ok(200, "{}")
            r.controller.setEveningNotification(true)
            runCurrent()
            r.controller.setThresholdAlert(true)
            assertEquals(true to true, r.evening.isEnabled() to r.alert.isEnabled())
            val s = r.controller.state.value
            assertEquals(true to true, s.eveningNotificationEnabled to s.thresholdAlertEnabled)
            r.modes.save(LoggingMode.AUTO_DETECT)
            r.controller.onLocationPermissionRevoked()
            assertEquals(LoggingMode.MANUAL to false, r.modes.load() to r.controller.state.value.autoDetectionEnabled)
            val consents = listOf("consent:true", "consent:false", "consent:true", "reminder:true")
            assertEquals(consents, r.saver.bodies, "no PATCH on a revoke, none for the alert")
        }

    // AN-MANUAL-REMINDER (R1146, Android Ruling 14 / A8 Q2): ONE SWITCH, BOTH MODES, THE SERVER FIRST. It PATCHes
    // reminderEnabled and the phone's opt-in moves only once the server took it (R1145's rule) - every refusal beside
    // the 2xx it differs from (R196), and both directions, since a switch that can only turn on is half a switch.
    @Test
    fun theEveningSwitchPatchesAndMovesOnlyOnA2xx() =
        runTest {
            val r = rig()
            r.controller.setEveningNotification(true)
            runCurrent()
            assertEquals(listOf("reminder:true"), r.saver.bodies)
            assertEquals(true to true, r.evening.isEnabled() to r.controller.state.value.eveningNotificationEnabled)
            assertEquals(null, r.controller.state.value.error)

            r.controller.setEveningNotification(false)
            runCurrent()
            assertEquals(listOf("reminder:true", "reminder:false"), r.saver.bodies)
            assertEquals(false to false, r.evening.isEnabled() to r.controller.state.value.eveningNotificationEnabled)

            for (status in listOf(400, 403, 422, 500, 503)) {
                r.saver.answer = PostOutcome.Ok(status, "{}")
                r.controller.setEveningNotification(true)
                runCurrent()
                val state = r.controller.state.value
                val after = Triple(r.evening.isEnabled(), state.eveningNotificationEnabled, state.error)
                assertEquals(Triple(false, false, SettingsError.SAVE_REFUSED), after, "status $status: nothing moves")
            }
        }

    @Test
    fun theEveningSwitchOnNoAnswerOrAnEndedSessionMovesNothing() =
        runTest {
            val cases =
                listOf(
                    PostOutcome.NetworkError to ParametresPhase.NETWORK_ERROR,
                    PostOutcome.SessionExpired to ParametresPhase.NETWORK_ERROR,
                    PostOutcome.SessionEnded to ParametresPhase.SESSION_ENDED,
                )
            for ((answer, phase) in cases) {
                val r = rig()
                r.saver.answer = answer
                r.controller.setEveningNotification(true)
                runCurrent()
                assertEquals(listOf("reminder:true"), r.saver.bodies, "$answer: the PATCH was sent")
                val state = r.controller.state.value
                assertEquals(false to false, r.evening.isEnabled() to state.eveningNotificationEnabled, "$answer")
                assertEquals(phase, state.phase, "$answer")
            }
        }

    @Test
    fun bothExportsAndARestoredConfirmation() =
        runTest {
            val bytes = byteArrayOf(1, 2, 3)
            val r = rig()
            r.bytesAnswer = BytesOutcome.Ok(200, ExportBytes(bytes, null))
            r.controller.exportData(AccountExportKind.JSON)
            runCurrent()
            r.bytesAnswer = BytesOutcome.Ok(200, ExportBytes(bytes, "server.csv"))
            r.controller.exportData(AccountExportKind.CSV)
            runCurrent()
            r.bytesAnswer = BytesOutcome.Ok(503, ExportBytes(bytes, null))
            r.controller.exportData(AccountExportKind.JSON)
            runCurrent()
            r.bytesAnswer = BytesOutcome.NetworkError
            r.controller.exportData(AccountExportKind.CSV)
            runCurrent()
            val json = "/api/v1/account/export"
            val csv = "/api/v1/account/export?format=csv"
            assertEquals(listOf(json, csv, json, csv), r.exports)
            val expected =
                listOf(
                    ExportEvent.Ready(bytes, "mes-donnees.json", "application/json"),
                    ExportEvent.Ready(bytes, "server.csv", "text/csv"),
                    ExportEvent.Failed,
                    ExportEvent.RequiresConnectivity,
                )
            assertEquals<List<Any>>(expected, r.events)

            val seed = listOf(row("2026-03-02"), row("2026-03-03", SyncState.PENDING))
            val snapshot = ParametresSnapshot(canton = Canton.BE, employmentRate = "75", deleteOpen = true)
            val restored = rig(seed, restored = snapshot)
            val s = restored.controller.state.value
            assertEquals(Canton.BE to "75", s.canton to s.employmentRate, "the edited fields restored")
            assertEquals(DeletePrompt(2, 1), s.deletePrompt, "the confirmation reopened with counts from the record")
        }
}
