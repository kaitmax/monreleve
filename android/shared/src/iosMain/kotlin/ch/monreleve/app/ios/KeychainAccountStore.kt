package ch.monreleve.app.ios

import ch.monreleve.app.account.AccountStore
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.value
import platform.CoreFoundation.CFRelease
import platform.CoreFoundation.CFTypeRefVar
import platform.Foundation.CFBridgingRelease
import platform.Foundation.NSData
import platform.Security.SecItemAdd
import platform.Security.SecItemCopyMatching
import platform.Security.SecItemDelete
import platform.Security.SecItemUpdate
import platform.Security.errSecItemNotFound
import platform.Security.errSecSuccess

// IOS-2f R889. THE iOS AccountStore: THE CURRENT ACCOUNT'S OPAQUE TAG, IN ONE KEYCHAIN ITEM.
//
// The contract (account/AccountStore.kt, commonMain; AccountStoreContract in commonTest) is a single value - the
// 64-hex accountTagOf digest of the address the person signed in with - set at sign-in, read at every tap, drain and
// screen, cleared on sign-out and deletion and KEPT through a server-ended session (DeviceLocalStore, R303/R521).
//
// KEYED AS ANDROID'S IS: Android keeps it in its own SharedPreferences file (monreleve.account, key tag), EXCLUDED FROM
// BACKUP like the token and pending stores "though the tag is already an opaque SHA-256 digest". On iOS UserDefaults
// would be backed up, so - exactly the reasoning KeychainPendingSignInStore records - this is a Keychain item built
// from the SAME query dictionaries (KeychainQueries: never synchronised, ThisDeviceOnly, AfterFirstUnlock, the last
// so a drain running with the phone locked can read it). Its own service name keeps it a separate item from the token
// pair and the pending address, so clearing one never touches another; and it shares their lifetime, so the tag
// lives and dies with the session it scopes.
//
// A REFUSED WRITE THROWS KeychainException, the idiom of the two other Keychain stores (one Keychain idiom on iOS);
// Android's SharedPreferences commit() result is ignored there. Recorded in the report's DEVIATIONS. A failed READ is
// "no account" - fail closed (R303): an unreadable tag scopes nothing, so nothing is sent or shown under it. The tag is
// never logged.

internal const val ACCOUNT_KEYCHAIN_SERVICE = "ch.monreleve.app.account"
internal const val ACCOUNT_KEYCHAIN_ACCOUNT = "tag"

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class KeychainAccountStore(
    private val service: String = ACCOUNT_KEYCHAIN_SERVICE,
    private val account: String = ACCOUNT_KEYCHAIN_ACCOUNT,
) : AccountStore {
    override fun current(): String? =
        memScoped {
            val query = KeychainQueries.lookup(service, account)
            val result = alloc<CFTypeRefVar>()
            val status = SecItemCopyMatching(query, result.ptr)
            CFRelease(query)
            if (status != errSecSuccess) return@memScoped null
            (CFBridgingRelease(result.value) as? NSData)?.toByteArray()?.decodeToString()
        }

    override fun setCurrent(tag: String) {
        val data = tag.encodeToByteArray().toNSData()
        val identity = KeychainQueries.identity(service, account)
        val update = KeychainQueries.update(data)
        val updateStatus = SecItemUpdate(identity, update)
        CFRelease(identity)
        CFRelease(update)
        if (updateStatus == errSecSuccess) return
        if (updateStatus != errSecItemNotFound) throw KeychainException(updateStatus)
        val add = KeychainQueries.add(service, account, data)
        val addStatus = SecItemAdd(add, null)
        CFRelease(add)
        if (addStatus != errSecSuccess) throw KeychainException(addStatus)
    }

    // errSecItemNotFound is success here: clearing an empty store is a no-op (the contract).
    override fun clear() {
        val identity = KeychainQueries.identity(service, account)
        SecItemDelete(identity)
        CFRelease(identity)
    }
}
