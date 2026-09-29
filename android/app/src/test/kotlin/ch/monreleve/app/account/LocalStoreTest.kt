package ch.monreleve.app.account

import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.test.runTest

// AN12 increment 2 (R295) / increment 3 (R289). The device-erasure scopes, proven over fakes. The Room clear
// and the sync cancel are spies; the prefs-backed stores are in-memory fakes. This is the JVM proof of WHICH
// stores each scope clears; the walkthrough proves it end to end on a device, and increment 3 adds the
// server-plus-device negative sweep.

private class FakeTokenStore(private var pair: TokenPair? = TokenPair("a", "r", "0", "0")) : TokenStore {
    override fun save(pair: TokenPair) {
        this.pair = pair
    }

    override fun load(): TokenPair? = pair

    override fun clear() {
        pair = null
    }
}

private val DEFAULT_SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

private class FakeSettingsStore(private var settings: Settings? = DEFAULT_SETTINGS) : SettingsStore {
    override fun load(): Settings? = settings

    override fun save(settings: Settings) {
        this.settings = settings
    }

    override fun clear() {
        settings = null
    }
}

private class FakeDossierCache(private var body: String? = "{}") : DossierCache {
    override fun load(year: Int): String? = body

    override fun save(
        year: Int,
        body: String,
    ) {
        this.body = body
    }

    override fun clear() {
        body = null
    }
}

private class FakePendingSignIn(private var email: String? = "camille@example.fr") : PendingSignInStore {
    override fun remember(email: String) {
        this.email = email
    }

    override fun pending(): String? = email

    override fun clear() {
        email = null
    }
}

class LocalStoreTest : FunSpec({
    class Fixture {
        val tokens = FakeTokenStore()
        val settings = FakeSettingsStore()
        val cache = FakeDossierCache()
        val pending = FakePendingSignIn()
        var recordCleared = false
        var syncCancelled = false
        var exportsCleared = false
        val store: LocalStore =
            DeviceLocalStore(
                tokenStore = tokens,
                settingsStore = settings,
                dossierCache = cache,
                pendingSignIn = pending,
                clearRecord = { recordCleared = true },
                cancelSync = { syncCancelled = true },
                clearExports = { exportsCleared = true },
            )
    }

    test("R295: sign-out clears the record, the cache, the tokens, queued sync and the exported files") {
        runTest {
            val f = Fixture()
            f.store.clearForSignOut()

            f.recordCleared.shouldBeTrue()
            f.cache.load(2026) shouldBe null
            f.tokens.load() shouldBe null
            f.syncCancelled.shouldBeTrue()
            // The cacheDir/exports files hold the record in another form (the account JSON is the whole record).
            f.exportsCleared.shouldBeTrue()
        }
    }

    test("R295 / PARKAN-28: sign-out KEEPS the calculation settings and the pending sign-in") {
        runTest {
            val f = Fixture()
            f.store.clearForSignOut()

            // Settings survive so a re-sign-in lands on a computable Aujourd'hui without re-onboarding.
            f.settings.load().shouldNotBeNull()
            f.pending.pending().shouldNotBeNull()
        }
    }

    test("R289: deletion clears EVERYTHING the device holds - a first-run state") {
        runTest {
            val f = Fixture()
            f.store.clearForDeletion()

            // The sign-out set...
            f.recordCleared.shouldBeTrue()
            f.cache.load(2026) shouldBe null
            f.tokens.load() shouldBe null
            f.syncCancelled.shouldBeTrue()
            f.exportsCleared.shouldBeTrue()
            // ...plus the settings and the pending sign-in.
            f.settings.load() shouldBe null
            f.pending.pending() shouldBe null
        }
    }

    test("deletion is a strict superset of sign-out (settings survive sign-out, not deletion)") {
        runTest {
            val signOut = Fixture()
            signOut.store.clearForSignOut()
            val deletion = Fixture()
            deletion.store.clearForDeletion()

            // The one difference between the two scopes, asserted directly so a future edit to either cannot
            // quietly make them equal.
            (signOut.settings.load() != null).shouldBeTrue()
            (deletion.settings.load() == null).shouldBeTrue()
        }
    }
})
