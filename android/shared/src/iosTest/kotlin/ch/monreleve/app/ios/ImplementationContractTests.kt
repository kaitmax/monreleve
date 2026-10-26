package ch.monreleve.app.ios

import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.contracts.DossierCacheContract
import ch.monreleve.app.contracts.MutationIdContract
import ch.monreleve.app.contracts.SettingsStoreContract
import ch.monreleve.app.contracts.TokenStoreContract
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.settings.SettingsStore
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import platform.CoreFoundation.CFRelease
import platform.Foundation.NSUserDefaults
import platform.Security.SecItemUpdate
import platform.Security.errSecSuccess
import kotlin.test.AfterTest

// IOS-1a R565/R566/R568. The commonTest contracts, run against each iOS implementation on the simulator. Each
// subclass supplies only storage plumbing; every assertion lives in the contract, which the JVM runs against the
// in-memory reference too, so the two platforms are held to ONE statement of each KDoc.

class FileDossierCacheContractTest : DossierCacheContract() {
    private var directory = freshTempDirectory()

    override fun reset() {
        removeDirectory(directory)
        directory = freshTempDirectory()
    }

    override fun newInstance(): DossierCache = FileDossierCache(directory + "/cache")

    @AfterTest
    fun cleanUp() = removeDirectory(directory)
}

class UserDefaultsSettingsStoreContractTest : SettingsStoreContract() {
    private val suite = uniqueName("ios1a-settings")

    override fun reset() {
        NSUserDefaults.standardUserDefaults.removePersistentDomainForName(suite)
    }

    override fun newInstance(): SettingsStore = UserDefaultsSettingsStore(NSUserDefaults(suiteName = suite))

    @AfterTest
    fun cleanUp() = reset()
}

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class IosMutationIdContractTest : MutationIdContract() {
    override fun mint(): String = newIosMutationId()
}

/** The Keychain store against the TokenStore contract. See KeychainTokenStoreTest for the availability check. */
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class KeychainTokenStoreContractTest : TokenStoreContract() {
    private val service = uniqueName("ch.monreleve.app.test")

    override fun reset() = KeychainTokenStore(service).clear()

    override fun newInstance(): TokenStore = KeychainTokenStore(service)

    override fun corruptStoredValue() {
        val identity = KeychainQueries.identity(service, KEYCHAIN_ACCOUNT)
        val update = KeychainQueries.update("not a token pair {".encodeToByteArray().toNSData())
        val status = SecItemUpdate(identity, update)
        CFRelease(identity)
        CFRelease(update)
        check(status == errSecSuccess) { "could not corrupt the test item (OSStatus $status)" }
    }

    override fun somethingIsStored(): Boolean = KeychainTokenStore(service).lookupStatus() == errSecSuccess

    @AfterTest
    fun cleanUp() = reset()
}
