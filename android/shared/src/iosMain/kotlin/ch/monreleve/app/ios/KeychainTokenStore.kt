package ch.monreleve.app.ios

import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.value
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import platform.CoreFoundation.CFDictionaryAddValue
import platform.CoreFoundation.CFDictionaryCreateMutable
import platform.CoreFoundation.CFDictionaryRef
import platform.CoreFoundation.CFRelease
import platform.CoreFoundation.CFTypeRefVar
import platform.CoreFoundation.kCFBooleanFalse
import platform.CoreFoundation.kCFBooleanTrue
import platform.CoreFoundation.kCFTypeDictionaryKeyCallBacks
import platform.CoreFoundation.kCFTypeDictionaryValueCallBacks
import platform.Foundation.CFBridgingRelease
import platform.Foundation.CFBridgingRetain
import platform.Foundation.NSData
import platform.Security.SecItemAdd
import platform.Security.SecItemCopyMatching
import platform.Security.SecItemDelete
import platform.Security.SecItemUpdate
import platform.Security.errSecItemNotFound
import platform.Security.errSecSuccess
import platform.Security.kSecAttrAccessible
import platform.Security.kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
import platform.Security.kSecAttrAccount
import platform.Security.kSecAttrService
import platform.Security.kSecAttrSynchronizable
import platform.Security.kSecClass
import platform.Security.kSecClassGenericPassword
import platform.Security.kSecMatchLimit
import platform.Security.kSecMatchLimitOne
import platform.Security.kSecReturnData
import platform.Security.kSecValueData

// IOS-1a R565. THE iOS TokenStore: ONE KEYCHAIN ITEM, NEVER SYNCED, READABLE WITH THE PHONE LOCKED.
//
// THE KDOC OF TokenStore IS THE SPECIFICATION and each of its promises lands here as follows.
//   One pair, or none / durable and whole before save returns: the pair is ONE generic-password item whose value
//   is the JSON-encoded pair; save is SecItemUpdate of that item's value (atomic per item), or SecItemAdd when
//   there is no item yet. Never four items written in sequence: a refresh token beside the previous access token
//   would make the next refresh a replay, and a replay ends the session (R210).
//   load before any save is null: errSecItemNotFound is null.
//   load returns null rather than throwing, and clears when the bytes cannot be read: a value that is not a
//   pair (a corrupted blob, an encoding that no longer parses) is deleted and null is returned. A Keychain
//   STATUS that is neither success nor not-found (the keychain unavailable) is not evidence the pair is bad, so
//   it returns null WITHOUT deleting anything: dropping a good session because the OS said "not now" would be
//   the loop-breaker turned into a sign-out.
//   clear erases the pair and nothing else, and on an empty store is a no-op: errSecItemNotFound is success.
//   It needs no network, no session and no user: SecItemDelete asks for none of them.
//   Not gated on the phone being unlocked: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly. Silent refresh runs
//   while the phone is locked, and AfterFirstUnlock is the weakest class that allows it. THIS IS THE ACCESSIBILITY
//   CLASS, and nothing in this file or its tests weakens it to make a test pass (R565).
//
// NOT SYNCHRONISED, NOT RESTORED TO ANOTHER DEVICE. ThisDeviceOnly keeps the item out of backups restored onto a
// different phone, and kSecAttrSynchronizable = false (stated on every query, never inherited) keeps it out of
// iCloud Keychain. Both are asserted against the REAL dictionaries by KeychainQueriesTest.
//
// NEVER LOGGED: this file imports no logger and builds no message containing a token. KeychainException carries
// an OSStatus number and nothing else.

internal const val KEYCHAIN_SERVICE = "ch.monreleve.app.session"
internal const val KEYCHAIN_ACCOUNT = "token-pair"

/** A Keychain call that failed with an OSStatus that is not "there is no such item". The number is the diagnosis. */
class KeychainException(
    val status: Int,
) : Exception("the Keychain refused the request (OSStatus $status)")

@Serializable
private class StoredPair(
    val accessToken: String,
    val refreshToken: String,
    val accessExpiresAt: String,
    val refreshExpiresAt: String,
)

/**
 * The Keychain query dictionaries, built in ONE place so a test can read the real CFDictionary back. Each
 * function returns a retained dictionary the caller releases with CFRelease.
 */
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
internal object KeychainQueries {
    /** Which item: class, service, account, and the item must NOT be a synchronised one. */
    fun identity(
        service: String,
        account: String,
    ): CFDictionaryRef? =
        dictionary { owned ->
            put(kSecClass, kSecClassGenericPassword)
            put(kSecAttrService, owned.retain(service))
            put(kSecAttrAccount, owned.retain(account))
            put(kSecAttrSynchronizable, kCFBooleanFalse)
        }

