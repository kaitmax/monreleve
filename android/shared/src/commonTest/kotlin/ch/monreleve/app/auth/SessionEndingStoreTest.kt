package ch.monreleve.app.auth

import ch.monreleve.app.account.DeviceLocalStore
import ch.monreleve.app.contracts.MemoryAccountStore
import ch.monreleve.app.contracts.MemoryDossierBacking
import ch.monreleve.app.contracts.MemoryDossierCache
import ch.monreleve.app.contracts.MemorySettingsStore
import ch.monreleve.app.contracts.MemoryTokenStore
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-MOVE-SEAM R1281. THE "SESSION ENDED" WRAPPER, ON EVERY PLATFORM, WITH A FAKE SEAM.
//
// SessionEndingStore (auth/SessionEndSeam.kt) lives once, in commonMain (R1280), and both platforms hand out the
// device's LocalStore through it: Android's deviceLocalStore (account/DeviceLocalStores.kt, over the sampler, push and
// the 19:00 fallback) and iOS's iosDeviceLocalStore (ios/IosLocalStores.kt, over the pending local notifications).
// This runs on the JVM and on the iOS simulator (commonTest), so what a session end does is asserted on both, through
// the real wrapper over the real DeviceLocalStore - only the stores beneath are in memory.
//
// WHAT IS ASSERTED, AND WHY EACH:
//   - EXACTLY ONCE, PATH NAMED, ON EACH OF THE THREE PATHS (list equality, never a count >= 1). Deletion matters most:
//     DeviceLocalStore.clearForDeletion calls its own clearForSignOut, so a seam placed one layer too deep would be
//     told twice, once as SIGNED_OUT.
//   - THE OTHER SIDE (R196): a store nobody ends tells the seam nothing.
//   - A SEAM THAT THROWS NEVER LEAVES THE STORE HALF-CLEARED. What Android's code does on a seam failure TODAY, and
//     keeps: the seam runs inside a try, the scope's clear in its finally, so the clear runs whole and THEN the seam's
//     exception propagates to the caller. Every store of each scope is checked, with the scope's own controls - what a
//     scope must KEEP is asserted kept, so a clear that ran the WRONG scope fails too.
//   - THE SEAM RUNS FIRST: it is told while the session is still there, and a clear that throws has already told it.

private const val YEAR = 2026
private const val TAG = "acct-tag"
private const val ADDRESS = "camille@example.fr"
private val SESSION = TokenPair("access", "refresh", "0", "0")
private val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

private class OnePendingSignIn(
    var address: String?,
) : PendingSignInStore {
    override fun remember(email: String) {
        address = email
    }

    override fun pending(): String? = address

    override fun clear() {
        address = null
    }
}

/** One signed-in device: every store seeded, each lambda counted, the wrapper over [seam]. */
private class SeamDevice(
    seam: SessionEndSeam,
    failingRecordClear: Boolean = false,
) {
    val tokens = arrayOf<TokenPair?>(SESSION)
    val settings = arrayOf<Settings?>(SETTINGS)
    val dossier = MemoryDossierBacking().also { it.bodies[YEAR] = "{}" }
    val account = arrayOf<String?>(TAG)
    val pending = OnePendingSignIn(ADDRESS)
    val mode = InMemoryDetectionModeStore(LoggingMode.AUTO_DETECT)
    var recordClears = 0
    var syncCancels = 0
    var exportClears = 0
    val store =
        SessionEndingStore(
            DeviceLocalStore(
                tokenStore = MemoryTokenStore(tokens),
                settingsStore = MemorySettingsStore(settings),
                dossierCache = MemoryDossierCache(dossier),
                pendingSignIn = pending,
                accountStore = MemoryAccountStore(account),
                detectionModeStore = mode,
                clearRecord = {
                    if (failingRecordClear) error("the record clear failed")
                    recordClears += 1
                },
                cancelSync = { syncCancels += 1 },
                clearExports = { exportClears += 1 },
            ),
            seam,
        )

    /** Every store as it was seeded - the positive control each test reads before it ends anything. */
    fun assertSeeded() {
        assertEquals(SESSION, tokens[0], "control: a session")
        assertEquals(SETTINGS, settings[0], "control: settings")
        assertEquals("{}", dossier.bodies[YEAR], "control: a cached releve")
        assertEquals(TAG, account[0], "control: the account tag")
        assertEquals(ADDRESS, pending.address, "control: a pending sign-in")
        assertEquals(LoggingMode.AUTO_DETECT, mode.load(), "control: automatic mode")
    }

    /** R295/R297/R303/R315: sign-out clears everything but the pending sign-in. */
    fun assertSignedOut() {
        assertNull(tokens[0], "R295: tokens")
        assertNull(settings[0], "R297: settings")
        assertTrue(dossier.bodies.isEmpty(), "R295: cached releve")
        assertNull(account[0], "R303: account tag")
        assertEquals(LoggingMode.MANUAL, mode.load(), "R315: detection mode")
        assertEquals(1, recordClears, "R295: the record cleared once")
        assertEquals(1, syncCancels, "R295: the sync cancelled once")
        assertEquals(1, exportClears, "R295: the exports cleared once")
        assertEquals(ADDRESS, pending.address, "a sign-out keeps the pending sign-in")
    }

    /** R289: deletion is sign-out plus the pending sign-in. */
    fun assertDeleted() {
        assertNull(tokens[0], "R289: tokens")
        assertNull(settings[0], "R289: settings")
        assertTrue(dossier.bodies.isEmpty(), "R289: cached releve")
        assertNull(account[0], "R289: account tag")
        assertEquals(LoggingMode.MANUAL, mode.load(), "R289: detection mode")
        assertEquals(1, recordClears, "R289: the record cleared once")
        assertEquals(1, syncCancels, "R289: the sync cancelled once")
        assertEquals(1, exportClears, "R289: the exports cleared once")
        assertNull(pending.address, "R289: the pending sign-in")
    }

    /** R521/R527: a server-ended session KEEPS the record, its tag, the queued sync and the pending sign-in. */
    fun assertSessionEnded() {
        assertNull(tokens[0], "R521: tokens")
        assertNull(settings[0], "R521: settings")
        assertTrue(dossier.bodies.isEmpty(), "R521: cached releve")
        assertEquals(1, exportClears, "R521: the exports cleared once")
        assertEquals(LoggingMode.MANUAL, mode.load(), "R527: detection mode")
        assertEquals(0, recordClears, "R521: the record is KEPT")
        assertEquals(TAG, account[0], "R521: the account tag is KEPT")
        assertEquals(0, syncCancels, "R521: the queued sync is not cancelled")
        assertEquals(ADDRESS, pending.address, "R521: the pending sign-in is kept")
    }
}

