package ch.monreleve.app.ios

import ch.monreleve.app.auth.SessionEndingStore
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import platform.Foundation.NSFileManager
import platform.Foundation.NSUserDefaults
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2f R889. THE DEVICE'S LocalStore ON iOS, OVER iOS'S REAL STORES - the three scopes of Android's LocalStoreTest
// (sign-out R295/R297/R303, deletion R289, the server-ended session R521/R527), asserted against the Keychain, the
// UserDefaults suite, the Application-Support-shaped cache, the Room database and the exports directory themselves,
// built through iosDeviceLocalStore - the one construction - so its wiring is what is under test. Every store is
// test-scoped (a unique Keychain service and UserDefaults suite, a fresh temporary directory). Each test SEEDS every
// store and asserts the seed landed (positive controls) before it asserts anything cleared, and keeps the controls
// Android's test keeps: the pending sign-in SURVIVES a sign-out; the record and its account tag SURVIVE a server-ended
// session.
//
// IOS-MOVE-SEAM R1281: iosDeviceLocalStore now hands the store out through the "session ended" seam. Each test builds
// the iOS seam the way production does (iosSessionEndSeam) over a counting action in place of the notification
// centre - which raises an Objective-C exception in this bundle-less process - and asserts it ran once per scope.

private const val R889_TAG = "d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0"
private const val R889_YEAR = 2026

private class R889Device {
    val directory = freshTempDirectory()
    val service = uniqueName("ch.monreleve.app.test.r889")
    val suite = uniqueName("ios2f-r889-settings")
    val database: MonReleveDatabase = buildIosDatabase(directory)
    val tokens = KeychainTokenStore(service + ".token")
    val settings = UserDefaultsSettingsStore(NSUserDefaults(suiteName = suite))
    val cache = FileDossierCache("$directory/cache")
    val pending = KeychainPendingSignInStore(service + ".pending")
    val account = KeychainAccountStore(service + ".account")
    val detectionMode = InMemoryDetectionModeStore(LoggingMode.AUTO_DETECT)
    val exports = IosExportFiles("$directory/exports")
    val drainScope = CoroutineScope(Job())
    val drainStarted = CompletableDeferred<Unit>()
    var drainCancelled = false
    val trigger =
        IosSyncTrigger(drainScope) {
            drainStarted.complete(Unit)
            try {
                awaitCancellation()
            } finally {
                drainCancelled = true
            }
        }

    /** R1281: how many times the iOS seam removed the pending requests - the notification centre's call, counted. */
    var pendingRemovals = 0
    val store: SessionEndingStore =
        iosDeviceLocalStore(
            database = database,
            syncTrigger = trigger,
            exportFiles = exports,
            detectionModeStore = detectionMode,
            tokenStore = tokens,
            settingsStore = settings,
            dossierCache = cache,
            pendingSignIn = pending,
            accountStore = account,
            sessionEndSeam = iosSessionEndSeam(removePendingRequests = { pendingRemovals += 1 }),
        )
    var exportPath = ""
    var drainJob: Job? = null

    /** Fills every store, starts a drain, writes an export - and asserts each landed. */
    suspend fun seed() {
        database.entryDao().upsert(ios2fEntry("r889-m1", "2026-10-12", R889_TAG))
        database.tallyDao().upsert(ios2fTally("2026-10-12"))
        tokens.save(TokenPair("access", "refresh", "2027-01-01T00:00:00.000Z", "2027-03-01T00:00:00.000Z"))
        settings.save(Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null))
        cache.save(R889_YEAR, "{}")
        pending.remember("camille@example.fr")
        account.setCurrent(R889_TAG)
        exportPath = exports.write(ExportEvent.Ready(byteArrayOf(1, 2, 3), "mon-releve.json", "application/json"))
        drainJob = trigger.requestDrain()
        ios2fBounded("the seeded drain starting") { drainStarted.await() }