    /** identity + "give me the value, one item". */
    fun lookup(
        service: String,
        account: String,
    ): CFDictionaryRef? =
        dictionary { owned ->
            put(kSecClass, kSecClassGenericPassword)
            put(kSecAttrService, owned.retain(service))
            put(kSecAttrAccount, owned.retain(account))
            put(kSecAttrSynchronizable, kCFBooleanFalse)
            put(kSecReturnData, kCFBooleanTrue)
            put(kSecMatchLimit, kSecMatchLimitOne)
        }

    /** identity + the value + the accessibility class: what is added, and what an update re-asserts. */
    fun add(
        service: String,
        account: String,
        value: NSData,
    ): CFDictionaryRef? =
        dictionary { owned ->
            put(kSecClass, kSecClassGenericPassword)
            put(kSecAttrService, owned.retain(service))
            put(kSecAttrAccount, owned.retain(account))
            put(kSecAttrSynchronizable, kCFBooleanFalse)
            put(kSecValueData, owned.retain(value))
            put(kSecAttrAccessible, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
        }

    /** The attributes an UPDATE replaces: the value, and the accessibility class again. */
    fun update(value: NSData): CFDictionaryRef? =
        dictionary { owned ->
            put(kSecValueData, owned.retain(value))
            put(kSecAttrAccessible, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
        }
}

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
private class Owned {
    private val refs = ArrayList<kotlinx.cinterop.COpaquePointer>()

    fun retain(any: Any): kotlinx.cinterop.COpaquePointer? = CFBridgingRetain(any)?.also { refs.add(it) }

    fun releaseAll() = refs.forEach { CFRelease(it) }
}

@OptIn(ExperimentalForeignApi::class)
private class DictionaryBuilder(
    val dictionary: platform.CoreFoundation.CFMutableDictionaryRef?,
) {
    fun put(
        key: kotlinx.cinterop.COpaquePointer?,
        value: kotlinx.cinterop.COpaquePointer?,
    ) = CFDictionaryAddValue(dictionary, key, value)
}

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
private fun dictionary(fill: DictionaryBuilder.(Owned) -> Unit): CFDictionaryRef? {
    val owned = Owned()
    val created =
        CFDictionaryCreateMutable(null, 0, kCFTypeDictionaryKeyCallBacks.ptr, kCFTypeDictionaryValueCallBacks.ptr)
    DictionaryBuilder(created).fill(owned)
    // The dictionary retained what it was given (kCFTypeDictionary*CallBacks), so our own references go now.
    owned.releaseAll()
    return created
}

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class KeychainTokenStore(
    private val service: String = KEYCHAIN_SERVICE,
    private val account: String = KEYCHAIN_ACCOUNT,
) : TokenStore {
    override fun save(pair: TokenPair) {
        val stored = StoredPair(pair.accessToken, pair.refreshToken, pair.accessExpiresAt, pair.refreshExpiresAt)
        val data = Json.encodeToString(StoredPair.serializer(), stored).encodeToByteArray().toNSData()
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

    override fun load(): TokenPair? {
        val bytes = readValue() ?: return null
        val decoded = runCatching { Json.decodeFromString(StoredPair.serializer(), bytes.decodeToString()) }.getOrNull()
        if (decoded == null) clear()
        return decoded?.let { TokenPair(it.accessToken, it.refreshToken, it.accessExpiresAt, it.refreshExpiresAt) }
    }

    override fun clear() {
        val identity = KeychainQueries.identity(service, account)
        SecItemDelete(identity)
        CFRelease(identity)
    }

    /** The stored bytes; null if there is no item or the Keychain could not be read (never throws, never deletes). */
    private fun readValue(): ByteArray? =
        memScoped {
            val query = KeychainQueries.lookup(service, account)
            val result = alloc<CFTypeRefVar>()
            val status = SecItemCopyMatching(query, result.ptr)
            CFRelease(query)
            if (status != errSecSuccess) return@memScoped null
            (CFBridgingRelease(result.value) as? NSData)?.toByteArray()
        }

    /** For tests: the OSStatus of a lookup, so a refusal can be quoted by number rather than guessed. */
    internal fun lookupStatus(): Int =
        memScoped {
            val query = KeychainQueries.lookup(service, account)
            val result = alloc<CFTypeRefVar>()
            val status = SecItemCopyMatching(query, result.ptr)
            CFRelease(query)
            if (status == errSecSuccess) CFBridgingRelease(result.value)
            status
        }
}
