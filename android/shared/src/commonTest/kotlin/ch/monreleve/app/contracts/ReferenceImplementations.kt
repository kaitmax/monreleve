package ch.monreleve.app.contracts

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.settings.EmployerFigureStore
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore

// IOS-1a R566. IN-MEMORY REFERENCE IMPLEMENTATIONS: the contracts' own proof that they can be passed (a contract
// nothing passes is a typo), and the JVM's half of "run on both platforms". Each shares one backing object, so
// several instances over the same storage behave as the contract's "another instance" requires.

class MemoryDossierBacking {
    val bodies = HashMap<Int, String>()
    val stale = HashSet<Int>()
}

class MemoryDossierCache(
    private val backing: MemoryDossierBacking,
) : DossierCache {
    override fun load(year: Int): String? = backing.bodies[year]

    override fun save(
        year: Int,
        body: String,
    ) {
        backing.bodies[year] = body
        backing.stale.remove(year)
    }

    override fun clear() {
        backing.bodies.clear()
        backing.stale.clear()
    }

    override fun markStale(year: Int) {
        backing.stale.add(year)
    }

    override fun isStale(year: Int): Boolean = year in backing.stale
}

/** A deliberately WRONG cache - save forgets to clear the flag - used to prove the contract can fail. */
class FlagKeepingDossierCache(
    private val backing: MemoryDossierBacking,
) : DossierCache {
    private val inner = MemoryDossierCache(backing)

    override fun load(year: Int): String? = inner.load(year)

    override fun save(
        year: Int,
        body: String,
    ) {
        backing.bodies[year] = body
    }

    override fun clear() = inner.clear()

    override fun markStale(year: Int) = inner.markStale(year)

    override fun isStale(year: Int): Boolean = inner.isStale(year)
}

class MemorySettingsStore(
    private val holder: Array<Settings?>,
) : SettingsStore {
    override fun load(): Settings? = holder[0]

    override fun save(settings: Settings) {
        holder[0] = settings
    }

    override fun clear() {
        holder[0] = null
    }
}

class MemoryTokenStore(
    private val holder: Array<TokenPair?>,
) : TokenStore {
    override fun save(pair: TokenPair) {
        holder[0] = pair
    }

    override fun load(): TokenPair? = holder[0]

    override fun clear() {
        holder[0] = null
    }
}

/** IOS-2f R889: the AccountStore reference - one tag in a shared holder, so another instance sees it. */
class MemoryAccountStore(
    private val holder: Array<String?>,
) : AccountStore {
    override fun current(): String? = holder[0]

    override fun setCurrent(tag: String) {
        holder[0] = tag
    }

    override fun clear() {
        holder[0] = null
    }
}

/**
 * IOS-SHELL-2 (R1334): the employer figure's in-memory reference, over a shared map so several instances see one
 * storage - :app's InMemoryEmployerFigureStore keeps its own map and a settable account, so it cannot be "another
 * instance" of anything. Keys are "<accountTag>.<year>"; no account reads and writes nothing (R303).
 */
class MemoryEmployerFigureStore(
    private val backing: MutableMap<String, Double>,
    private val accountTag: () -> String?,
) : EmployerFigureStore {
    private fun keyFor(year: Int): String? = accountTag()?.let { "$year" } // R1370 PLANT PA2: the account is dropped

    override fun figureFor(year: Int): Double? = keyFor(year)?.let { backing[it] }

    override fun save(
        year: Int,
        rate: Double,
    ) {
        keyFor(year)?.let { backing[it] = rate }
    }
}
