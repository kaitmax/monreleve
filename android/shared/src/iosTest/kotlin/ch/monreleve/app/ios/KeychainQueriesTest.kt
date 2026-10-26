package ch.monreleve.app.ios

import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.COpaquePointer
import kotlinx.cinterop.ExperimentalForeignApi
import platform.CoreFoundation.CFDictionaryGetValue
import platform.CoreFoundation.CFRelease
import platform.CoreFoundation.CFRetain
import platform.CoreFoundation.kCFBooleanFalse
import platform.CoreFoundation.kCFBooleanTrue
import platform.Foundation.CFBridgingRelease
import platform.Security.kSecAttrAccessGroup
import platform.Security.kSecAttrAccessible
import platform.Security.kSecAttrAccessibleAfterFirstUnlock
import platform.Security.kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
import platform.Security.kSecAttrAccessibleWhenUnlocked
import platform.Security.kSecAttrAccessibleWhenUnlockedThisDeviceOnly
import platform.Security.kSecAttrAccount
import platform.Security.kSecAttrService
import platform.Security.kSecAttrSynchronizable
import platform.Security.kSecClass
import platform.Security.kSecClassGenericPassword
import platform.Security.kSecReturnData
import platform.Security.kSecValueData
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

// IOS-1a R565. THE QUERY DICTIONARIES, READ BACK FROM THE REAL CFDictionary - the part of R565 that is provable
// whether or not a test binary may call the Keychain. A dictionary is read value by value (each CF value is
// bridged to a Foundation object and compared by its string form), so a wrong accessibility class, a synchronised
// item or a stray access group fails here by name. The accessibility class is the point of the task and is
// asserted three ways: it IS AfterFirstUnlockThisDeviceOnly, it is NOT any of the three weaker-or-synced classes,
// and the identity dictionary (used to find and delete) carries no accessibility at all.

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
private fun bridged(value: COpaquePointer?): String = CFBridgingRelease(CFRetain(value)).toString()

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class KeychainQueriesTest {
    private val service = "ch.monreleve.app.session"
    private val account = "token-pair"

    @Test
    fun theAddDictionaryIsAGenericPasswordAfterFirstUnlockThisDeviceOnlyAndNotSynchronised() {
        val data = "x".encodeToByteArray().toNSData()
        val add = KeychainQueries.add(service, account, data)
        try {
            assertEquals(bridged(kSecClassGenericPassword), bridged(CFDictionaryGetValue(add, kSecClass)))
            assertEquals(service, bridged(CFDictionaryGetValue(add, kSecAttrService)))
            assertEquals(account, bridged(CFDictionaryGetValue(add, kSecAttrAccount)))
            val accessible = bridged(CFDictionaryGetValue(add, kSecAttrAccessible))
            assertEquals(bridged(kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly), accessible)
            assertNotEquals(
                bridged(kSecAttrAccessibleAfterFirstUnlock),
                accessible,
                "AfterFirstUnlock is the SYNCABLE class",
            )
            assertNotEquals(bridged(kSecAttrAccessibleWhenUnlocked), accessible, "WhenUnlocked blocks silent refresh")
            assertNotEquals(bridged(kSecAttrAccessibleWhenUnlockedThisDeviceOnly), accessible)
            assertEquals(bridged(kCFBooleanFalse), bridged(CFDictionaryGetValue(add, kSecAttrSynchronizable)))
            assertNotNull(CFDictionaryGetValue(add, kSecValueData))
            assertNull(CFDictionaryGetValue(add, kSecAttrAccessGroup), "no access group: the app's own default")
        } finally {
            CFRelease(add)
        }
    }

    @Test
    fun theIdentityAndLookupDictionariesNeverMatchASynchronisedItemAndCarryNoAccessibility() {
        val identity = KeychainQueries.identity(service, account)
        val lookup = KeychainQueries.lookup(service, account)
        try {
            for (dictionary in listOf(identity, lookup)) {
                assertEquals(
                    bridged(kCFBooleanFalse),
                    bridged(CFDictionaryGetValue(dictionary, kSecAttrSynchronizable)),
                )
                assertNull(CFDictionaryGetValue(dictionary, kSecAttrAccessible))
                assertEquals(service, bridged(CFDictionaryGetValue(dictionary, kSecAttrService)))
            }
            assertEquals(bridged(kCFBooleanTrue), bridged(CFDictionaryGetValue(lookup, kSecReturnData)))
            assertNull(CFDictionaryGetValue(identity, kSecReturnData))
        } finally {
            CFRelease(identity)
            CFRelease(lookup)
        }
    }

    @Test
    fun theUpdateDictionaryReassertsTheAccessibilityClassWithTheValue() {
        val update = KeychainQueries.update("y".encodeToByteArray().toNSData())
        try {
            assertEquals(
                bridged(kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly),
                bridged(CFDictionaryGetValue(update, kSecAttrAccessible)),
            )
            assertNotNull(CFDictionaryGetValue(update, kSecValueData))
            assertNull(CFDictionaryGetValue(update, kSecClass))
        } finally {
            CFRelease(update)
        }
    }
}
