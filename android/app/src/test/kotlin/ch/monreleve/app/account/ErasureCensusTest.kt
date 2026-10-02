package ch.monreleve.app.account

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// AN12 increment 3 (R289, the advisor's census). A negative sweep that re-reads the clear-LIST can only ever
// confirm the list cleared what the list clears; it cannot catch a store the list FORGOT. FW26 answered this
// server-side by reading the SCHEMA, not the erasure's own list. This is the device analogue: it reads every
// persistent-storage identifier out of main source and requires each to be either erased by account deletion
// or exempted by name with a reason. A new « monreleve.<x> » store fails this test until somebody wires it
// into the erasure (ERASED_STORAGE) or states why it is not account data (EXEMPT).
//
// The convention it rests on: every SharedPreferences file and the Room database name in this app carry the
// « monreleve. » prefix, so this regex is their census the way a userId column was FW26's.
//
// KNOWN BLIND SPOT, covered elsewhere: the cacheDir/exports directory is a PATH, not a « monreleve.* » name,
// so this census cannot see it. It holds rendered exports - the account JSON is the whole record - and is
// erased by DeviceLocalStore's clearExports seam, asserted in LocalStoreTest and the ParametresAccountTest
// negative sweep. A census keyed on names is structurally blind to a file path (R246's shape), so the seam,
// not this test, is that file's guard.

private val MAIN_DIR = File("src/main/kotlin/ch/monreleve/app")
private val STORAGE_NAME = Regex(""""(monreleve\.[a-z]+)"""")

// Cleared by account deletion (R289): the four SharedPreferences files - via DeviceLocalStore's token,
// settings, dossier-cache and pending-sign-in stores - and the Room database, via clearAllTables().
private val ERASED_STORAGE =
    setOf(
        "monreleve.auth",
        "monreleve.settings",
        "monreleve.dossier",
        "monreleve.pending",
        "monreleve.db",
        // AN-FIX F4 / R303: the account scope, cleared by DeviceLocalStore.clearForSignOut (and so deletion).
        "monreleve.account",
        // AN-AUTO increment 2 / R315: the detection logging-mode cache, cleared by DeviceLocalStore via
        // detectionModeStore.clear() on sign-out (and so deletion); restored from /me on re-sign-in.
        "monreleve.detection",
    )

// « monreleve.<x> » literals that are NOT device storage, each with the reason it needs no erasure. Asserted
// non-vacuous below (R206: an exemption argues for itself).
private val EXEMPT_STORAGE =
    mapOf(
        "monreleve.ch" to "the App Link host (CallbackLink.HOST) - a domain, not a store on this device",
    )

private fun mainKtFiles(): List<File> =
    if (!MAIN_DIR.exists()) {
        emptyList()
    } else {
        MAIN_DIR.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
    }

private fun storageNames(): Set<String> =
    mainKtFiles().flatMap { file -> STORAGE_NAME.findAll(file.readText()).map { it.groupValues[1] } }.toSet()

class ErasureCensusTest {
    @Test
    fun everyDeviceStoreIsErasedByDeletionOrExemptedWithAReason() {
        val found = storageNames()
        assertTrue("expected some monreleve.* storage identifiers in main source, found none", found.isNotEmpty())

        val uncovered = found.filter { it !in ERASED_STORAGE && it !in EXEMPT_STORAGE }
        assertTrue(
            "a monreleve.* store is neither erased by account deletion nor exempted (R289): $uncovered - " +
                "add it to DeviceLocalStore.clearForDeletion and ERASED_STORAGE, or exempt it with a reason",
            uncovered.isEmpty(),
        )
    }

    @Test
    fun theCensusNamesNoStoreThatHasSinceBeenRemoved() {
        val found = storageNames()
        val stale = (ERASED_STORAGE + EXEMPT_STORAGE.keys).filter { it !in found }
        assertTrue("the census names storage identifiers no source uses: $stale", stale.isEmpty())
    }

    @Test
    fun everyExemptionStatesWhyItIsNotAccountData() {
        for ((name, reason) in EXEMPT_STORAGE) {
            assertTrue("$name is exempt from erasure but states no reason", reason.length > 20)
        }
    }
}