        assertEquals(1, database.entryDao().all().size, "control: a row recorded")
        assertEquals(1, database.tallyDao().all().size, "control: a tally recorded")
        assertNotNull(tokens.load(), "control: a session")
        assertNotNull(settings.load(), "control: settings")
        assertEquals("{}", cache.load(R889_YEAR), "control: a cached releve")
        assertEquals("camille@example.fr", pending.pending(), "control: a pending sign-in")
        assertEquals(R889_TAG, account.current(), "control: the account tag")
        assertTrue(NSFileManager.defaultManager.fileExistsAtPath(exportPath), "control: an export on disk")
        assertFalse(drainCancelled, "control: the drain is running")
        assertEquals(LoggingMode.AUTO_DETECT, detectionMode.load(), "control: auto mode")
        assertEquals(0, pendingRemovals, "control: no session has ended")
    }

    fun close() {
        drainScope.cancel()
        database.close()
        account.clear()
        pending.clear()
        tokens.clear()
        NSUserDefaults.standardUserDefaults.removePersistentDomainForName(suite)
        removeDirectory(directory)
    }
}

class IosLocalStoreIosTest {
    private val devices = mutableListOf<R889Device>()

    private fun device(): R889Device = R889Device().also { devices += it }

    @AfterTest
    fun cleanUp() = devices.forEach { it.close() }

    @Test
    fun signOutClearsTheAccountTagWithTheRestOfR295sSetAndKeepsThePendingSignIn() =
        runBlocking {
            val d = device()
            d.seed()
            d.store.clearForSignOut()

            assertEquals(1, d.pendingRemovals, "R1281: the sign-out removed the pending requests, once")
            assertNull(d.account.current(), "R303: sign-out clears the account tag")
            assertTrue(d.database.entryDao().all().isEmpty(), "R295: the record is cleared")
            assertTrue(d.database.tallyDao().all().isEmpty(), "R295: the tally is cleared")
            assertNull(d.tokens.load(), "R295: the tokens are cleared")
            assertNull(d.cache.load(R889_YEAR), "R295: the cached releve is cleared")
            assertFalse(NSFileManager.defaultManager.fileExistsAtPath(d.exportPath), "R295: the export is deleted")
            ios2fBounded("R295: the running drain stopping (cancelSync)") { d.drainJob?.join() }
            assertTrue(d.drainCancelled, "R295: the running drain is cancelled (cancelSync)")
            assertNull(d.trigger.lastOutcome, "a drain cancelled by the sign-out records no outcome")
            assertNull(d.settings.load(), "R297: the settings are cleared")
            assertEquals(LoggingMode.MANUAL, d.detectionMode.load(), "R315: the detection mode is reset")
            assertEquals("camille@example.fr", d.pending.pending(), "the pending sign-in survives a sign-out")
        }

    @Test
    fun deletionClearsTheAccountTagAndThePendingSignInToo() =
        runBlocking {
            val d = device()
            d.seed()
            d.store.clearForDeletion()

            assertEquals(1, d.pendingRemovals, "R1281: the deletion removed the pending requests, once")
            assertNull(d.account.current(), "R289: deletion clears the account tag")
            assertNull(d.pending.pending(), "R289: deletion clears the pending sign-in")
            assertTrue(d.database.entryDao().all().isEmpty(), "R289: the record is cleared")
            assertNull(d.tokens.load(), "R289: the tokens are cleared")
            assertNull(d.settings.load(), "R289: the settings are cleared")
            assertFalse(NSFileManager.defaultManager.fileExistsAtPath(d.exportPath), "R289: the export is deleted")
        }

    @Test
    fun aServerEndedSessionKeepsTheRecordAndItsAccountTag() =
        runBlocking {
            val d = device()
            d.seed()
            d.store.clearForSessionEnd()

            assertEquals(1, d.pendingRemovals, "R1281: the server-ended session removed the pending requests, once")
            assertEquals(R889_TAG, d.account.current(), "R521: the account tag is KEPT")
            assertEquals(1, d.database.entryDao().all().size, "R521: the record is KEPT")
            assertFalse(d.drainCancelled, "R521: the queued sync is not cancelled")
            assertEquals("camille@example.fr", d.pending.pending(), "R521: the pending sign-in is kept")
            assertNull(d.tokens.load(), "R521: the tokens are cleared")
            assertNull(d.settings.load(), "R521: the settings are cleared")
            assertNull(d.cache.load(R889_YEAR), "R521: the cached releve is cleared")
            assertFalse(NSFileManager.defaultManager.fileExistsAtPath(d.exportPath), "R521: the export is deleted")
            assertEquals(LoggingMode.MANUAL, d.detectionMode.load(), "R527: the detection mode is reset")
        }
}
