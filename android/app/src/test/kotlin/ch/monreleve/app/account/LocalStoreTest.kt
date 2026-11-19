package ch.monreleve.app.account

import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.LoggingMode
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
    private var stale = false

    override fun load(year: Int): String? = body

    override fun save(
        year: Int,
        body: String,
    ) {
        this.body = body
        stale = false
    }

    override fun clear() {
        body = null
        stale = false
    }

    override fun markStale(year: Int) {
        stale = true
    }

    override fun isStale(year: Int): Boolean = stale
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

private class FakeAccountStore(private var tag: String? = "acct-tag") : AccountStore {
    override fun current(): String? = tag

    override fun setCurrent(tag: String) {
        this.tag = tag
    }

    override fun clear() {
        tag = null
    }
}

class LocalStoreTest : FunSpec({
    class Fixture {
        val tokens = FakeTokenStore()
        val settings = FakeSettingsStore()
        val cache = FakeDossierCache()
        val pending = FakePendingSignIn()
        val account = FakeAccountStore()

        // R315: start in AUTO_DETECT so clear() is observable as a reset to MANUAL.
        val detectionMode = InMemoryDetectionModeStore(LoggingMode.AUTO_DETECT)
        var recordCleared = false
        var syncCancelled = false
        var exportsCleared = false
        val store: DeviceLocalStore =
            DeviceLocalStore(
                tokenStore = tokens,
                settingsStore = settings,
                dossierCache = cache,
                pendingSignIn = pending,
                accountStore = account,
                detectionModeStore = detectionMode,
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
            // AN-FIX F4 / R303: the account tag that scoped the record is cleared too (no stale scope).
            f.account.current() shouldBe null
        }
    }

    test("R297 (reverses PARKAN-28): sign-out CLEARS the calculation settings too; the pending sign-in is kept") {
        runTest {
            val f = Fixture()
            f.store.clearForSignOut()

            // R297: the settings are configuration the SERVER holds; clearing them on sign-out protects whoever
            // holds the phone next, and re-signing in restores them from GET /api/v1/me before the onboarding
            // decision. The pending sign-in is not R297's subject and is kept.
            f.settings.load() shouldBe null
            f.pending.pending().shouldNotBeNull()
            // R315: the detection mode cache is cleared too (restored from /me at the next sign-in's RESOLVING, R1162).
            f.detectionMode.load() shouldBe LoggingMode.MANUAL
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
            // ...and the account tag (deletion is a superset of sign-out).
            f.account.current() shouldBe null
        }
    }

    // AN-FORCED-SIGNOUT (R521). A session the SERVER ended is not R295's sign-out: the record and its account tag stay,
    // so the days wait for the same person (R509) and stay invisible to anybody else (R303). What goes is what the
    // next account must not inherit and the same one gets back - the settings (/me) and the cached releve (the
    // dossier GET) - with the exports, the cached record in another form.
    //
    // R527 ADDS THE DETECTION FILE to that scope, but for the employer figures - which this fixture's in-memory mode
    // store does not hold, so the figures' half is ForcedSignOutTest's, over one file and the app's own stores. Here:
    // the mode goes. This test asserted AUTO_DETECT kept while the file was a QUESTION (Q1); R527 answered it.
    test("R521/R527: a server-ended session clears the settings, the cache, the exports, the tokens and the mode") {
        runTest {
            val f = Fixture()
            f.store.clearForSessionEnd()

            f.settings.load() shouldBe null
            f.cache.load(2026) shouldBe null
            f.exportsCleared.shouldBeTrue()
            f.tokens.load() shouldBe null
            f.detectionMode.load() shouldBe LoggingMode.MANUAL
            // KEPT: the record and its tag, the queued sync, the pending sign-in.
            f.recordCleared shouldBe false
            f.account.current() shouldBe "acct-tag"
            f.syncCancelled shouldBe false
            f.pending.pending().shouldNotBeNull()
        }
    }

    test("deletion is a strict superset of sign-out (the pending sign-in survives sign-out, not deletion)") {
        runTest {
            val signOut = Fixture()
            signOut.store.clearForSignOut()
            val deletion = Fixture()
            deletion.store.clearForDeletion()

            // R297 made sign-out clear the settings too, so the settings no longer distinguish the scopes. The
            // one remaining difference is the pending sign-in, asserted directly so a future edit to either
            // scope cannot quietly make them equal.
            (signOut.pending.pending() != null).shouldBeTrue()
            (deletion.pending.pending() == null).shouldBeTrue()
        }
    }
})