/** A scope of the wrapper, its path, and what it must leave behind. */
private class Scope(
    val path: SessionEndPath,
    val end: suspend (SessionEndingStore) -> Unit,
    val assertCleared: (SeamDevice) -> Unit,
)

private val SCOPES =
    listOf(
        Scope(SessionEndPath.SIGNED_OUT, { it.clearForSignOut() }, { it.assertSignedOut() }),
        Scope(SessionEndPath.DELETED, { it.clearForDeletion() }, { it.assertDeleted() }),
        Scope(SessionEndPath.ENDED_BY_SERVER, { it.clearForSessionEnd() }, { it.assertSessionEnded() }),
    )

class SessionEndingStoreTest {
    @Test
    fun everyPathTellsTheSeamExactlyOnceAndNamesItself() =
        runTest {
            assertEquals(SessionEndPath.entries.toSet(), SCOPES.map { it.path }.toSet(), "every path is covered")
            SCOPES.forEach { scope ->
                val told = mutableListOf<SessionEndPath>()
                val device = SeamDevice({ told += it })
                device.assertSeeded()

                scope.end(device.store)

                assertEquals(listOf(scope.path), told, "${scope.path}: the seam, told once, by this path's name")
                scope.assertCleared(device)
            }
        }

    @Test
    fun aStoreNobodyEndsTellsTheSeamNothing() =
        runTest {
            val told = mutableListOf<SessionEndPath>()
            val device = SeamDevice({ told += it })

            assertEquals(emptyList<SessionEndPath>(), told)
            device.assertSeeded()
        }

    @Test
    fun aSeamThatThrowsStillLeavesEachScopeWhollyClearedAndTheFailureReachesTheCaller() =
        runTest {
            SCOPES.forEach { scope ->
                val told = mutableListOf<SessionEndPath>()
                val device =
                    SeamDevice({
                        told += it
                        error("the platform's stop failed")
                    })
                device.assertSeeded()

                val thrown = assertFailsWith<IllegalStateException> { scope.end(device.store) }

                assertEquals("the platform's stop failed", thrown.message, "${scope.path}: the SEAM's failure")
                assertEquals(listOf(scope.path), told, "${scope.path}: told once, even failing")
                scope.assertCleared(device)
            }
        }

    @Test
    fun theSeamIsToldFirstWhileTheSessionIsStillThere() =
        runTest {
            SCOPES.forEach { scope ->
                var sessionWhenTold: TokenPair? = null
                lateinit var device: SeamDevice
                device = SeamDevice({ sessionWhenTold = device.tokens[0] })

                scope.end(device.store)

                assertNotNull(sessionWhenTold, "${scope.path}: the seam ran before the clear")
            }
        }

    @Test
    fun aClearThatThrowsHasAlreadyToldTheSeam() =
        runTest {
            val told = mutableListOf<SessionEndPath>()
            val device = SeamDevice({ told += it }, failingRecordClear = true)

            assertFailsWith<IllegalStateException> { device.store.clearForSignOut() }

            assertEquals(listOf(SessionEndPath.SIGNED_OUT), told)
        }
}
