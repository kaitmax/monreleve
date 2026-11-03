package ch.monreleve.app.ios

import ch.monreleve.app.auth.PendingSignInStore
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

// IOS-2a R768. THE iOS PendingSignInStore: THE ADDRESS A SIGN-IN WAS REQUESTED FOR, IN ONE KEYCHAIN ITEM.
//
// The contract (auth/PendingSignInStore.kt, commonMain) asks for a store that survives the app being killed between
// requesting the link and the link re-opening it, and that stays out of backups - an email is a credential in this
// product's threat model, which is why Android excludes its SharedPreferences file from backup. UserDefaults would
// be the smaller file and the wrong answer: it is backed up. So this is the Keychain, built from the SAME query
// dictionaries KeychainTokenStore uses (KeychainQueries): never synchronised, ThisDeviceOnly, AfterFirstUnlock. A
// second service name keeps it a separate item from the token pair, so clearing one never touches the other.
//
// Android stores the address trimmed and lower-cased (SharedPrefsPendingSignInStore); this store does the same, so
// the MISMATCH comparison reads the same value on both platforms. NEVER LOGGED, like the token store.

internal const val PENDING_KEYCHAIN_SERVICE = "ch.monreleve.app.pending"
internal const val PENDING_KEYCHAIN_ACCOUNT = "email"

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class KeychainPendingSignInStore(
    private val service: String = PENDING_KEYCHAIN_SERVICE,
    private val account: String = PENDING_KEYCHAIN_ACCOUNT,
) : PendingSignInStore {
    override fun remember(email: String) {
        val data = email.trim().lowercase().encodeToByteArray().toNSData()
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

    override fun pending(): String? =
        memScoped {
            val query = KeychainQueries.lookup(service, account)
            val result = alloc<CFTypeRefVar>()
            val status = SecItemCopyMatching(query, result.ptr)
            CFRelease(query)
            if (status != errSecSuccess) return@memScoped null
            (CFBridgingRelease(result.value) as? NSData)?.toByteArray()?.decodeToString()
        }

    override fun clear() {
        val identity = KeychainQueries.identity(service, account)
        SecItemDelete(identity)
        CFRelease(identity)
    }
}
