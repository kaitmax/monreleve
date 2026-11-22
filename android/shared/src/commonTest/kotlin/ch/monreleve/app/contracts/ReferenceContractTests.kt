package ch.monreleve.app.contracts

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.settings.EmployerFigureStore
import ch.monreleve.app.settings.EveningNotificationStore
import ch.monreleve.app.settings.InMemoryEveningNotificationStore
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlin.test.Test
import kotlin.test.assertFailsWith

// IOS-1a R566. The contracts run against their in-memory references on every platform, and the dossier contract
// is run once against a deliberately wrong cache to prove it CAN fail (R133: a contract that passes everything,
// including a broken implementation, proves nothing).

class MemoryDossierCacheContractTest : DossierCacheContract() {
    private var backing = MemoryDossierBacking()

    override fun reset() {
        backing = MemoryDossierBacking()
    }

    override fun newInstance(): DossierCache = MemoryDossierCache(backing)
}

class MemorySettingsStoreContractTest : SettingsStoreContract() {
    private var holder: Array<Settings?> = arrayOf(null)

    override fun reset() {
        holder = arrayOf(null)
    }

    override fun newInstance(): SettingsStore = MemorySettingsStore(holder)
}

class MemoryTokenStoreContractTest : TokenStoreContract() {
    private var holder: Array<TokenPair?> = arrayOf(null)

    override fun reset() {
        holder = arrayOf(null)
    }

    override fun newInstance(): TokenStore = MemoryTokenStore(holder)

    // The reference reads nothing back from bytes, so an unreadable value is modelled as the cleared state it
    // must end in; the Keychain subclass corrupts a real item.
    override fun corruptStoredValue() {
        holder[0] = null
    }

    override fun somethingIsStored(): Boolean = holder[0] != null
}

// IOS-2f R889: the AccountStore contract's JVM half; KeychainAccountStoreContractTest is its simulator half.
class MemoryAccountStoreContractTest : AccountStoreContract() {
    private var holder: Array<String?> = arrayOf(null)

    override fun reset() {
        holder = arrayOf(null)
    }

    override fun newInstance(): AccountStore = MemoryAccountStore(holder)
}

// IOS-SHELL-2 (R1337): the evening store's contract, JVM half; UserDefaultsEveningNotificationStoreContractTest is its
// simulator half. The in-memory store has no storage of its own to share, so "another instance" is the same one.
class MemoryEveningNotificationStoreContractTest : EveningNotificationStoreContract() {
    private var store = InMemoryEveningNotificationStore()

    override fun reset() {
        store = InMemoryEveningNotificationStore()
    }

    override fun newInstance(): EveningNotificationStore = store
}

// IOS-SHELL-2 (R1334): the employer figure's contract, JVM half; UserDefaultsEmployerFigureStoreContractTest is its
// simulator half.
class MemoryEmployerFigureStoreContractTest : EmployerFigureStoreContract() {
    private var backing = HashMap<String, Double>()

    override fun reset() {
        backing = HashMap()
    }

    override fun newInstance(accountTag: () -> String?): EmployerFigureStore =
        MemoryEmployerFigureStore(backing, accountTag)
}

class TheDossierContractCanFailTest {
    @Test
    fun aCacheThatKeepsTheFlagAfterSaveFailsTheContract() {
        // An anonymous subclass: a named one would itself be collected as a test class by the JVM runner.
        var backing = MemoryDossierBacking()
        val wrong =
            object : DossierCacheContract() {
                override fun reset() {
                    backing = MemoryDossierBacking()
                }

                override fun newInstance(): DossierCache = FlagKeepingDossierCache(backing)
            }
        wrong.emptyStorage()
        assertFailsWith<AssertionError> { wrong.saveClearsThatYearsFlagAndNoOtherYears() }
    }
}
